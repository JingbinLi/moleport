import fs from "fs";
import http from "http";
import path from "path";
import { spawn, exec } from "child_process";
import getPort from "get-port";
import { MoleHole } from "./types";
import { loadState } from "./state";
import { createTunnelsBatch } from "./batch";
import { startAllTunnels, startSingleTunnel, stopAllTunnels, stopSingleTunnel } from "./tunnel-actions";
import { renderWebUi } from "./web-ui";
import { getVersion } from "./version";
import { readTunnelLogTail, tunnelLogPath } from "./logs";
import {
  formatIssues,
  loadTunnelsFromFile,
  readTunnelConfigFile,
  validateTunnels,
  writeTunnelConfigFile,
  TunnelConfig,
} from "./toml-config";
import {
  WEB_SERVICE_NAME,
  WebLock,
  clearWebLock,
  isProcessAlive,
  probeWebServer,
  readWebLock,
  stopWebServer,
  webLockPath,
  webLogPath,
  writeWebLock,
} from "./web-lock";

export const DEFAULT_WEB_PORT = 7788;
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 1024 * 1024;

export interface StartWebServerOptions {
  tomlPath: string;
  /** Preferred port; falls back to a free one when it is taken. */
  port?: number;
  /** Open the browser once the server is listening. */
  open?: boolean;
  /** Print the URL (default true). */
  announce?: boolean;
}

export interface RunningWebServer {
  port: number;
  url: string;
  tomlPath: string;
  close: () => Promise<void>;
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf-8");
    });
    req.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Match state entries to config entries by tunnel name.
 *
 * Three states matter to the page: `running` (pid alive), `exited` (it was
 * started but the process is gone - network drop, bastion reboot, ...), and
 * neither (never started here, or stopped cleanly: stopping drops the entry).
 */
function buildStatus(tomlPath: string) {
  const config = readTunnelConfigFile(tomlPath);
  const tracked: MoleHole[] = loadState();
  const liveByName = new Map<string, MoleHole>();
  const deadByName = new Map<string, MoleHole>();
  tracked.forEach((entry) => {
    (isProcessAlive(entry.pid) ? liveByName : deadByName).set(entry.name, entry);
  });

  const tunnels = config.tunnels.map((tunnel) => {
    const live = liveByName.get(tunnel.name);
    const dead = deadByName.get(tunnel.name);
    const entry = live ?? dead;
    return {
      ...tunnel,
      running: Boolean(live),
      exited: !live && Boolean(dead),
      pid: entry ? entry.pid : null,
      localPort: live ? live.localPort : tunnel.localPort ?? null,
    };
  });

  const known = new Set(config.tunnels.map((t) => t.name));
  const orphans = tracked
    .filter((entry) => !known.has(entry.name) && isProcessAlive(entry.pid))
    .map((entry) => ({ name: entry.name, localPort: entry.localPort, pid: entry.pid }));

  return { ...config, tunnels, orphans };
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? `open "${url}"` : process.platform === "win32" ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {
    /* opening a browser is best effort */
  });
}

async function listenOn(server: http.Server, port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: any) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

/** Bind the preferred port, falling back to a random free one when it is taken. */
async function bindServer(server: http.Server, preferred: number | undefined, host: string): Promise<number> {
  if (preferred && Number.isInteger(preferred) && preferred > 0) {
    try {
      await listenOn(server, preferred, host);
      return preferred;
    } catch (error: any) {
      if (error?.code !== "EADDRINUSE") throw error;
    }
  }
  const fallback = await getPort();
  await listenOn(server, fallback, host);
  return fallback;
}

/**
 * Start the config UI. Resolves once it is listening; the returned `close`
 * unregisters the lock and stops accepting connections.
 */
