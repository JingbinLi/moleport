import { createTunnel, DEFAULT_TUNNEL_TIMEOUT_MS } from "./tunnel";
import { killTunnel } from "./kill";
import { loadState, saveState } from "./state";
import { MoleHole } from "./types";
import { TunnelConfig } from "./toml-config";

export interface BatchFailure {
  name: string;
  error: string;
}

export interface BatchResult {
  created: MoleHole[];
  failures: BatchFailure[];
}

export interface BatchOptions {
  /** Skip waiting for each local port to accept connections. */
  skipValidate?: boolean;
  /** Default per-tunnel local port budget (ms); a per-entry `timeoutMs` wins. */
  timeoutMs?: number;
  /** How many tunnels to create at once. Defaults to 1 (sequential). */
  concurrency?: number;
  /** Kill every tunnel tracked in the state file before creating the new ones. */
  killExisting?: boolean;
  onFailure?: (failure: BatchFailure) => void;
}

/**
 * Create a batch of tunnels while keeping the state file truthful.
 *
 * One failing entry neither aborts the batch nor loses the tunnels that were
 * created: every success is persisted immediately, so a crash mid-batch never
 * leaves an untracked ssh process holding a local port.
 */
export async function createTunnelsBatch(configs: TunnelConfig[], options: BatchOptions = {}): Promise<BatchResult> {
  const {
    skipValidate,
    timeoutMs = DEFAULT_TUNNEL_TIMEOUT_MS,
    concurrency = 1,
    killExisting = false,
    onFailure,
  } = options;

  let tunnels = loadState();
  if (killExisting) {
    const { remaining } = killTunnel(tunnels, undefined, true);
    tunnels = remaining;
    saveState(tunnels);
  }

  const created: MoleHole[] = [];
  const failures: BatchFailure[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < configs.length) {
      const cfg = configs[cursor++];
      const label = cfg.name || `${cfg.targetHost}:${cfg.targetPort}`;
      try {
        // A per-entry `timeoutMs` from the config file wins over the batch default.
        const mole = await createTunnel({
          timeoutMs,
          ...cfg,
          skipValidate,
        });
        tunnels.push(mole);
        created.push(mole);
        saveState(tunnels);
      } catch (error: any) {
        const failure: BatchFailure = { name: label, error: error?.message || String(error) };
        failures.push(failure);
        if (onFailure) onFailure(failure);
      }
    }
  };

  const workers = Math.max(1, Math.min(concurrency, configs.length || 1));
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return { created, failures };
}
