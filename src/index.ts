// #!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

function getVersionSync(): string {
  const { execSync } = require("child_process");
  try {
    const tag = execSync("git describe --tags --abbrev=0", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return tag;
  } catch {
    try {
      const pkg = require("../package.json");
      return pkg.version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }
}

program
  .name("moleport")
  .description("SSH tunnel manager (MoleHole)")
  .version(getVersionSync(), "-v, --version", "output the current version");

import { MoleHole } from "./types";
import { loadState } from "./state";

program
  .command("tu [target]")
  .description(
    `Create SSH tunnel, map targetHost:targetPort to a local port\n\nArguments:\n  [target]           Target in host:port format, e.g. 10.0.0.1:3306\n\nOptions:`
  )
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
    "--no-check",
    "Skip tunnel connection validation (do not check if local port is available after SSH starts)"
  )
  .action(async (target, options) => {
    const { createTunnel } = await import("./tunnel");
    const { loadState, saveState } = await import("./state");
    let tunnels: MoleHole[] = loadState();
    const skipValidate = options.noCheck === true;
    if (options.json) {
      let configs: any[];
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
        configs = JSON.parse(jsonStr);
      } catch {
        console.error("Invalid JSON");
        process.exit(1);
      }
      const results: MoleHole[] = [];
      for (const cfg of configs) {
        const exists = tunnels.find(
          (t) =>
            t.name === cfg.name ||
            (t.targetHost === cfg.targetHost && t.targetPort === cfg.targetPort)
        );
        if (exists) {
          results.push(exists);
        } else {
          const mole = await createTunnel({ ...cfg, skipValidate });
          tunnels.push(mole);
          results.push(mole);
        }
      }
      saveState(tunnels);
      console.log(JSON.stringify(results, null, 2));
    } else if (target) {
      const [targetHost, targetPortStr] = target.split(":");
      const targetPort = Number(targetPortStr);
      if (!targetHost || !targetPort) {
        console.error("target format should be host:port");
        process.exit(1);
      }
      const name = options.name || `${targetHost}:${targetPort}`;
      const exists = tunnels.find(
        (t) =>
          t.name === name ||
          (t.targetHost === targetHost && t.targetPort === targetPort)
      );
      if (exists) {
        console.log(JSON.stringify(exists, null, 2));
        return;
      }
      const mole = await createTunnel({
        name,
        targetHost,
        targetPort,
        localPort: options.localPort ? Number(options.localPort) : undefined,
        bastion: options.bastion,
        skipValidate,
      });
      tunnels.push(mole);
      saveState(tunnels);
      console.log(JSON.stringify(mole, null, 2));
    } else {
      console.error("Please specify target or --json");
      process.exit(1);
    }
  });

program
  .command("ls")
  .description(
    "List all tunnels. Shows name, local port, target, bastion, and process id."
  )
  .action(() => {
    const tunnels = loadState();
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
    const { killed, remaining } = killTunnel(
      tunnels,
      options.name,
      options.all
    );
    saveState(remaining);
    if (killed.length === 0) {
      console.log("No tunnel killed.");
    } else {
      killed.forEach((t: MoleHole) => {
        console.log(`Killed [${t.name}] (pid: ${t.pid})`);
      });
    }
  });

program.parse(process.argv);
