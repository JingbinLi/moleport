import fs from "fs";
import path from "path";
import {
  formatIssues,
  loadTunnelsFromFile,
  parseTunnelConfig,
  readTunnelConfigFile,
  serializeTunnelConfig,
  validateTunnels,
  writeTunnelConfigFile,
} from "../src/toml-config";

const SAMPLE = `# a hand written file
[[tunnels]]
name = "db1"
targetHost = "10.0.0.1"
targetPort = 3306
localPort = 13306
bastion = "bastion-1"

[[tunnels]]
name = "db2"
targetHost = "10.0.0.2"
targetPort = 5432
timeoutMs = 15000
`;

describe("toml-config", () => {
  const tmpDir = path.resolve(__dirname, ".tmp-toml-config");

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses the [[tunnels]] array form", () => {
    const raw = parseTunnelConfig(SAMPLE);
    expect(raw).toHaveLength(2);
    const { tunnels, errors } = validateTunnels(raw);
    expect(errors).toEqual([]);
    expect(tunnels[0]).toMatchObject({ name: "db1", targetHost: "10.0.0.1", targetPort: 3306, localPort: 13306 });
    expect(tunnels[1].timeoutMs).toBe(15000);
    expect(tunnels[1].bastion).toBeUndefined();
  });

  it("parses the object form { tunnels = [...] }", () => {
    const raw = parseTunnelConfig('tunnels = [{ name = "a", targetHost = "h", targetPort = 1 }]');
    expect(validateTunnels(raw).errors).toEqual([]);
  });

  it("rejects a document that is neither an array nor { tunnels }", () => {
    expect(() => parseTunnelConfig('other = 1')).toThrow(/array of tunnels/i);
  });

  it("keeps unknown keys so a hand-written entry survives a save", () => {
    const { tunnels, errors } = validateTunnels([
      { name: "a", targetHost: "h", targetPort: 22, extra: undefined, note: "keep me" },
    ]);
    expect(errors).toEqual([]);
    expect(tunnels[0].note).toBe("keep me");
    expect(serializeTunnelConfig(tunnels)).toMatch(/note\s+= "keep me"/);
  });

  it("round-trips through serialize -> parse", () => {
    const { tunnels } = validateTunnels(parseTunnelConfig(SAMPLE));
    const rendered = serializeTunnelConfig(tunnels);
    const reparsed = validateTunnels(parseTunnelConfig(rendered));
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.tunnels).toEqual(tunnels);
  });

  it("escapes quotes and backslashes in strings", () => {
    const { tunnels } = validateTunnels([{ name: 'a"b\\c', targetHost: "h", targetPort: 22 }]);
    const reparsed = validateTunnels(parseTunnelConfig(serializeTunnelConfig(tunnels)));
    expect(reparsed.tunnels[0].name).toBe('a"b\\c');
  });

  it("reports missing name, bad port and duplicate names", () => {
    const { errors } = validateTunnels([
      { targetHost: "h", targetPort: 70000 },
      { name: "dup", targetHost: "h", targetPort: 1 },
      { name: "dup", targetHost: "", targetPort: 1 },
    ]);
    const rendered = formatIssues(errors);
    expect(rendered).toContain("tunnel #1.name: name is required");
    expect(rendered).toContain("targetPort must be an integer");
    expect(rendered).toContain('duplicate name "dup"');
    expect(rendered).toContain("targetHost is required");
  });

  it("drops empty optional values instead of writing nulls", () => {
    const { tunnels, errors } = validateTunnels([
      { name: "a", targetHost: "h", targetPort: 22, localPort: null, bastion: "  " },
    ]);
    expect(errors).toEqual([]);
    expect(tunnels[0].localPort).toBeUndefined();
    expect(tunnels[0].bastion).toBeUndefined();
    const rendered = serializeTunnelConfig(tunnels);
    expect(rendered).not.toContain("null");
    expect(rendered).not.toContain("localPort");
  });

  it("writes the file atomically and keeps the previous version as .bak", () => {
    const file = path.join(tmpDir, "tunnels.toml");
    fs.writeFileSync(file, SAMPLE, "utf-8");

    const { tunnels } = validateTunnels(parseTunnelConfig(SAMPLE));
    const result = writeTunnelConfigFile(file, tunnels.slice(0, 1));

    expect(result.backup).toBe(`${file}.bak`);
    expect(fs.readFileSync(result.backup!, "utf-8")).toBe(SAMPLE);
    expect(loadTunnelsFromFile(file)).toHaveLength(1);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it("readTunnelConfigFile reports problems instead of throwing", () => {
    expect(readTunnelConfigFile(path.join(tmpDir, "missing.toml"))).toEqual({
      exists: false,
      tunnels: [],
      errors: [],
    });

    const broken = path.join(tmpDir, "broken.toml");
    fs.writeFileSync(broken, 'tunnels = "not an array"\n', "utf-8");
    const result = readTunnelConfigFile(broken);
    expect(result.exists).toBe(true);
    expect(result.tunnels).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("loadTunnelsFromFile throws a readable message for invalid entries", () => {
    const file = path.join(tmpDir, "bad.toml");
    fs.writeFileSync(file, '[[tunnels]]\nname = "a"\ntargetHost = "h"\ntargetPort = "not-a-number"\n', "utf-8");
    expect(() => loadTunnelsFromFile(file)).toThrow(/targetPort/);
  });
});
