import fs from "fs";
import path from "path";

function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

/** Directory holding one log per tunnel. Resolved lazily so tests can move HOME. */
export function tunnelLogDir(): string {
  return path.resolve(homeDir(), ".moleport-logs");
}

/**
 * Log file for one tunnel. The name is sanitised so it can never escape the log
 * directory, whatever the config file contains.
 */
export function tunnelLogPath(name: string): string {
  const safe = String(name || "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return path.resolve(tunnelLogDir(), `${safe || "tunnel"}.log`);
}

/**
 * Open (truncating) the log for a tunnel that is about to start, and write the
 * command line so the file explains itself. Returns an fd for the child's
 * stdout/stderr, or undefined when the directory is not writable.
 */
export function startTunnelLog(name: string, commandLine: string): number | undefined {
  try {
    const file = tunnelLogPath(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(file, "w");
    fs.writeSync(fd, `${new Date().toISOString()} $ ${commandLine}\n\n`);
    return fd;
  } catch {
    return undefined;
  }
}

/** Last `lines` lines of a tunnel log, or [] when it does not exist yet. */
export function readTunnelLogTail(file: string, lines = 200, maxBytes = 32768): string[] {
  try {
    const stat = fs.statSync(file);
    if (stat.size === 0) return [];
    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }
    const text = buffer.toString("utf-8");
    const all = text.split("\n");
    // A byte-limited read can start mid-line; drop that partial first line.
    if (start > 0) all.shift();
    return all.slice(-lines).filter((line, index, arr) => !(index === arr.length - 1 && line === ""));
  } catch {
    return [];
  }
}
