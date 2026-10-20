import fs from "fs";
import http from "http";
import path from "path";

/**
 * Info about the detached web UI process. Stored in `~/.moleport-web.json` so a
 * second `moleport --toml ...` can find (and reuse, or replace) the first one.
 */
export interface WebLock {
  pid: number;
  port: number;
  /** Absolute path of the TOML file this server edits. */
  toml: string;
  startedAt: string;
}

export interface WebHealth {
  ok: boolean;
  service?: string;
  version?: string;
  toml?: string;
  port?: number;
  pid?: number;
}

/** Marker used to make sure we never kill a stranger that happens to hold the port. */
export const WEB_SERVICE_NAME = "moleport-web";

function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

/** Path of the lock file. Resolved lazily so tests can point HOME elsewhere. */
export function webLockPath(): string {
  return path.resolve(homeDir(), ".moleport-web.json");
}

/** Path of the log file the detached server writes to. */
export function webLogPath(): string {
  return path.resolve(homeDir(), ".moleport-web.log");
}

export function readWebLock(): WebLock | null {
  const file = webLockPath();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as WebLock;
    if (!parsed || typeof parsed.pid !== "number" || typeof parsed.port !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWebLock(lock: WebLock): void {
  const file = webLockPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(lock, null, 2), "utf-8");
}

/**
 * Remove the lock file. When `pid` is given the file is only removed if it still
 * belongs to that process, so a freshly started server is never unregistered by
 * the handler of an older one.
 */
export function clearWebLock(pid?: number): void {
  const file = webLockPath();
  if (!fs.existsSync(file)) return;
  if (pid !== undefined) {
    const current = readWebLock();
    if (current && current.pid !== pid) return;
  }
  try {
    fs.unlinkSync(file);
  } catch {
    /* already gone */
  }
}

/** `kill -0`: true when the process exists and we are allowed to signal it. */
export function isProcessAlive(pid: number): boolean {
  if (!pid || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === "EPERM";
  }
}

/** Ask the server for its health payload; null when nothing answers in time. */
export function probeWebServer(port: number, timeoutMs = 800): Promise<WebHealth | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: WebHealth | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const req = http.get(
      { host: "127.0.0.1", port, path: "/api/health", timeout: timeoutMs },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return done(null);
          try {
            const parsed = JSON.parse(body) as WebHealth;
            done(parsed && parsed.service === WEB_SERVICE_NAME ? parsed : null);
          } catch {
            done(null);
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      done(null);
    });
    req.on("error", () => done(null));
  });
}

/**
 * Find a live web UI for this config file.
 *
 * The lock file is the primary source. A stale lock (process gone, or the port
 * now answers as something else) is cleaned up. When there is no lock at all we
 * still probe the preferred port, so an orphaned server started by hand is
 * reused instead of piling up a second one.
 */
export async function getRunningWebServer(tomlPath: string, preferredPort?: number): Promise<WebLock | null> {
  const target = path.resolve(tomlPath);
  const lock = readWebLock();

  if (lock) {
    if (!isProcessAlive(lock.pid)) {
      clearWebLock(lock.pid);
    } else {
      const health = await probeWebServer(lock.port);
      if (health && health.toml === target) {
        return { ...lock, pid: health.pid ?? lock.pid, port: health.port ?? lock.port };
      }
      if (health && health.toml !== target) {
        return lock; // alive, but editing a different file - caller decides
      }
      // Lock says alive but nothing answers: treat as stale.
      clearWebLock(lock.pid);
    }
  }

  if (preferredPort) {
    const health = await probeWebServer(preferredPort);
    if (health && health.toml === target) {
      const discovered: WebLock = {
        pid: health.pid ?? -1,
        port: health.port ?? preferredPort,
        toml: target,
        startedAt: "",
      };
      if (discovered.pid > 0) writeWebLock(discovered);
      return discovered;
    }
  }

  return null;
}

/**
 * Stop a server we verified to be moleport's. Falls back to SIGKILL when the
 * graceful shutdown does not finish in time.
 */
export async function stopWebServer(lock: WebLock, timeoutMs = 3000): Promise<boolean> {
  const health = await probeWebServer(lock.port);
  const isOurs = health && health.service === WEB_SERVICE_NAME;
  const pid = health?.pid ?? lock.pid;

  if (isOurs && pid > 0) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (isProcessAlive(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* race with exit */
      }
    }
  }

  clearWebLock(lock.pid);
  return true;
}

/** Stop whatever web UI the lock file points at, if it is really one of ours. */
export async function stopRunningWebServer(): Promise<{ stopped: boolean; port?: number; toml?: string }> {
  const lock = readWebLock();
  if (!lock) return { stopped: false };
  const health = await probeWebServer(lock.port);
  if (!health || health.service !== WEB_SERVICE_NAME) {
    clearWebLock(lock.pid);
    return { stopped: false };
  }
  await stopWebServer(lock);
  return { stopped: true, port: lock.port, toml: health.toml ?? lock.toml };
}