export async function startWebServer(options: StartWebServerOptions): Promise<RunningWebServer> {
  const tomlPath = path.resolve(options.tomlPath);
  const server = http.createServer((req, res) => {
    handleRequest(req, res, tomlPath).catch((error: any) => {
      if (!res.headersSent) sendJson(res, 500, { error: error?.message || String(error) });
    });
  });

  const port = await bindServer(server, options.port, HOST);
  const url = `http://${HOST}:${port}`;
  const lock: WebLock = { pid: process.pid, port, toml: tomlPath, startedAt: new Date().toISOString() };
  writeWebLock(lock);

  server.on("error", (error) => {
    console.error(`moleport web: ${(error as Error).message}`);
  });

  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    clearWebLock(process.pid);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  const shutdown = async (signal: string) => {
    await close();
    process.exit(signal === "SIGINT" ? 130 : 0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  if (options.announce !== false) {
    console.log(`MolePort web UI: ${url}`);
    console.log(`config: ${tomlPath}`);
    console.log(`pid: ${process.pid} (stop with: moleport web --stop, or kill ${process.pid})`);
  }
  if (options.open) openBrowser(url);

  return { port, url, tomlPath, close };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, tomlPath: string): Promise<void> {
  const url = new URL(req.url || "/", `http://${HOST}`);
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case "GET /": {
      const html = renderWebUi();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(html);
      return;
    }
    case "GET /api/health": {
      sendJson(res, 200, {
        ok: true,
        service: WEB_SERVICE_NAME,
        version: getVersion(),
        toml: tomlPath,
        port: (res.socket?.localPort as number) || undefined,
        pid: process.pid,
      });
      return;
    }
    case "GET /api/config": {
      const config = readTunnelConfigFile(tomlPath);
      sendJson(res, 200, {
        path: tomlPath,
        exists: config.exists,
        tunnels: config.tunnels,
        errors: config.errors,
      });
      return;
    }
    case "PUT /api/config": {
      const body = await readJsonBody(req);
      const { tunnels, errors } = validateTunnels(body?.tunnels);
      if (errors.length > 0) {
        sendJson(res, 400, { error: formatIssues(errors), issues: errors });
        return;
      }
      const written = writeTunnelConfigFile(tomlPath, tunnels);
      sendJson(res, 200, { path: written.path, backup: written.backup, tunnels, errors: [] });
      return;
    }
    case "POST /api/apply": {
      let configs: TunnelConfig[];
      try {
        configs = loadTunnelsFromFile(tomlPath);
      } catch (error: any) {
        sendJson(res, 400, { error: `config is invalid: ${error?.message || error}` });
        return;
      }
      const startedAt = Date.now();
      const { created, failures } = await createTunnelsBatch(configs, {
        killExisting: true,
        concurrency: 4,
      });
      sendJson(res, 200, { created, failures, tookMs: Date.now() - startedAt });
      return;
    }
    case "POST /api/tunnel/start": {
      const body = await readJsonBody(req);
      const result = await startSingleTunnel(tomlPath, String(body?.name ?? ""));
      sendJson(res, result.code, result);
      return;
    }
    case "GET /api/tunnel/log": {
      const name = url.searchParams.get("name") || "";
      const file = tunnelLogPath(name);
      sendJson(res, 200, { name, path: file, lines: readTunnelLogTail(file) });
      return;
    }
    case "POST /api/tunnel/start-all": {
      const result = await startAllTunnels(tomlPath);
      sendJson(res, result.code, result);
      return;
    }
    case "POST /api/tunnel/stop-all": {
      const result = await stopAllTunnels();
      sendJson(res, result.code, result);
      return;
    }
    case "POST /api/tunnel/stop": {
      const body = await readJsonBody(req);
      const result = await stopSingleTunnel(String(body?.name ?? ""));
      sendJson(res, result.code, result);
      return;
    }
    case "GET /api/status": {
      sendJson(res, 200, { path: tomlPath, ...buildStatus(tomlPath) });
      return;
    }
    default: {
      sendJson(res, 404, { error: `not found: ${route}` });
    }
  }
}

export interface EnsureWebUiOptions {
  tomlPath: string;
  port?: number;
  /** Kill an already running instance and start a fresh one. */
  restart?: boolean;
  open?: boolean;
}

export interface EnsureWebUiResult {
  url: string;
  port: number;
  reused: boolean;
  /** True when an old instance was stopped first. */
  replaced: boolean;
}

function tailLogFile(file: string, lines = 8): string {
  try {
    if (!fs.existsSync(file)) return "";
    const content = fs.readFileSync(file, "utf-8").trim().split("\n");
    return content.slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/** Build the argv needed to re-run this same program as a child process. */
function selfInvocation(args: string[]): { command: string; args: string[] } {
  const base = path.basename(process.execPath).toLowerCase();
  const isRuntime = base === "node" || base === "node.exe" || base === "bun" || base === "bun.exe";
  const entry = process.argv[1];
  if (isRuntime && entry) {
    return { command: process.execPath, args: [entry, ...args] };
  }
  return { command: process.execPath, args };
}

/**
 * Make sure exactly one config UI is running for `tomlPath`.
 *
 * - already running for the same file and `restart` is false -> reused
 * - running for another file, or `restart` is true -> stopped, then restarted
 * - nothing running -> a detached child is started and its URL returned
 */
export async function ensureWebUi(options: EnsureWebUiOptions): Promise<EnsureWebUiResult> {
  const tomlPath = path.resolve(options.tomlPath);
  const logFile = webLogPath();

  let replaced = false;
  const lock = readWebLock();

  if (lock) {
    const alive = isProcessAlive(lock.pid);
    const health = alive ? await probeWebServer(lock.port) : null;

    if (alive && health && health.service === WEB_SERVICE_NAME && health.toml === tomlPath && !options.restart) {
      if (options.open) openBrowser(`http://${HOST}:${lock.port}`);
      return { url: `http://${HOST}:${lock.port}`, port: lock.port, reused: true, replaced: false };
    }

    if (alive && health && health.service === WEB_SERVICE_NAME) {
      // Either a different config file or an explicit restart: replace it.
      await stopWebServer(lock);
      replaced = true;
    } else {
      // Stale lock (dead pid, or the port now belongs to someone else).
      clearWebLock(lock.pid);
    }
  }

  const args = ["web", "--toml", tomlPath];
  if (options.port) args.push("--port", String(options.port));
  const invocation = selfInvocation(args);

  let logFd: number | undefined;
  try {
    logFd = fs.openSync(logFile, "a");
  } catch {
    logFd = undefined;
  }

  const child = spawn(invocation.command, invocation.args, {
    detached: true,
    stdio: ["ignore", logFd ?? "ignore", logFd ?? "ignore"],
    env: { ...process.env, MOLEPORT_NO_UPDATE_CHECK: "1" },
  });
  if (logFd !== undefined) {
    try {
      fs.closeSync(logFd);
    } catch {
      /* ignore */
    }
  }

  let exitCode: number | null = null;
  child.on("exit", (code) => {
    exitCode = code === null ? -1 : code;
  });
  child.on("error", (error) => {
    exitCode = -1;
    void error;
  });
  child.unref();

  const childPid = child.pid ?? -1;
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    if (exitCode !== null) {
      const tail = tailLogFile(logFile);
      throw new Error(
        `web UI exited immediately (code ${exitCode}).` + (tail ? `\n${tail}` : ` see ${logFile}`)
      );
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 150));
    const current = readWebLock();
    if (current && current.pid === childPid) {
      // eslint-disable-next-line no-await-in-loop
      const health = await probeWebServer(current.port);
      if (health && health.service === WEB_SERVICE_NAME && health.toml === tomlPath) {
        if (options.open) openBrowser(`http://${HOST}:${current.port}`);
        return { url: `http://${HOST}:${current.port}`, port: current.port, reused: false, replaced };
      }
    }
  }

  throw new Error(`web UI did not become ready within 8s (log: ${logFile}, lock: ${webLockPath()})`);
}
