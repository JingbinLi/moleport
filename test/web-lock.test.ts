import fs from "fs";
import http from "http";
import path from "path";
import {
  WEB_SERVICE_NAME,
  clearWebLock,
  getRunningWebServer,
  isProcessAlive,
  probeWebServer,
  readWebLock,
  stopWebServer,
  webLockPath,
  writeWebLock,
} from "../src/web-lock";

interface FakeServer {
  port: number;
  close: () => Promise<void>;
}

function startFakeServer(payload: Record<string, unknown>): Promise<FakeServer> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

describe("web-lock", () => {
  const oldHome = process.env.HOME;
  const home = path.resolve(__dirname, ".tmp-web-home");
  const tomlPath = path.resolve(home, "tunnels.toml");

  beforeAll(() => {
    fs.mkdirSync(home, { recursive: true });
    process.env.HOME = home;
  });

  afterAll(() => {
    process.env.HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearWebLock();
  });

  it("resolves the lock file under the current HOME", () => {
    expect(webLockPath()).toBe(path.join(home, ".moleport-web.json"));
  });

  it("round-trips the lock file", () => {
    writeWebLock({ pid: 123, port: 7788, toml: tomlPath, startedAt: "now" });
    expect(readWebLock()).toEqual({ pid: 123, port: 7788, toml: tomlPath, startedAt: "now" });
    clearWebLock();
    expect(readWebLock()).toBeNull();
  });

  it("only clears the lock owned by the expected pid", () => {
    writeWebLock({ pid: 123, port: 7788, toml: tomlPath, startedAt: "now" });
    clearWebLock(999);
    expect(readWebLock()).not.toBeNull();
    clearWebLock(123);
    expect(readWebLock()).toBeNull();
  });

  it("detects live and dead pids", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(999999)).toBe(false);
  });

  it("probes a moleport server and ignores foreign ones", async () => {
    const ours = await startFakeServer({ ok: true, service: WEB_SERVICE_NAME, toml: tomlPath, pid: 42, port: 1 });
    const foreign = await startFakeServer({ ok: true, service: "something-else" });
    try {
      expect(await probeWebServer(ours.port)).toMatchObject({ service: WEB_SERVICE_NAME, pid: 42 });
      expect(await probeWebServer(foreign.port)).toBeNull();
      expect(await probeWebServer(1)).toBeNull();
    } finally {
      await ours.close();
      await foreign.close();
    }
  });

  it("reuses a running server discovered on the preferred port", async () => {
    const server = await startFakeServer({
      ok: true,
      service: WEB_SERVICE_NAME,
      toml: tomlPath,
      pid: 4242,
      port: 7788,
    });
    try {
      const found = await getRunningWebServer(tomlPath, server.port);
      expect(found).not.toBeNull();
      expect(found!.port).toBe(7788);
      expect(found!.pid).toBe(4242);
    } finally {
      await server.close();
    }
  });

  it("does not reuse a server that edits a different file", async () => {
    const server = await startFakeServer({
      ok: true,
      service: WEB_SERVICE_NAME,
      toml: path.resolve(home, "other.toml"),
      pid: 4242,
    });
    try {
      expect(await getRunningWebServer(tomlPath, server.port)).toBeNull();
    } finally {
      await server.close();
    }
  });

  it("never signals a process that is not moleport's", async () => {
    const foreign = await startFakeServer({ ok: true, service: "nginx" });
    try {
      writeWebLock({ pid: process.pid, port: foreign.port, toml: tomlPath, startedAt: "now" });
      await stopWebServer({ pid: process.pid, port: foreign.port, toml: tomlPath, startedAt: "now" });
      expect(isProcessAlive(process.pid)).toBe(true);
      expect(readWebLock()).toBeNull();
    } finally {
      await foreign.close();
    }
  });
});
