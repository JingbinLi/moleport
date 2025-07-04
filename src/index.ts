// #!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("moleport")
  .description("SSH tunnel manager (MoleHole)")
  .version("0.1.0");

import { MoleHole } from "./types";
import { loadState } from "./state";
import { stdin } from "process";

program
  .command("tu [target]")
  .description("Create SSH tunnel, map targetHost:targetPort to a local port")
  .option("-p, --localPort <port>", "Local port")
  .option("-b, --bastion <bastion>", "Bastion host")
  .option("-n, --name <name>", "Tunnel name")
  .option("-j, --json <jsonString>", "Batch JSON config")
  .action(async (target, options) => {
    const { createTunnel } = await import("./tunnel");
    const { loadState, saveState } = await import("./state");
    let tunnels: MoleHole[] = loadState();
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
          const mole = await createTunnel(cfg);
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
  .description("List all tunnels")
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
  .description("Kill specified/all tunnel process")
  .option("-n, --name <name>", "Tunnel name")
  .option("--all", "Kill all")
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

