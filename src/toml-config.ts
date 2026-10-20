import fs from "fs";
import path from "path";
import { parse as parseToml } from "toml";

/** One tunnel entry as it appears in a tunnels TOML file. */
export interface TunnelConfig {
  name: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  bastion?: string;
  timeoutMs?: number;
  /** Unknown extra keys are preserved so a hand-written file survives a save. */
  [key: string]: unknown;
}

export interface ValidationIssue {
  /** Index of the offending tunnel in the file, 0-based. */
  index: number;
  field?: string;
  message: string;
}

const MIN_PORT = 1;
const MAX_PORT = 65535;

/** Key order used when writing a file; unknown keys keep their original order after these. */
const KEY_ORDER = ["name", "targetHost", "targetPort", "localPort", "bastion", "timeoutMs"];

/**
 * Parse a tunnels TOML document. Accepts both `[[tunnels]]` arrays and the
 * object form `tunnels = [...]`.
 */
export function parseTunnelConfig(text: string): unknown[] {
  const parsed = parseToml(text) as unknown;
  if (Array.isArray(parsed)) return parsed;
  const maybe = parsed as { tunnels?: unknown } | null;
  if (maybe && Array.isArray(maybe.tunnels)) return maybe.tunnels;
  throw new Error("TOML must export an array of tunnels or an object like { tunnels = [] }");
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT;
}

/**
 * Normalise and validate raw tunnel entries.
 *
 * Returns both the usable tunnels and every issue found; callers decide whether
 * an issue is fatal (the CLI refuses to run, the web UI shows a message).
 */
export function validateTunnels(input: unknown): { tunnels: TunnelConfig[]; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const tunnels: TunnelConfig[] = [];

  if (!Array.isArray(input)) {
    errors.push({ index: -1, message: "tunnels must be an array" });
    return { tunnels, errors };
  }

  const seenNames = new Set<string>();

  input.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({ index, message: "entry must be a table" });
      return;
    }
    const entry = raw as Record<string, unknown>;
    const tunnel = { ...entry } as TunnelConfig;

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) {
      errors.push({ index, field: "name", message: "name is required" });
    } else if (seenNames.has(name)) {
      errors.push({ index, field: "name", message: `duplicate name "${name}"` });
    } else {
      seenNames.add(name);
      tunnel.name = name;
    }

    const targetHost = typeof entry.targetHost === "string" ? entry.targetHost.trim() : "";
    if (!targetHost) {
      errors.push({ index, field: "targetHost", message: "targetHost is required" });
    } else if (/\s/.test(targetHost)) {
      errors.push({ index, field: "targetHost", message: "targetHost must not contain spaces" });
    } else {
      tunnel.targetHost = targetHost;
    }

    if (!isPort(entry.targetPort)) {
      errors.push({
        index,
        field: "targetPort",
        message: `targetPort must be an integer between ${MIN_PORT} and ${MAX_PORT}`,
      });
    } else {
      tunnel.targetPort = entry.targetPort;
    }

    if (entry.localPort !== undefined && entry.localPort !== null) {
      if (!isPort(entry.localPort)) {
        errors.push({
          index,
          field: "localPort",
          message: `localPort must be an integer between ${MIN_PORT} and ${MAX_PORT}`,
        });
      } else {
        tunnel.localPort = entry.localPort;
      }
    } else {
      delete tunnel.localPort;
    }

    if (entry.bastion !== undefined && entry.bastion !== null) {
      const bastion = typeof entry.bastion === "string" ? entry.bastion.trim() : "";
      if (!bastion) {
        delete tunnel.bastion;
      } else {
        tunnel.bastion = bastion;
      }
    } else {
      delete tunnel.bastion;
    }

    if (entry.timeoutMs !== undefined && entry.timeoutMs !== null) {
      if (
        typeof entry.timeoutMs !== "number" ||
        !Number.isFinite(entry.timeoutMs) ||
        entry.timeoutMs <= 0
      ) {
        errors.push({ index, field: "timeoutMs", message: "timeoutMs must be a positive number" });
      } else {
        tunnel.timeoutMs = entry.timeoutMs;
      }
    } else {
      delete tunnel.timeoutMs;
    }

    tunnels.push(tunnel);
  });

  return { tunnels, errors };
}

