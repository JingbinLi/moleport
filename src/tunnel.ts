import { spawn } from "child_process";
import getPort from "get-port";
import { MoleHole } from "./types";

/** Default time to keep polling a tunnel's local port until it accepts connections. */
export const DEFAULT_TUNNEL_TIMEOUT_MS = 10000;

/** Grace period after spawning ssh before the local port is polled. */
export const INITIAL_GRACE_MS = 1000;

export interface ValidateTunnelOptions {
  /** Total time to poll the local port (ms). Defaults to DEFAULT_TUNNEL_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Delay between two connection attempts (ms). Defaults to 500. */
  retryIntervalMs?: number;
}

export async function validateTunnelConnection(
  localPort: number,
  options: ValidateTunnelOptions = {}
): Promise<boolean> {
  const net = require("net");
  const timeoutMs =
    options.timeoutMs && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TUNNEL_TIMEOUT_MS;
  const retryIntervalMs =
    options.retryIntervalMs && options.retryIntervalMs > 0
      ? options.retryIntervalMs
      : 500;
  const connectTimeoutMs = Math.max(50, retryIntervalMs - 50);

  function tryConnect(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(false);
        }
      }, connectTimeoutMs);
      socket.connect(localPort, "127.0.0.1", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.end();
          resolve(true);
        }
      });
      socket.on("error", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      });
    });
  }

  // Poll until the port accepts a connection or the overall deadline expires.
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryConnect();
    if (ok) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) =>
      setTimeout(res, Math.min(retryIntervalMs, remaining))
    );
  }
}

/**
 * Check whether nothing is already listening on the given local port.
 * Gives a fast, actionable error instead of a slow validation timeout when a
 * leftover tunnel (or any other process) still holds the port.
 */
export async function isLocalPortAvailable(localPort: number): Promise<boolean> {
  const net = require("net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(localPort, "0.0.0.0");
  });
}

export async function createTunnel({
  name,
  targetHost,
  targetPort,
  localPort,
  bastion,
  skipValidate,
  timeoutMs,
}: {
  name: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  bastion?: string;
  skipValidate?: boolean;
  /** How long to wait for the local port to become available (ms). */
  timeoutMs?: number;
}): Promise<MoleHole> {
  const port = localPort || (await getPort());
  const budgetMs =
    timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_TUNNEL_TIMEOUT_MS;

  if (!skipValidate && !(await isLocalPortAvailable(port))) {
    throw new Error(
      `local port ${port} is already in use - a leftover tunnel or another process holds it ` +
        `(check: moleport ls | lsof -nP -iTCP:${port} -sTCP:LISTEN, free it: moleport kill --all)`
    );
  }

  const sshArgs = [
    "-N",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `0.0.0.0:${port}:${targetHost}:${targetPort}`,
  ];
  if (bastion) {
    sshArgs.push(bastion);
  } else {
    sshArgs.push(targetHost);
  }
  return new Promise<MoleHole>((resolve, reject) => {
    const proc = spawn("ssh", sshArgs, {
      detached: true,
      stdio: "ignore",
    });
    let settled = false;
    const finish = (error?: Error, killProcess = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        if (killProcess && typeof proc.pid === "number") {
          try {
            process.kill(proc.pid, "SIGKILL");
          } catch {}
        }
        reject(error);
        return;
      }
      proc.unref();
      resolve({
        name,
        targetHost,
        targetPort,
        localPort: port,
        bastion,
        pid: proc.pid || -1,
      });
    };
    const timer = setTimeout(async () => {
      if (settled) return;
      if (skipValidate) {
        finish();
        return;
      }
      const ok = await validateTunnelConnection(port, { timeoutMs: budgetMs });
      if (settled) return;
      if (ok) {
        finish();
      } else {
        finish(
          new Error(
            `ssh tunnel started but local port ${port} did not accept connections within ${budgetMs}ms`
          ),
          true
        );
      }
    }, INITIAL_GRACE_MS);
    proc.on("exit", (code) => {
      finish(new Error(`ssh tunnel failed, exit code: ${code}`));
    });
    proc.on("error", (err) => {
      finish(err);
    });
  });
}
