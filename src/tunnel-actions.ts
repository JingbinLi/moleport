import { MoleHole } from "./types";
import { loadState, saveState } from "./state";
import { killTunnel } from "./kill";
import { createTunnel, DEFAULT_TUNNEL_TIMEOUT_MS } from "./tunnel";
import { formatIssues, readTunnelConfigFile } from "./toml-config";
import { isProcessAlive } from "./web-lock";

export interface TunnelActionResult {
  ok: boolean;
  /** HTTP status the route reports for this outcome. */
  code: number;
  error?: string;
  tunnel?: MoleHole;
  /** started | already-running | killed | stale | not-running */
  reason?: string;
}

/**
 * Serialise the state read-modify-write. Two quick clicks on different rows
 * must not lose one of the two entries to a last-write-wins race.
 */
let stateQueue: Promise<unknown> = Promise.resolve();
function withState<T>(fn: () => T): Promise<T> {
  const next = stateQueue.then(fn, fn);
  stateQueue = next.catch(() => undefined);
  return next as Promise<T>;
}

/** Names with a start in flight, so a double click cannot spawn two ssh processes. */
const starting = new Set<string>();

/**
 * Start one tunnel from its entry in the config file, leaving every other
 * tunnel alone. Already-running is reported instead of spawning a duplicate.
 */
export async function startSingleTunnel(tomlPath: string, name: string): Promise<TunnelActionResult> {
  if (!name) return { ok: false, code: 400, error: "name is required" };

  const config = readTunnelConfigFile(tomlPath);
  if (config.errors.length > 0) {
    return { ok: false, code: 400, error: `config is invalid: ${formatIssues(config.errors)}` };
  }
  const cfg = config.tunnels.find((t) => t.name === name);
  if (!cfg) return { ok: false, code: 404, error: `no tunnel named "${name}" in the config file` };

  const running = loadState().find((t) => t.name === name);
  if (running && isProcessAlive(running.pid)) {
    return { ok: true, code: 200, tunnel: running, reason: "already-running" };
  }

  if (starting.has(name)) return { ok: false, code: 409, error: `"${name}" is already starting` };
  starting.add(name);
  try {
    const mole = await createTunnel({
      ...cfg,
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TUNNEL_TIMEOUT_MS,
    });
    await withState(() => {
      // Drop a stale entry with the same name before recording the new process.
      const next = loadState().filter((t) => t.name !== name);
      next.push(mole);
      saveState(next);
    });
    return { ok: true, code: 200, tunnel: mole, reason: "started" };
  } catch (error: any) {
    return { ok: false, code: 400, error: error?.message || String(error) };
  } finally {
    starting.delete(name);
  }
}

/** Stop a single tunnel by name; every other tunnel keeps running. */
export async function stopSingleTunnel(name: string): Promise<TunnelActionResult> {
  if (!name) return { ok: false, code: 400, error: "name is required" };

  return withState((): TunnelActionResult => {
    const tunnels = loadState();
    const target = tunnels.find((t) => t.name === name);
    if (!target) return { ok: true, code: 200, reason: "not-running" };

    // Stale entries (pid already gone) are just dropped, never signalled twice.
    const wasAlive = isProcessAlive(target.pid);
    const { remaining } = killTunnel(tunnels, name, false);
    saveState(remaining);
    return { ok: true, code: 200, tunnel: target, reason: wasAlive ? "killed" : "stale" };
  });
}

export interface StartAllFailure {
  name: string;
  error: string;
}

export interface StartAllResult {
  ok: boolean;
  /** HTTP status the route reports for this outcome. */
  code: number;
  error?: string;
  /** Tunnels this call actually brought up. */
  started: MoleHole[];
  /** Tunnels left alone because they were already running (or already starting). */
  skipped: string[];
  failures: StartAllFailure[];
  tookMs: number;
}

/** How many tunnels "start all" brings up at once - keeps the ssh fan-out modest. */
export const START_ALL_CONCURRENCY = 4;

/**
 * Bring up every tunnel in the config file that is not running yet.
 *
 * Unlike `moleport --toml` (and the page's "保存并应用"), this is additive: a
 * tunnel that is already running is skipped, never restarted, so one dropped
 * tunnel can be recovered without touching the healthy ones. Every tunnel goes
 * through startSingleTunnel, so the double-click guard and the state
 * bookkeeping stay in one place.
 */
export async function startAllTunnels(tomlPath: string): Promise<StartAllResult> {
  const startedAt = Date.now();
  const config = readTunnelConfigFile(tomlPath);
  if (config.errors.length > 0) {
    return {
      ok: false,
      code: 400,
      error: `config is invalid: ${formatIssues(config.errors)}`,
      started: [],
      skipped: [],
      failures: [],
      tookMs: Date.now() - startedAt,
    };
  }

  const running = new Set(
    loadState()
      .filter((entry) => isProcessAlive(entry.pid))
      .map((entry) => entry.name)
  );
  const skipped = config.tunnels.filter((t) => running.has(t.name)).map((t) => t.name);
  const pending = config.tunnels.filter((t) => !running.has(t.name));

  const started: MoleHole[] = [];
  const failures: StartAllFailure[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      const cfg = pending[cursor++];
      // eslint-disable-next-line no-await-in-loop
      const result = await startSingleTunnel(tomlPath, cfg.name);
      if (result.ok && result.tunnel && result.reason === "started") {
        started.push(result.tunnel);
      } else if (result.ok || result.code === 409) {
        // Already running, or a concurrent click got there first: leave it alone.
        skipped.push(cfg.name);
      } else {
        failures.push({ name: cfg.name, error: result.error || "start failed" });
      }
    }
  };

  const workers = Math.max(1, Math.min(START_ALL_CONCURRENCY, pending.length || 1));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return {
    ok: failures.length === 0,
    code: 200,
    started,
    skipped,
    failures,
    tookMs: Date.now() - startedAt,
  };
}
