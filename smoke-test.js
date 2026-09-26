import { spawn } from "node:child_process";
import http from "node:http";

const port = 18788;
const widgetUri = "ui://widget/erp-production-demo-v2.html";

const child = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(port) },
});

let serverOutput = "";
child.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function request({ method = "GET", path = "/", body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers,
          }),
        );
      },
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function rpc(method, params, id) {
  const json = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const response = await request({
    method: "POST",
    path: "/mcp",
    body: json,
    headers: {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(json),
      accept: "application/json, text/event-stream",
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${method}: HTTP ${response.status}`);
  }

  const payload = JSON.parse(response.body);
  if (payload.error) {
    throw new Error(`${method}: ${payload.error.message}`);
  }

  return payload.result;
}

function assertUiView(result, expectedSlot, expectedRenderer) {
  const ui = result?._meta?.erpUi;
  if (!ui) throw new Error("erpUi ViewModel missing");

  if (ui.slot !== expectedSlot) {
    throw new Error(`Expected slot ${expectedSlot}, got ${ui.slot}`);
  }

  if (ui.presentation?.renderer !== expectedRenderer) {
    throw new Error(
      `Expected renderer ${expectedRenderer}, got ${ui.presentation?.renderer}`,
    );
  }

  if (!ui.data?.domain) {
    throw new Error("Canonical domain data missing");
  }

  return ui;
}

try {
  let ready = false;

  for (let i = 0; i < 40; i += 1) {
    try {
      const health = await request({ path: "/" });
      if (health.status === 200) {
        ready = true;
        break;
      }
    } catch {}

    await sleep(100);
  }

  if (!ready) throw new Error("Server did not become ready");

  const initialized = await rpc(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "erp-demo-smoke-test", version: "0.2.0" },
    },
    1,
  );

  const tools = await rpc("tools/list", {}, 2);
  const resources = await rpc("resources/list", {}, 3);
  const widget = await rpc("resources/read", { uri: widgetUri }, 4);

  const candidatesResult = await rpc(
    "tools/call",
    {
      name: "get_production_candidates",
      arguments: { limit: 5 },
    },
    5,
  );

  if (candidatesResult.structuredContent?.view !== "erp_ui") {
    throw new Error("Generic ERP UI marker missing");
  }

  if (candidatesResult.structuredContent?.domain !== "production_candidates") {
    throw new Error("Candidate domain marker missing");
  }

  if ((candidatesResult.content ?? []).length !== 0) {
    throw new Error("Candidate result should not emit model-facing prose");
  }

  const workspace = assertUiView(
    candidatesResult,
    "workspace",
    "collection-workspace",
  );

  if (
    !Array.isArray(workspace.data.records) ||
    workspace.data.records.length === 0
  ) {
    throw new Error("Mock ERP candidate records missing");
  }

  if (
    workspace.presentation.selection?.action?.tool !==
    "preview_production_orders"
  ) {
    throw new Error("Selection action is not presentation-driven");
  }

  if (
    !Array.isArray(workspace.presentation.search?.fields) ||
    workspace.presentation.search.fields.length === 0
  ) {
    throw new Error("Search field schema missing");
  }

  const target = workspace.data.records[0];

  const previewResult = await rpc(
    "tools/call",
    {
      name: "preview_production_orders",
      arguments: { ids: [target.id] },
    },
    6,
  );

  if (previewResult.structuredContent?.view !== "erp_ui") {
    throw new Error("Preview generic ERP UI marker missing");
  }

  if (
    previewResult.structuredContent?.domain !== "production_order_preview"
  ) {
    throw new Error("Preview domain marker missing");
  }

  const detail = assertUiView(previewResult, "detail", "tree-detail");

  if (detail.data.total < 1) {
    throw new Error("Mock production preview has no work orders");
  }

  if (!Array.isArray(detail.data.records) || detail.data.records.length < 1) {
    throw new Error("Preview canonical records missing");
  }

  const toolNames = new Set(tools.tools.map((tool) => tool.name));

  for (const expected of [
    "get_demo_status",
    "run_round_trip",
    "get_production_candidates",
    "preview_production_orders",
  ]) {
    if (!toolNames.has(expected)) {
      throw new Error(`Missing MCP tool: ${expected}`);
    }
  }

  const resource = resources.resources.find((item) => item.uri === widgetUri);
  if (!resource) throw new Error("v2 widget resource missing");

  const html = widget.contents?.[0]?.text ?? "";

  for (const marker of [
    "ERP UI Runtime",
    "collection-workspace",
    "tree-detail",
    "ui/request-display-mode",
    "safeAreaInsets",
    "erp-brand-primary",
  ]) {
    if (!html.includes(marker)) {
      throw new Error(`Generic runtime marker missing: ${marker}`);
    }
  }

  const modes =
    widget.contents?.[0]?._meta?.["openai/ui"]?.availableDisplayModes ?? [];

  if (!modes.includes("inline") || !modes.includes("fullscreen")) {
    throw new Error("Widget does not declare inline + fullscreen");
  }

  console.log("SMOKE OK");
  console.log(`Protocol: ${initialized.protocolVersion}`);
  console.log(`Widget: ${widgetUri}`);
  console.log(`Tools: ${[...toolNames].join(", ")}`);
  console.log(`Workspace renderer: ${workspace.presentation.renderer}`);
  console.log(`Mock candidate records: ${workspace.data.total}`);
  console.log(`Detail renderer: ${detail.presentation.renderer}`);
  console.log(`Preview work orders: ${detail.data.total}`);
} finally {
  child.kill("SIGTERM");
  await sleep(100);

  if (serverOutput.trim()) {
    console.log("SERVER", serverOutput.trim());
  }
}
