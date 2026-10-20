/**
 * Single source of truth for the version string.
 *
 * `package.json` is resolved relative to this module, so it works both from
 * `dist/*.js` (tsc build) and from a bun-compiled single-file binary.
 */
export function getVersion(): string {
  try {
    const pkg = require("../package.json");
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
