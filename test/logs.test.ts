import fs from "fs";
import path from "path";
import { readTunnelLogTail, startTunnelLog, tunnelLogPath } from "../src/logs";

describe("tunnel logs", () => {
  const oldHome = process.env.HOME;
  const home = path.resolve(__dirname, ".tmp-logs");

  beforeAll(() => {
    fs.mkdirSync(home, { recursive: true });
    process.env.HOME = home;
  });

  afterAll(() => {
    process.env.HOME = oldHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("keeps every name inside the log directory", () => {
    const escaped = tunnelLogPath("../../etc/passwd");
    expect(path.dirname(escaped)).toBe(path.resolve(home, ".moleport-logs"));
    expect(escaped).toMatch(/passwd\.log$/);
    expect(tunnelLogPath("a b/c")).toBe(path.resolve(home, ".moleport-logs", "a_b_c.log"));
    expect(tunnelLogPath("")).toMatch(/tunnel\.log$/);
  });

  it("writes a self-describing header and reads it back", () => {
    const fd = startTunnelLog("db1", "ssh -N -L 0.0.0.0:1:h:1 bastion");
    expect(fd).toBeDefined();
    fs.writeSync(fd as number, "Connection closed by remote host\n");
    fs.closeSync(fd as number);

    const lines = readTunnelLogTail(tunnelLogPath("db1"));
    expect(lines[0]).toContain("$ ssh -N -L 0.0.0.0:1:h:1 bastion");
    expect(lines).toContain("Connection closed by remote host");
  });

  it("returns [] for a missing file and only the tail for a long one", () => {
    expect(readTunnelLogTail(path.join(home, "nope.log"))).toEqual([]);

    const file = path.join(home, "many.log");
    fs.writeFileSync(file, Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n"), "utf-8");
    expect(readTunnelLogTail(file, 5)).toEqual(["line 495", "line 496", "line 497", "line 498", "line 499"]);
  });
});
