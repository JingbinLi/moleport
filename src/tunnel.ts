import { spawn } from "child_process";
import getPort from "get-port";
import { MoleHole } from "./types";

export async function validateTunnelConnection(
  localPort: number,
  retryInterval = 500,
  maxRetry = 5
): Promise<boolean> {
  const net = require("net");
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
      }, retryInterval - 50);
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
  for (let i = 0; i < maxRetry; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryConnect();
    if (ok) return true;
    if (i < maxRetry - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(res => setTimeout(res, retryInterval));
    }
  }
  return false;
}

export async function createTunnel({
  name,
  targetHost,
  targetPort,
  localPort,
  bastion,
  skipValidate,
}: {
  name: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  bastion?: string;
  skipValidate?: boolean;
}): Promise<MoleHole> {
  const port = localPort || (await getPort());
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
    const timer = setTimeout(async () => {
      if (!settled) {
        if (skipValidate) {
          settled = true;
          proc.unref();
          resolve({
            name,
            targetHost,
            targetPort,
            localPort: port,
            bastion,
            pid: proc.pid || -1,
          });
          return;
        }
        const ok = await validateTunnelConnection(port, 500, 6);
        if (ok) {
          settled = true;
          proc.unref();
          resolve({
            name,
            targetHost,
            targetPort,
            localPort: port,
            bastion,
            pid: proc.pid || -1,
          });
        } else {
          settled = true;
          if (typeof proc.pid === "number") {
            try {
              process.kill(proc.pid, "SIGKILL");
            } catch {}
          }
          reject(new Error("SSH tunnel started but local port not available"));
        }
      }
    }, 1000);
    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ssh tunnel failed, exit code: ${code}`));
      }
    });
    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}
