import { renderWebUi } from "../src/web-ui";

/**
 * The UI is one big template string, so a stray quote or an unescaped \n inside
 * the client script silently produces a blank page. Parsing the emitted script
 * catches that without a browser.
 */
describe("web-ui", () => {
  function clientScript(html: string): string {
    const match = html.match(/<script>([\s\S]*)<\/script>/);
    if (!match) throw new Error("no inline script found");
    return match[1];
  }

  it("emits a client script that parses", () => {
    const script = clientScript(renderWebUi());
    expect(() => new Function(script)).not.toThrow();
  });

  it("renders the three row states and the log viewer hooks", () => {
    const html = renderWebUi();
    expect(html).toContain("运行中");
    expect(html).toContain("已断开");
    expect(html).toContain("未运行");
    expect(html).toContain('id="logModal"');
    expect(html).toContain('id="logBody"');
  });

  it("keeps the delete action inside a fixed layout", () => {
    const html = renderWebUi();
    expect(html).toContain("table-layout: fixed");
    // the actions column is the 6th and must not be squeezed by long hostnames
    expect(html).toMatch(/th:nth-child\(6\)[\s\S]{0,120}width: 200px/);
  });
});
