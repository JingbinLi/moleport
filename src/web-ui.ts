/**
 * The whole web UI in one string: no bundler, no extra dependency, works the
 * same from `dist/` and from the bun-compiled binary.
 *
 * The client script intentionally uses string concatenation instead of template
 * literals so this outer template string never needs escaping.
 */
export function renderWebUi(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MolePort 隧道配置</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%232f6fed'/><text x='16' y='22' font-size='13' font-family='sans-serif' font-weight='700' text-anchor='middle' fill='white'>MP</text></svg>" />
<style>
  :root {
    --bg: #f6f7f9;
    --surface: #ffffff;
    --border: #e3e6ec;
    --text: #1b1f26;
    --muted: #6b7280;
    --accent: #2f6fed;
    --accent-weak: #eaf1fe;
    --green: #16a34a;
    --green-weak: #e8f7ee;
    --red: #dc2626;
    --red-weak: #fdecec;
    --amber: #b45309;
    --amber-weak: #fdf3e3;
    --radius: 12px;
    --shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 8px 24px -16px rgba(16, 24, 40, .24);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 24px;
    background: rgba(255, 255, 255, .86);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo {
    width: 38px; height: 38px; flex: 0 0 38px;
    display: grid; place-items: center;
    border-radius: 10px;
    background: linear-gradient(135deg, #2f6fed, #7c3aed);
    color: #fff; font-weight: 700; letter-spacing: .5px; font-size: 13px;
  }
  h1 { font-size: 16px; margin: 0; font-weight: 650; }
  .path { margin: 2px 0 0; color: var(--muted); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  main { max-width: 1120px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .card-head h2 { font-size: 14px; margin: 0; font-weight: 650; }
  .card-body { padding: 16px 20px; }
  .muted { color: var(--muted); font-weight: 400; }
  button { font: inherit; border-radius: 8px; border: 1px solid transparent; padding: 8px 14px; cursor: pointer; transition: .15s ease; white-space: nowrap; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primary { background: var(--accent); color: #fff; }
  .primary:hover:not(:disabled) { filter: brightness(1.06); }
  .warn { background: var(--amber-weak); color: var(--amber); border-color: #f2dcb8; }
  .warn:hover:not(:disabled) { background: #fbe9cf; }
  .ghost { background: #fff; border-color: var(--border); color: var(--text); }
  .ghost:hover:not(:disabled) { background: #f3f4f6; }
  .danger { background: transparent; color: var(--red); border-color: transparent; padding: 6px 8px; }
  .danger:hover:not(:disabled) { background: var(--red-weak); }
  .link { background: transparent; color: var(--accent); border-color: transparent; padding: 6px 8px; }
  .link:hover:not(:disabled) { background: var(--accent-weak); }
  .link.start { color: var(--green); }
  .link.start:hover:not(:disabled) { background: var(--green-weak); }
  .link.stop { color: var(--red); }
  .link.stop:hover:not(:disabled) { background: var(--red-weak); }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { text-align: left; padding: 11px 12px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; }
  th:nth-child(1), td:nth-child(1) { width: 150px; }
  th:nth-child(2), td:nth-child(2) { width: 170px; }
  th:nth-child(4), td:nth-child(4) { width: 88px; }
  th:nth-child(5), td:nth-child(5) { width: 150px; }
  th:nth-child(6), td:nth-child(6) { width: 200px; overflow: visible; text-align: right; white-space: nowrap; }
  th { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #fafbfc; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .cell-target { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 550; white-space: nowrap; }
  .pill.on { background: var(--green-weak); color: var(--green); }
  .pill.off { background: #f1f3f6; color: var(--muted); }
  .pill.down { background: var(--amber-weak); color: var(--amber); }
  .modal { position: fixed; inset: 0; background: rgba(17, 24, 39, .45); display: grid; place-items: center; padding: 24px; z-index: 50; }
  .modal-card { background: #fff; border-radius: 12px; width: min(880px, 100%); max-height: 78vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px -20px rgba(0, 0, 0, .45); }
  .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
  .modal-head h3 { margin: 0; font-size: 14px; font-weight: 650; }
  .log { margin: 0; padding: 16px 18px; overflow: auto; background: #0b1020; color: #d7e0f5; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; min-height: 80px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--amber-weak); color: var(--amber); }
  .hidden { display: none !important; }
  .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 14px; }
  @media (max-width: 900px) {
    th:nth-child(5), td:nth-child(5) { display: none; }
    th:nth-child(1), td:nth-child(1) { width: 140px; }
    th:nth-child(2), td:nth-child(2) { width: 130px; }
  }
  @media (max-width: 640px) {
    th:nth-child(4), td:nth-child(4) { display: none; }
    th, td { padding: 10px 8px; }
    /* Too narrow for four buttons on one line: let them wrap instead of
       spilling out of the card. */
    th:nth-child(6), td:nth-child(6) { width: 176px; white-space: normal; }
    .link, .danger, .ghost { padding: 5px 6px; }
  }
  @media (max-width: 820px) { .form-grid { grid-template-columns: 1fr 1fr; } header { flex-direction: column; align-items: flex-start; } }
  @media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } main { padding: 16px; } }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; font-weight: 550; }
  input {
    width: 100%; padding: 8px 10px; font: inherit; color: var(--text);
    background: #fff; border: 1px solid var(--border); border-radius: 8px; outline: none; transition: .15s ease;
  }
  input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(47, 111, 237, .12); }
  .form-actions { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
  .hint { color: var(--muted); font-size: 12px; margin-left: auto; }
  .empty { padding: 28px; text-align: center; color: var(--muted); }
  .alert {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 12px 16px; border-radius: 10px; font-size: 13px;
    background: var(--red-weak); color: #991b1b; border: 1px solid #f3c9c5;
    white-space: pre-line;
  }
  #toast {
    position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px);
    background: #111827; color: #fff; padding: 10px 16px; border-radius: 10px;
    font-size: 13px; opacity: 0; pointer-events: none; transition: .2s ease; max-width: 80vw;
  }
  #toast.show { opacity: 1; transform: translate(-50%, 0); }
  #toast.error { background: #991b1b; }
  #toast.ok { background: #14532d; }
  .spin { display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<header>
  <div class="brand">
    <div class="logo">MP</div>
    <div>
      <h1>MolePort 隧道配置</h1>
      <p class="path" id="configPath">加载中…</p>
    </div>
  </div>
  <div class="actions">
    <button class="ghost" id="refreshBtn">刷新</button>
    <button class="primary" id="saveBtn">保存</button>
    <button class="warn" id="applyBtn">保存并应用</button>
  </div>
</header>
<main>
  <div id="configAlert" class="alert hidden"></div>
  <section class="card">
    <div class="card-head">
      <h2>隧道列表 <span class="muted" id="count"></span></h2>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge hidden" id="dirtyBadge">未保存</span>
        <button class="ghost" id="startAllBtn" title="启动所有未运行的隧道，已在运行的会跳过">启动全部</button>
        <button class="ghost" id="stopAllBtn" title="停止所有在运行的隧道（配置不会被修改）">停止全部</button>
      </div>
    </div>
    <div id="tableHost"></div>
  </section>

  <section class="card">
    <div class="card-head">
      <h2 id="formTitle">新增隧道</h2>
      <span class="muted" id="formHint">保存后写入 TOML；应用会按新配置重建隧道</span>
    </div>
    <div class="card-body">
      <form id="tunnelForm">
        <div class="form-grid">
          <div>
            <label for="f-name">名称 *</label>
            <input id="f-name" name="name" placeholder="ts1-maindb" autocomplete="off" />
          </div>
          <div>
            <label for="f-host">目标主机 *</label>
            <input id="f-host" name="targetHost" placeholder="db.example.com 或 10.0.0.5" autocomplete="off" />
          </div>
          <div>
            <label for="f-port">目标端口 *</label>
            <input id="f-port" name="targetPort" placeholder="3306" inputmode="numeric" autocomplete="off" />
          </div>
          <div>
            <label for="f-local">本地端口</label>
            <input id="f-local" name="localPort" placeholder="留空则随机分配" inputmode="numeric" autocomplete="off" />
          </div>
          <div>
            <label for="f-bastion">跳板机</label>
            <input id="f-bastion" name="bastion" placeholder="ts1-bastion 或 user@host" autocomplete="off" />
          </div>
          <div>
            <label for="f-timeout">超时 (ms)</label>
            <input id="f-timeout" name="timeoutMs" placeholder="默认 10000" inputmode="numeric" autocomplete="off" />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary" id="submitBtn">添加</button>
          <button type="button" class="ghost hidden" id="cancelEditBtn">取消编辑</button>
          <span class="hint" id="formError"></span>
        </div>
      </form>
    </div>
  </section>
</main>
<div id="logModal" class="modal hidden">
  <div class="modal-card">
    <div class="modal-head">
      <h3 id="logTitle">日志</h3>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="muted mono" id="logPath" style="font-size:11px"></span>
        <button class="ghost" id="logClose">关闭</button>
      </div>
    </div>
    <pre class="log" id="logBody"></pre>
  </div>
</div>
<div id="toast"></div>
<script>
(function () {
  var state = { tunnels: [], path: "", dirty: false, editing: -1, status: {}, busy: false, rowBusy: null, startingAll: false, stoppingAll: false, configErrors: [] };
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var toastTimer = null;
  function toast(message, kind) {
    var el = $("toast");
    el.textContent = message;
    el.className = "show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ""; }, 3200);
  }

  function api(path, options) {
    var opts = options || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var message = data && (data.error || data.message) ? (data.error || data.message) : ("HTTP " + res.status);
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function setDirty(dirty) {
    state.dirty = dirty;
    $("dirtyBadge").className = dirty ? "badge" : "badge hidden";
  }

  function numOrUndefined(value) {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    var n = Number(value);
    return isFinite(n) ? n : value;
  }

  function tunnelFromForm() {
    var data = {
      name: $("f-name").value.trim(),
      targetHost: $("f-host").value.trim(),
      targetPort: numOrUndefined($("f-port").value),
      localPort: numOrUndefined($("f-local").value),
      bastion: $("f-bastion").value.trim(),
      timeoutMs: numOrUndefined($("f-timeout").value)
    };
    if (data.bastion === "") delete data.bastion;
    if (data.localPort === undefined) delete data.localPort;
    if (data.timeoutMs === undefined) delete data.timeoutMs;
    return data;
  }

  function fillForm(tunnel) {
    $("f-name").value = tunnel ? tunnel.name || "" : "";
    $("f-host").value = tunnel ? tunnel.targetHost || "" : "";
    $("f-port").value = tunnel && tunnel.targetPort ? tunnel.targetPort : "";
    $("f-local").value = tunnel && tunnel.localPort ? tunnel.localPort : "";
    $("f-bastion").value = tunnel ? tunnel.bastion || "" : "";
    $("f-timeout").value = tunnel ? tunnel.timeoutMs || "" : "";
    $("formError").textContent = "";
  }

  function setEditing(index) {
    state.editing = index;
    $("formTitle").textContent = index >= 0 ? "编辑隧道" : "新增隧道";
    $("submitBtn").textContent = index >= 0 ? "更新" : "添加";
    $("cancelEditBtn").className = index >= 0 ? "ghost" : "ghost hidden";
    fillForm(index >= 0 ? state.tunnels[index] : null);
    if (index >= 0) window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function statusOf(name) {
    var s = state.status[name];
    return s && s.running ? s : null;
  }

  /** Started at some point, but the process is gone now. */
  function exitedOf(name) {
    var s = state.status[name];
    return s && s.exited ? s : null;
  }

  function showLog(name) {
    api("/api/tunnel/log?name=" + encodeURIComponent(name)).then(function (data) {
      $("logTitle").textContent = name + " · 最近日志";
      $("logPath").textContent = data.path || "";
      $("logBody").textContent = data.lines && data.lines.length
        ? data.lines.join("\\n")
        : "（暂无日志：这条隧道还没有启动过，或者日志文件已被清空）";
      $("logModal").className = "modal";
    }).catch(function (error) {
      toast("读取日志失败：" + error.message, "error");
    });
  }

  function hideLog() {
    $("logModal").className = "modal hidden";
  }

  function startTunnel(name) {
    if (state.rowBusy || state.startingAll || state.stoppingAll) return;
    state.rowBusy = name;
    renderTable();
    api("/api/tunnel/start", { method: "POST", body: { name: name } }).then(function (result) {
      if (result.reason === "already-running") {
        toast(name + " 已经在运行", "ok");
      } else {
        var port = result.tunnel && result.tunnel.localPort ? "（本地端口 " + result.tunnel.localPort + "）" : "";
        toast(name + " 已启动" + port, "ok");
      }
    }).catch(function (error) {
      toast("启动失败：" + error.message, "error");
    }).then(finishRowAction);
  }

  function stopTunnel(name, silent) {
    if (state.rowBusy || state.stoppingAll) return Promise.resolve(null);
    state.rowBusy = name;
    renderTable();
    return api("/api/tunnel/stop", { method: "POST", body: { name: name } }).then(function (result) {
      if (!silent) {
        toast(result.reason === "not-running" ? name + " 本来就没有在运行" : name + " 已停止", "ok");
      }
      return result;
    }).catch(function (error) {
      if (!silent) toast("停止失败：" + error.message, "error");
      return null;
    }).then(finishRowAction);
  }

  function finishRowAction() {
    state.rowBusy = null;
    return loadStatus();
  }

  /** Rows with no live process right now - exactly what "启动全部" would start. */
  function startableCount() {
    return state.tunnels.filter(function (t) { return !statusOf(t.name); }).length;
  }

  /** Tunnels that are up right now - exactly what "停止全部" would stop. */
  function runningCount() {
    return state.tunnels.filter(function (t) { return statusOf(t.name); }).length;
  }

  function syncBulkBtns() {
    var startBtn = $("startAllBtn");
    var stopBtn = $("stopAllBtn");
    var pending = startableCount();
    var live = runningCount();

    if (startBtn) {
      if (state.startingAll) {
        startBtn.innerHTML = '<span class="spin"></span>启动中';
        startBtn.disabled = true;
      } else {
        startBtn.innerHTML = "启动全部";
        startBtn.disabled = state.busy || state.stoppingAll || !state.tunnels.length || pending === 0;
        startBtn.title = !state.tunnels.length
          ? "还没有隧道"
          : pending === 0
            ? "所有隧道都已在运行"
            : "启动 " + pending + " 条未运行的隧道，已在运行的会跳过";
      }
    }

    if (stopBtn) {
      if (state.stoppingAll) {
        stopBtn.innerHTML = '<span class="spin"></span>停止中';
        stopBtn.disabled = true;
      } else {
        stopBtn.innerHTML = "停止全部";
        stopBtn.disabled = state.busy || state.startingAll || live === 0;
        stopBtn.title = live === 0
          ? "没有在运行的隧道"
          : "停止 " + live + " 条在运行的隧道（配置不会被修改）";
      }
    }
  }

  /**
   * Additive on purpose: bring up every tunnel that is down and leave the
   * running ones alone - "保存并应用" is the one that rebuilds everything.
   */
  function doStartAll() {
    if (state.busy || state.startingAll) return;
    if (!startableCount()) return;
    state.startingAll = true;
    syncBulkBtns();
    api("/api/tunnel/start-all", { method: "POST" }).then(function (result) {
      var started = (result.started || []).length;
      var skipped = (result.skipped || []).length;
      var failures = result.failures || [];
      if (failures.length) {
        toast("已启动 " + started + " 条，" + failures.length + " 条失败（" +
          failures.map(function (f) { return f.name; }).join("、") + "），点“日志”看原因", "error");
      } else {
        toast("已启动 " + started + " 条隧道" +
          (skipped ? "，跳过 " + skipped + " 条已在运行的" : ""), "ok");
      }
    }).catch(function (error) {
      toast("启动全部失败：" + error.message, "error");
    }).then(function () {
      state.startingAll = false;
      return loadStatus();
    });
  }

  /**
   * Stop every running tunnel. The config file is untouched: the rows stay and
   * go back to 未运行, so "启动全部" can bring them back later.
   */
  function doStopAll() {
    if (state.busy || state.startingAll || state.stoppingAll) return;
    var live = runningCount();
    if (!live) return;
    if (!window.confirm("停止全部 " + live + " 条隧道？配置会保留，之后可以再启动。")) return;
    state.stoppingAll = true;
    syncBulkBtns();
    api("/api/tunnel/stop-all", { method: "POST" }).then(function (result) {
      var stopped = (result.stopped || []).length;
      toast("已停止 " + stopped + " 条隧道", "ok");
    }).catch(function (error) {
      toast("停止全部失败：" + error.message, "error");
    }).then(function () {
      state.stoppingAll = false;
      return loadStatus();
    });
  }

  function renderTable() {
    syncBulkBtns();
    $("count").textContent = state.tunnels.length ? "(" + state.tunnels.length + ")" : "";
    if (!state.tunnels.length) {
      $("tableHost").innerHTML = '<div class="empty">还没有隧道，用下面的表单添加第一条。</div>';
      return;
    }
    var rows = state.tunnels.map(function (t, i) {
      var live = statusOf(t.name);
      var exited = live ? null : exitedOf(t.name);
      var rowBusy = state.rowBusy === t.name;
      var pill;
      if (live) {
        pill = '<span class="pill on"><span class="dot"></span>运行中' + (live.pid ? " · pid " + live.pid : "") + "</span>";
      } else if (exited) {
        var deadTitle = "进程已退出（原 pid " + (exited.pid || "-") + "），点日志看原因";
        pill = '<span class="pill down" title="' + deadTitle + '"><span class="dot"></span>已断开</span>';
      } else {
        pill = '<span class="pill off"><span class="dot"></span>未运行</span>';
      }
      var local = live && live.localPort ? live.localPort : (t.localPort || "随机");
      var toggle = rowBusy
        ? '<button class="link" disabled><span class="spin"></span>' + (live ? "停止" : "启动") + "</button>"
        : live
          ? '<button class="link stop" data-stop="' + i + '">停止</button>'
          : '<button class="link start" data-start="' + i + '">启动</button>';
      return "<tr>" +
        "<td>" + pill + "</td>" +
        '<td class="cell-target"><strong title="' + esc(t.name) + '">' + esc(t.name) + "</strong></td>" +
        '<td class="mono cell-target" title="' + esc(t.targetHost) + ":" + esc(t.targetPort) + '">' + esc(t.targetHost) + ":" + esc(t.targetPort) + "</td>" +
        '<td class="mono">' + esc(local) + "</td>" +
        '<td class="mono cell-target" title="' + esc(t.bastion || "直连") + '">' + esc(t.bastion || "直连") + "</td>" +
        '<td style="text-align:right;white-space:nowrap">' +
          toggle +
          '<button class="link" data-log="' + i + '">日志</button>' +
          '<button class="link" data-edit="' + i + '">编辑</button>' +
          '<button class="danger" data-remove="' + i + '">删除</button>' +
        "</td>" +
      "</tr>";
    });
    $("tableHost").innerHTML =
      "<table><thead><tr><th>状态</th><th>名称</th><th>目标</th><th>本地端口</th><th>跳板机</th><th></th></tr></thead><tbody>" +
      rows.join("") + "</tbody></table>";

    Array.prototype.forEach.call(document.querySelectorAll("[data-start]"), function (btn) {
      btn.addEventListener("click", function () {
        startTunnel(state.tunnels[Number(btn.getAttribute("data-start"))].name);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-stop]"), function (btn) {
      btn.addEventListener("click", function () {
        stopTunnel(state.tunnels[Number(btn.getAttribute("data-stop"))].name, false);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-log]"), function (btn) {
      btn.addEventListener("click", function () {
        showLog(state.tunnels[Number(btn.getAttribute("data-log"))].name);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-edit]"), function (btn) {
      btn.addEventListener("click", function () { setEditing(Number(btn.getAttribute("data-edit"))); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-remove]"), function (btn) {
      btn.addEventListener("click", function () {
        var index = Number(btn.getAttribute("data-remove"));
        var tunnel = state.tunnels[index];
        var live = statusOf(tunnel.name);
        var question = live
          ? "隧道 " + tunnel.name + " 正在运行，删除并停止它？"
          : "删除隧道 " + tunnel.name + "？";
        if (!window.confirm(question)) return;
        var removeFromList = function () {
          state.tunnels.splice(index, 1);
          setDirty(true);
          if (state.editing === index) setEditing(-1);
          renderTable();
          toast("已从列表移除，点击保存后写入文件");
        };
        if (live) {
          // Keep the runtime honest: a deleted row must not leave a live tunnel behind.
          stopTunnel(tunnel.name, true).then(removeFromList);
        } else {
          removeFromList();
        }
      });
    });
  }

  function showConfigErrors(errors) {
    state.configErrors = errors || [];
    var box = $("configAlert");
    if (!state.configErrors.length) {
      box.className = "alert hidden";
      box.textContent = "";
      return;
    }
    box.className = "alert";
    box.textContent = "配置文件有错误，保存已禁用（避免覆盖你手写的文件）。修正后点“刷新”：\\n" +
      state.configErrors.map(function (e) {
        var where = e.index >= 0 ? "第 " + (e.index + 1) + " 条" : "文件";
        return where + (e.field ? " (" + e.field + ")" : "") + "：" + e.message;
      }).join("\\n");
  }

  function loadStatus() {
    return api("/api/status").then(function (data) {
      var map = {};
      (data.tunnels || []).forEach(function (t) { map[t.name] = t; });
      state.status = map;
      renderTable();
    }).catch(function () { /* keep the last known status */ });
  }

  function load() {
    return api("/api/config").then(function (data) {
      state.tunnels = data.tunnels || [];
      state.path = data.path || "";
      $("configPath").textContent = state.path;
      $("configPath").title = state.path;
      showConfigErrors(data.errors || []);
      setDirty(false);
      setEditing(-1);
      setBusy(false);
      return loadStatus();
    }).catch(function (error) {
      toast("读取配置失败：" + error.message, "error");
    });
  }

  function setBusy(busy, label) {
    state.busy = busy;
    var blocked = busy || state.configErrors.length > 0;
    $("refreshBtn").disabled = busy;
    $("submitBtn").disabled = busy;
    $("saveBtn").disabled = blocked;
    $("applyBtn").disabled = blocked;
    syncBulkBtns();
    $("saveBtn").innerHTML = busy && label === "save" ? '<span class="spin"></span>保存中' : "保存";
    $("applyBtn").innerHTML = busy && label === "apply" ? '<span class="spin"></span>应用中' : "保存并应用";
  }

  function saveTunnels() {
    return api("/api/config", { method: "PUT", body: { tunnels: state.tunnels } }).then(function (data) {
      state.tunnels = data.tunnels || state.tunnels;
      state.path = data.path || state.path;
      $("configPath").textContent = state.path;
      setDirty(false);
      renderTable();
      return data;
    });
  }

  function doSave() {
    if (state.busy) return;
    if (state.configErrors.length) { toast("配置文件有错误，先修正再保存", "error"); return; }
    setBusy(true, "save");
    saveTunnels().then(function (data) {
      showConfigErrors([]);
      toast(data.backup ? "已保存，原文件备份为 " + data.backup + "（隧道未重建）" : "已保存（隧道未重建，点“保存并应用”生效）", "ok");
      return loadStatus();
    }).catch(function (error) {
      toast("保存失败：" + error.message, "error");
    }).then(function () { setBusy(false); });
  }

  function doApply() {
    if (state.busy) return;
    if (state.configErrors.length) { toast("配置文件有错误，先修正再应用", "error"); return; }
    if (!window.confirm("按当前配置重建全部隧道？现有隧道会先被关闭。")) return;
    setBusy(true, "apply");
    saveTunnels().then(function () {
      return api("/api/apply", { method: "POST" });
    }).then(function (result) {
      var created = (result.created || []).length;
      var failures = result.failures || [];
      if (failures.length) {
        toast("已应用：" + created + " 条成功，" + failures.length + " 条失败（" + failures.map(function (f) { return f.name; }).join(", ") + "）", "error");
      } else {
        toast("已应用：" + created + " 条隧道已重建", "ok");
      }
      return loadStatus();
    }).catch(function (error) {
      toast("应用失败：" + error.message, "error");
    }).then(function () { setBusy(false); });
  }

  $("tunnelForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.busy) return;
    var tunnel = tunnelFromForm();
    if (!tunnel.name) { $("formError").textContent = "名称必填"; return; }
    if (!tunnel.targetHost) { $("formError").textContent = "目标主机必填"; return; }
    if (typeof tunnel.targetPort !== "number") { $("formError").textContent = "目标端口需为数字"; return; }
    $("formError").textContent = "";
    if (state.editing >= 0) {
      state.tunnels[state.editing] = tunnel;
      toast("已更新，点击保存后写入文件");
    } else {
      state.tunnels.push(tunnel);
      toast("已添加，点击保存后写入文件");
    }
    setDirty(true);
    setEditing(-1);
    renderTable();
  });

  $("cancelEditBtn").addEventListener("click", function () { setEditing(-1); });
  $("logClose").addEventListener("click", hideLog);
  $("logModal").addEventListener("click", function (event) {
    if (event.target === $("logModal")) hideLog();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideLog();
  });
  $("saveBtn").addEventListener("click", doSave);
  $("applyBtn").addEventListener("click", doApply);
  $("startAllBtn").addEventListener("click", doStartAll);
  $("stopAllBtn").addEventListener("click", doStopAll);
  $("refreshBtn").addEventListener("click", function () {
    if (state.dirty && !window.confirm("有未保存的修改，刷新会丢弃，继续？")) return;
    load();
  });

  window.addEventListener("beforeunload", function (event) {
    if (state.dirty) { event.preventDefault(); event.returnValue = ""; }
  });

  load();
  setInterval(function () { if (!state.busy) loadStatus(); }, 4000);
})();
</script>
</body>
</html>`;
}
