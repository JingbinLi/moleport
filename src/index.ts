// #!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import { getVersion } from "./version";
import { MoleHole } from "./types";
import { TunnelConfig } from "./toml-config";

const program = new Command();
// Required so that `moleport tu <target> -p/-b/-n ...` reaches the `tu` subcommand:
// without this the root command (which also declares [target] and the same options)
// swallows every flag that follows the subcommand name.
program.enablePositionalOptions();

// Check for updates silently at startup. The detached web UI helper sets
// MOLEPORT_NO_UPDATE_CHECK so re-running moleport does not hammer GitHub.
async function checkForUpdatesAtStartup(): Promise<void> {
  try {
    const { checkForUpdates } = await import("./update");
    await checkForUpdates(true); // Silent check
  } catch {
    // Silently fail if update check fails
  }
}

const updateCheckDisabled = ["1", "true"].includes(
  String(process.env.MOLEPORT_NO_UPDATE_CHECK || "").toLowerCase()
);
if (!updateCheckDisabled) {
  // Run update check at startup (non-blocking)
  checkForUpdatesAtStartup();
}

program
  .name("moleport")
  .description("SSH tunnel manager (MoleHole)")
  .version(getVersion(), "-v, --version", "output the current version");

const TIMEOUT_OPTION_DESCRIPTION =
  "How long to wait for each tunnel's local port to become available, in ms (default: 10000)";

const WEB_PORT_DESCRIPTION =
  "Port for the web config UI (default: 7788, or $MOLEPORT_WEB_PORT)";

/**
 * Options that control the web config UI. Applied to every command that accepts
 * `--toml`, so `moleport --toml ...` and `moleport tu --toml ...` behave alike.
 */
function withWebOptions(command: Command): Command {
  return command
    .option("--web-port <port>", WEB_PORT_DESCRIPTION)
    .option("--no-web", "Do not start the web config UI")
    .option("--web-restart", "Restart the web config UI even if it is already running")
    .option("--web-open", "Open the web config UI in the default browser");
}

