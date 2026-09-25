import { spawn } from "node:child_process";
import http from "node:http";

const port = 18788;
const widgetUri = "ui://widget/erp-production-demo-v1.html";

const child = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(port) }
});

let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function request({ method = "GET", path = "/", body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      method,
      path,
      headers
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({
        status: res.statusCode,
        body: data,
        headers: res.headers
      }));
    });

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
      accept: "application/json, text/event-stream"
    }
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

  const initialized = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "erp-demo-smoke-test", version: "0.1.0" }
  }, 1);

  const tools = await rpc("tools/list", {}, 2);
  const resources = await rpc("resources/list", {}, 3);
  const widget = await rpc("resources/read", { uri: widgetUri }, 4);

  const candidatesResult = await rpc("tools/call", {
    name: "get_production_candidates",
    arguments: { limit: 5 }
  }, 5);

  if (candidatesResult.structuredContent?.view !== "production_candidates") {
    throw new Error("Candidate view marker missing");
  }

  const candidates = candidatesResult._meta?.erpCandidates;
  if (!candidates || !Array.isArray(candidates.items) || candidates.items.length === 0) {
    throw new Error("Mock ERP candidates missing");
  }

  const target = candidates.items[0];

  const previewResult = await rpc("tools/call", {
    name: "preview_production_orders",
    arguments: { ids: [target.id] }
  }, 6);

  if (previewResult.structuredContent?.view !== "production_preview") {
    throw new Error("Preview view marker missing");
  }

  const preview = previewResult._meta?.erpPreview;
  if (!preview || preview.work_order_count < 1) {
    throw new Error("Production preview missing");
  }

  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  for (const expected of [
    "get_demo_status",
    "run_round_trip",
    "get_production_candidates",
    "preview_production_orders"
  ]) {
    if (!toolNames.has(expected)) {
      throw new Error(`Missing MCP tool: ${expected}`);
    }
  }

  const resource = resources.resources.find((item) => item.uri === widgetUri);
  if (!resource) throw new Error("Widget resource missing");

  const html = widget.contents?.[0]?.text ?? "";
  for (const marker of [
    "範例 ERP",
    "開啟工作台",
    "訂購轉生產工單",
    "ui/request-display-mode",
    "safeAreaInsets"
  ]) {
    if (!html.includes(marker)) {
      throw new Error(`Widget marker missing: ${marker}`);
    }
  }

  const modes = widget.contents?.[0]?._meta?.["openai/ui"]?.availableDisplayModes ?? [];
  if (!modes.includes("inline") || !modes.includes("fullscreen")) {
    throw new Error("Widget does not declare inline + fullscreen");
  }

  console.log("SMOKE OK");
  console.log(`Protocol: ${initialized.protocolVersion}`);
  console.log(`Widget: ${widgetUri}`);
  console.log(`Tools: ${[...toolNames].join(", ")}`);
  console.log(`Mock candidates: ${candidates.count}`);
  console.log(`Preview work orders: ${preview.work_order_count}`);
} finally {
  child.kill("SIGTERM");
  await sleep(100);
  if (serverOutput.trim()) console.log("SERVER", serverOutput.trim());
}
