import fs from "fs";
import net from "net";
import path from "path";
import { ChildProcess, spawn } from "child_process";
import { startAllTunnels, startSingleTunnel, stopSingleTunnel } from "../src/tunnel-actions";
import { loadState, saveState } from "../src/state";
import { isProcessAlive } from "../src/web-lock";

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

function listenOnFreePort(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "0.0.0.0", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

describe("single tunnel actions", () => {
  const oldHome = process.env.HOME;
  const home = path.resolve(__dirname, ".tmp-tunnel-actions");
  const toml = path.join(home, "tunnels.toml");
  const children: ChildProcess[] = [];

  /** A stand-in for a live ssh process: alive, signallable, harmless. */
  function liveChild(): number {
    const child = spawn("sleep", ["30"], { stdio: "ignore" });
    children.push(child);
    return child.pid as number;
  }

  function writeConfig(entries: string): void {
    fs.writeFileSync(toml, entries, "utf-8");
  }

  beforeAll(() => {
    fs.mkdirSync(home, { recursive: true });
    process.env.HOME = home;
  });

  afterAll(() => {
    children.forEach((child) => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    });
    process.env.HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  beforeEach(() => {
    saveState([]);
  });

  it("reports already-running instead of spawning a duplicate", async () => {
    const pid = liveChild();
    saveState([{ name: "db1", targetHost: "h", targetPort: 3306, localPort: 13306, pid }]);
    writeConfig('[[tunnels]]\nname = "db1"\ntargetHost = "h"\ntargetPort = 3306\nlocalPort = 13306\n');

    const result = await startSingleTunnel(toml, "db1");

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("already-running");
    expect(result.tunnel?.pid).toBe(pid);
    expect(loadState()).toHaveLength(1);
  });

  it("rejects an unknown tunnel, a missing name and an invalid config", async () => {
    writeConfig('[[tunnels]]\nname = "db1"\ntargetHost = "h"\ntargetPort = 3306\n');

    expect(await startSingleTunnel(toml, "nope")).toMatchObject({ ok: false, code: 404 });
    expect(await startSingleTunnel(toml, "")).toMatchObject({ ok: false, code: 400 });

    writeConfig('[[tunnels]]\nname = "db1"\ntargetHost = "h"\ntargetPort = "oops"\n');
    const invalid = await startSingleTunnel(toml, "db1");
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toMatch(/config is invalid/);
  });

  it("fails fast when the local port is already taken", async () => {
    const listener = await listenOnFreePort();
    writeConfig(
      `[[tunnels]]\nname = "taken"\ntargetHost = "127.0.0.1"\ntargetPort = 3306\nlocalPort = ${listener.port}\n`
    );
    try {
      const result = await startSingleTunnel(toml, "taken");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/already in use/);
      expect(loadState()).toEqual([]);
    } finally {
      await listener.close();
    }
  });

  it("stops only the named tunnel and keeps the others", async () => {
    const firstPid = liveChild();
    const secondPid = liveChild();
    saveState([
      { name: "a", targetHost: "h", targetPort: 1, localPort: 2, pid: firstPid },
      { name: "b", targetHost: "h", targetPort: 1, localPort: 3, pid: secondPid },
    ]);

    const result = await stopSingleTunnel("a");

    expect(result).toMatchObject({ ok: true, reason: "killed" });
    expect(await waitFor(() => !isProcessAlive(firstPid))).toBe(true);
    expect(isProcessAlive(secondPid)).toBe(true);
    expect(loadState().map((t) => t.name)).toEqual(["b"]);
  });


  it("starts all: skips the live tunnels and keeps going past a failure", async () => {
    const pid = liveChild();
    const listener = await listenOnFreePort();
    saveState([{ name: "live", targetHost: "h", targetPort: 1, localPort: 2, pid }]);
    writeConfig(
      `[[tunnels]]\nname = "live"\ntargetHost = "h"\ntargetPort = 3306\nlocalPort = 13306\n\n` +
        `[[tunnels]]\nname = "blocked"\ntargetHost = "127.0.0.1"\ntargetPort = 3306\nlocalPort = ${listener.port}\n`
    );
    try {
      const result = await startAllTunnels(toml);

      expect(result.skipped).toEqual(["live"]);
      expect(result.started).toEqual([]);
      expect(result.failures.map((f) => f.name)).toEqual(["blocked"]);
      expect(result.failures[0].error).toMatch(/already in use/);
      // The healthy tunnel was neither signalled nor duplicated, and a failed
      // start never lands in the state file.
      expect(isProcessAlive(pid)).toBe(true);
      expect(loadState().map((t) => t.name)).toEqual(["live"]);
    } finally {
      await listener.close();
    }
  });

  it("starts all: rejects the whole call when the config file is invalid", async () => {
    writeConfig('[[tunnels]]\nname = "db1"\ntargetHost = "h"\ntargetPort = "oops"\n');

    const result = await startAllTunnels(toml);

    expect(result).toMatchObject({ ok: false, code: 400 });
    expect(result.error).toMatch(/config is invalid/);
  });

  it("drops a stale entry without signalling anything and reports not-running", async () => {
    saveState([{ name: "ghost", targetHost: "h", targetPort: 1, localPort: 2, pid: 999999 }]);

    expect(await stopSingleTunnel("ghost")).toMatchObject({ ok: true, reason: "stale" });
    expect(loadState()).toEqual([]);
    expect(await stopSingleTunnel("ghost")).toMatchObject({ ok: true, reason: "not-running" });
  });
});