function webPortFrom(options: any): number | undefined {
  const raw = options?.webPort ?? process.env.MOLEPORT_WEB_PORT;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

/**
 * Start (or reuse) the web config UI for `--toml`.
 *
 * A failure here must never fail the tunnel command: the tunnels are already up
 * and the UI is a convenience, so problems are reported as a warning only.
 */
async function maybeStartWebUi(options: any): Promise<void> {
  if (options?.web === false || !options?.toml) return;
  try {
    const { ensureWebUi } = await import("./web-server");
    const result = await ensureWebUi({
      tomlPath: options.toml,
      port: webPortFrom(options),
      restart: options.webRestart === true,
      open: options.webOpen === true,
    });
    const label = result.reused ? "already running" : result.replaced ? "restarted" : "started";
    console.error(`🌐 web UI ${label}: ${result.url}`);
    console.error(`   config: ${path.resolve(options.toml)}`);
  } catch (error: any) {
    console.error(`⚠️  web UI not started: ${error?.message || error}`);
  }
}

// Shared tunnel creation logic
async function handleTunnelCreation(target: string | undefined, options: any) {
  const { createTunnelsBatch } = await import("./batch");
  const { DEFAULT_TUNNEL_TIMEOUT_MS } = await import("./tunnel");
  const { loadState, saveState } = await import("./state");
  const { killTunnel } = await import("./kill");

  // commander turns `--no-check` into `options.check === false`; `noCheck` is
  // kept for backwards compatibility with older call sites.
  const skipValidate = options.check === false || options.noCheck === true;
  const defaultTimeoutMs = options.timeout ? Number(options.timeout) : DEFAULT_TUNNEL_TIMEOUT_MS;
  const onFailure = (failure: { name: string; error: string }) => {
    console.error(`⚠️  [${failure.name}] ${failure.error}`);
  };

  /**
   * Build the batch from whatever source the user asked for. Parsing happens
   * before any tunnel is killed, so a typo in the config file can no longer
   * take down a working set of tunnels.
   */
  let configError: string | undefined;

  const resolveConfigs = async (): Promise<TunnelConfig[] | undefined> => {
    if (options.toml) {
      const { loadTunnelsFromFile } = await import("./toml-config");
      const { existsSync } = await import("fs");
      const tomlPath = path.resolve(options.toml);
      if (!existsSync(tomlPath)) {
        configError = `config file not found: ${tomlPath} (the web UI can create it)`;
        return undefined;
      }
      try {
        return loadTunnelsFromFile(tomlPath);
      } catch (e: any) {
        configError = `invalid TOML: ${e?.message || e}`;
        return undefined;
      }
    }
    if (options.json) {
      let jsonStr = options.json;
      if (jsonStr === "-") {
        jsonStr = await new Promise<string>((resolve, reject) => {
          let data = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", (chunk) => (data += chunk));
          process.stdin.on("end", () => resolve(data));
          process.stdin.on("error", reject);
        });
      }
      try {
        const parsed = JSON.parse(jsonStr) as TunnelConfig[];
        if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
        return parsed;
      } catch (e: any) {
        console.error("Invalid JSON:", e?.message || e);
        process.exit(1);
      }
    }
    return undefined;
  };

  const configs = await resolveConfigs();

  if (configError) {
    // Still bring up the web UI: that is where the file gets fixed or created.
    console.error(`❌ ${configError}`);
    await maybeStartWebUi(options);
    process.exitCode = 1;
    return;
  }

  if (configs) {
    // Start the editor before the tunnels so the URL is available while the
    // batch is still connecting (slow bastions can take tens of seconds).
    if (options.toml) await maybeStartWebUi(options);

    // A single failure must neither abort the batch nor lose track of the
    // tunnels that were created successfully (which would leave untracked ssh
    // processes holding their local ports).
    const { created, failures } = await createTunnelsBatch(configs, {
      skipValidate,
      timeoutMs: defaultTimeoutMs,
      killExisting: true,
      onFailure,
    });
    console.log(JSON.stringify(created, null, 2));
    if (failures.length > 0) {
      console.error(
        `❌ ${failures.length}/${configs.length} tunnel(s) failed: ` +
          `${failures.map((f) => f.name).join(", ")} (active tunnels: moleport ls)`
      );
      process.exitCode = 1;
    }
    return;
  }

  if (target) {
    const [targetHost, targetPortStr] = target.split(":");
    const targetPort = Number(targetPortStr);
    if (!targetHost || !targetPort) {
      console.error("target format should be host:port");
      process.exit(1);
    }
    let tunnels: MoleHole[] = loadState();
    // Kill all tunnels before creating a new one (existing behaviour).
    const killResult = killTunnel(tunnels, undefined, true);
    tunnels = killResult.remaining;
    saveState(tunnels);

    const name = options.name || `${targetHost}:${targetPort}`;
    const exists = tunnels.find(
      (t) => t.name === name || (t.targetHost === targetHost && t.targetPort === targetPort)
    );
    if (exists) {
      console.log(JSON.stringify(exists, null, 2));
      return;
    }
    const { created, failures } = await createTunnelsBatch(
      [
        {
          name,
          targetHost,
          targetPort,
          localPort: options.localPort ? Number(options.localPort) : undefined,
          bastion: options.bastion,
        },
      ],
      { skipValidate, timeoutMs: defaultTimeoutMs, onFailure }
    );
    if (created.length > 0) console.log(JSON.stringify(created[0], null, 2));
    if (failures.length > 0) {
      console.error(`❌ [${name}] ${failures[0].error}`);
      process.exitCode = 1;
    }
    return;
  }

  // If no target, json, or toml provided, show help
  program.help();
}

/** Tunnel creation options shared by `tu` and the root command. */
function withTunnelOptions(command: Command): Command {
  return withWebOptions(
    command
      .option(
        "-p, --localPort <port>",
        "Local port to bind on localhost (default: random available port)"
      )
      .option(
        "-b, --bastion <bastion>",
        "Bastion host for SSH jump, e.g. user@bastion-host"
      )
      .option(
        "-n, --name <name>",
        "Custom tunnel name (default: targetHost:targetPort)"
      )
      .option(
        "-j, --json <jsonString>",
        "Batch create tunnels from JSON array. Use '-' to read from stdin. Each item: {name, targetHost, targetPort, [localPort], [bastion]}"
      )
      .option(
        "-t, --toml <tomlPath>",
        "Batch create tunnels from a TOML config file. Each item: {name, targetHost, targetPort, [localPort], [bastion]}"
      )
      .option("--timeout <ms>", TIMEOUT_OPTION_DESCRIPTION)
      .option(
        "--no-check",
        "Skip tunnel connection validation (do not check if local port is available after SSH starts)"
      )
  );
}

const tuCommand = program
  .command("tu [target]")
  .description(
    `Create SSH tunnel, map targetHost:targetPort to a local port\n\nArguments:\n  [target]           Target in host:port format, e.g. 10.0.0.1:3306\n\nOptions:`
  );
withTunnelOptions(tuCommand).action(handleTunnelCreation);

// Also support direct usage without 'tu' subcommand
withTunnelOptions(
  program.argument("[target]", "Target in host:port format, e.g. 10.0.0.1:3306")
).action(handleTunnelCreation);

program
  .command("web")
  .description(
    "Run or manage the web config UI for a tunnels TOML file.\n\n" +
      "The same UI is started automatically by `moleport --toml <file>`."
  )
  .option("-t, --toml <tomlPath>", "TOML config file to edit")
  .option("-p, --port <port>", WEB_PORT_DESCRIPTION)
  .option("--open", "Open the web config UI in the default browser")
  .option("--stop", "Stop a running web config UI instead of starting one")
  .option("--status", "Show whether a web config UI is running")
  .action(async (options) => {
    const { startWebServer, DEFAULT_WEB_PORT } = await import("./web-server");
    const { stopRunningWebServer, readWebLock, probeWebServer, isProcessAlive } = await import("./web-lock");

    if (options.status || options.stop) {
      const lock = readWebLock();
      const health = lock ? await probeWebServer(lock.port) : null;
      const running = Boolean(lock && isProcessAlive(lock.pid) && health);
      if (options.status) {
        if (!running) {
          console.log("web UI: not running");
        } else {
          console.log(`web UI: http://127.0.0.1:${lock!.port} (pid ${health!.pid ?? lock!.pid})`);
          console.log(`config: ${health!.toml ?? lock!.toml}`);
        }
        return;
      }
      const result = await stopRunningWebServer();
      console.log(result.stopped ? `web UI stopped (port ${result.port})` : "web UI: not running");
      return;
    }

    if (!options.toml) {
      console.error("--toml <tomlPath> is required (or use --stop / --status)");
      process.exit(1);
    }
    const port = options.port ? Number(options.port) : webPortFrom({}) ?? DEFAULT_WEB_PORT;
    await startWebServer({ tomlPath: options.toml, port, open: options.open });
  });

program
  .command("ls")
  .description(
    "List all tunnels. Shows name, local port, target, bastion, and process id."
  )
  .action(() => {
    const { loadState } = require("./state");
    const tunnels: MoleHole[] = loadState();
    if (tunnels.length === 0) {
      console.log("No tunnels found.");
    } else {
      tunnels.forEach((t) => {
        console.log(
          `[${t.name}] ${t.localPort} -> ${t.targetHost}:${t.targetPort} via ${
            t.bastion || "direct"
          } (pid: ${t.pid})`
        );
      });
    }
  });

program
  .command("kill")
  .description(
    "Kill specified or all tunnel processes. Use --name to kill by tunnel name, or --all to kill all."
  )
  .option("-n, --name <name>", "Tunnel name to kill")
  .option("--all", "Kill all tunnels")
  .action((options) => {
    const { loadState, saveState } = require("./state");
    const { killTunnel } = require("./kill");
    const tunnels = loadState();
    if (!options.name && !options.all) {
      console.error("Please specify --name or --all");
      process.exit(1);
    }
    const { killed, remaining } = killTunnel(tunnels, options.name, options.all);
    saveState(remaining);
    if (killed.length === 0) {
      console.log("No tunnel killed.");
    } else {
      killed.forEach((t: MoleHole) => {
        console.log(`Killed [${t.name}] (pid: ${t.pid})`);
      });
    }
  });

program
  .command("update")
  .description("Check for updates and install the latest version")
  .option("--check-only", "Only check for updates without installing")
  .action(async (options) => {
    const { checkForUpdates, updateBinary } = await import("./update");
    try {
      if (options.checkOnly) {
        await checkForUpdates(false);
      } else {
        await updateBinary();
      }
    } catch (error: any) {
      console.error(`❌ Update failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