/** Compact human readable rendering of validation issues. */
export function formatIssues(errors: ValidationIssue[]): string {
  return errors
    .map((e) => (e.index >= 0 ? `tunnel #${e.index + 1}${e.field ? `.${e.field}` : ""}: ${e.message}` : e.message))
    .join("\n");
}

function serializeKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map(serializeValue).filter((v): v is string => v !== null);
    return `[${items.join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs: string[] = [];
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      const rendered = serializeValue(v);
      if (rendered !== null) pairs.push(`${serializeKey(k)} = ${rendered}`);
    });
    return `{ ${pairs.join(", ")} }`;
  }
  return null;
}

/**
 * Render tunnels back to TOML. Comments in the previous file are not preserved
 * (TOML parsers drop them); callers keep a `.bak` copy before overwriting.
 */
export function serializeTunnelConfig(tunnels: TunnelConfig[]): string {
  const blocks = tunnels.map((tunnel) => {
    const keys: string[] = [];
    KEY_ORDER.forEach((k) => {
      if (!keys.includes(k)) keys.push(k);
    });
    Object.keys(tunnel).forEach((k) => {
      if (!keys.includes(k)) keys.push(k);
    });

    const rows: { key: string; value: string }[] = [];
    keys.forEach((key) => {
      const rendered = serializeValue(tunnel[key]);
      if (rendered !== null) rows.push({ key, value: rendered });
    });
    const width = rows.reduce((max, row) => Math.max(max, row.key.length), 0);
    const body = rows
      .map((row) => `${row.key.padEnd(width)} = ${row.value}`)
      .join("\n");
    return `[[tunnels]]\n${body}`;
  });

  const header = [
    "# moleport tunnels configuration",
    "# Managed by the moleport web UI - saving rewrites this file",
    "# and keeps the previous version next to it as *.bak",
  ].join("\n");

  return `${header}\n\n${blocks.join("\n\n")}\n`;
}

export interface WriteResult {
  path: string;
  backup?: string;
}

/** Write the tunnels file atomically, keeping the previous content as `<file>.bak`. */
export function writeTunnelConfigFile(filePath: string, tunnels: TunnelConfig[]): WriteResult {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  let backup: string | undefined;
  if (fs.existsSync(resolved)) {
    backup = `${resolved}.bak`;
    fs.copyFileSync(resolved, backup);
  }

  const tmp = `${resolved}.tmp`;
  fs.writeFileSync(tmp, serializeTunnelConfig(tunnels), "utf-8");
  fs.renameSync(tmp, resolved);

  return { path: resolved, backup };
}

/** Read + parse + validate a tunnels file. Throws with a readable message. */
export function loadTunnelsFromFile(filePath: string): TunnelConfig[] {
  const text = fs.readFileSync(path.resolve(filePath), "utf-8");
  const { tunnels, errors } = validateTunnels(parseTunnelConfig(text));
  if (errors.length > 0) {
    throw new Error(formatIssues(errors));
  }
  return tunnels;
}

export interface TunnelConfigFile {
  exists: boolean;
  tunnels: TunnelConfig[];
  errors: ValidationIssue[];
}

/**
 * Read the config file without throwing: a broken file is reported as errors so
 * the UI can show them instead of overwriting the user's work.
 */
export function readTunnelConfigFile(filePath: string): TunnelConfigFile {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { exists: false, tunnels: [], errors: [] };
  }
  try {
    const text = fs.readFileSync(resolved, "utf-8");
    const { tunnels, errors } = validateTunnels(parseTunnelConfig(text));
    return { exists: true, tunnels, errors };
  } catch (error: any) {
    return { exists: true, tunnels: [], errors: [{ index: -1, message: error?.message || String(error) }] };
  }
}
