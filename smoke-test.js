import { spawn } from "node:child_process";
import http from "node:http";

const port = 18788;
const widgetUri = "ui://widget/erp-production-demo-v7.html";

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
      clientInfo: { name: "erp-demo-smoke-test", version: "0.5.1" },
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

  const rankingResult = await rpc(
    "tools/call",
    {
      name: "get_customer_sales_ranking",
      arguments: {
        start_date: "2026-01-01",
        end_date: "2026-09-26",
        limit: 10,
      },
    },
    7,
  );

  if (rankingResult.structuredContent?.domain !== "customer_sales_ranking") {
    throw new Error("Customer sales ranking domain marker missing");
  }

  const ranking = assertUiView(rankingResult, "workspace", "ranked-list");

  if (!Array.isArray(ranking.data.records) || ranking.data.records.length < 1) {
    throw new Error("Mock customer sales ranking records missing");
  }

  if (ranking.data.metric !== "net_sales_amount") {
    throw new Error("Customer sales ranking metric mismatch");
  }
  if (ranking.data.currency?.code !== "NTD") {
    throw new Error("Mock ranking currency missing");
  }
  if (ranking.presentation.summary?.[0]?.currency !== "TWD") {
    throw new Error("Presentation did not normalize NTD to TWD");
  }
  if (ranking.presentation.summary?.[1]?.label !== "銷售筆數") {
    throw new Error("Sales count label mismatch");
  }
  if (ranking.presentation.summary?.[2]?.label !== "退貨筆數") {
    throw new Error("Return count label mismatch");
  }

  const mentionsAllResult = await rpc(
    "tools/call",
    {
      name: "search_customer_mentions",
      arguments: { query: "" },
    },
    13,
  );

  if (mentionsAllResult.structuredContent?.items?.length !== 6) {
    throw new Error(
      "Mention search with empty query should return all mock customers",
    );
  }

  const mentionsFilteredResult = await rpc(
    "tools/call",
    {
      name: "search_customer_mentions",
      arguments: { query: "範例客戶 A" },
    },
    14,
  );

  const mentionItems = mentionsFilteredResult.structuredContent?.items ?? [];

  if (mentionItems.length !== 1) {
    throw new Error("Mention search should match exactly one customer");
  }

  if (mentionItems[0].type !== "resource_link") {
    throw new Error("Mention item should be a resource_link");
  }

  if (mentionItems[0].uri !== "erp://customer/201") {
    throw new Error("Mention item uri mismatch");
  }

  if (mentionItems[0].name !== "範例客戶 A") {
    throw new Error("Mention item name mismatch");
  }

  const mentionTool = tools.tools.find(
    (tool) => tool.name === "search_customer_mentions",
  );

  if (!mentionTool?._meta?.["openai/extensions"]?.["mentions/search"]) {
    throw new Error(
      "Mention search tool missing mentions/search extension meta",
    );
  }

  if (!(mentionTool?._meta?.ui?.visibility ?? []).includes("app")) {
    throw new Error("Mention search tool must be visible to app");
  }

  const gridResult = await rpc(
    "tools/call",
    {
      name: "get_data_grid_demo",
      arguments: {},
    },
    8,
  );

  if (gridResult.structuredContent?.domain !== "data_grid_demo") {
    throw new Error("Data Grid demo domain marker missing");
  }

  const dataGrid = assertUiView(gridResult, "workspace", "data-grid");

  if (!Array.isArray(dataGrid.data.records) || dataGrid.data.records.length < 20) {
    throw new Error("Data Grid fixture records missing");
  }

  if ((dataGrid.presentation.grid?.columns ?? []).length < 6) {
    throw new Error("Data Grid columns schema missing");
  }

  if ((dataGrid.presentation.filters ?? []).length < 3) {
    throw new Error("Data Grid filter schema missing");
  }

  if (dataGrid.presentation.selection?.mode !== "multiple") {
    throw new Error("Data Grid multi-select schema missing");
  }

  if (dataGrid.presentation.pagination?.mode !== "client") {
    throw new Error("Data Grid pagination schema missing");
  }

  const formResult = await rpc(
    "tools/call",
    {
      name: "get_form_demo",
      arguments: {},
    },
    9,
  );

  if (formResult.structuredContent?.domain !== "form_demo") {
    throw new Error("Form demo domain marker missing");
  }

  const formView = assertUiView(formResult, "workspace", "form");
  const formFields = formView.presentation.form?.fields ?? [];

  if (!(formResult.content?.[0]?.text ?? "").includes("本回合不需要再次載入")) {
    throw new Error("Form load completion message missing");
  }

  if (formFields.length < 10) {
    throw new Error("Form field schema missing");
  }

  if ((formView.presentation.form?.sections ?? []).length < 3) {
    throw new Error("Form section schema missing");
  }

  if (formView.presentation.submit?.tool !== "submit_form_demo") {
    throw new Error("Form submit action schema missing");
  }

  const invalidFormResult = await rpc(
    "tools/call",
    {
      name: "submit_form_demo",
      arguments: {
        submission_id: "smoke-invalid-1",
        values: {
          ...formView.data.values,
          delivery_method: "delivery",
          delivery_address: "",
          urgent: true,
          urgent_reason: "",
        },
      },
    },
    10,
  );

  const invalidForm = assertUiView(invalidFormResult, "workspace", "form");
  if (invalidForm.data.result?.status !== "error") {
    throw new Error("Form backend validation error state missing");
  }
  if (!invalidForm.data.result?.errors?.delivery_address) {
    throw new Error("Conditional delivery address validation missing");
  }
  if (!invalidForm.data.result?.errors?.urgent_reason) {
    throw new Error("Conditional urgent reason validation missing");
  }

  const validFormResult = await rpc(
    "tools/call",
    {
      name: "submit_form_demo",
      arguments: {
        submission_id: "smoke-success-1",
        values: {
          ...formView.data.values,
          delivery_method: "delivery",
          delivery_address: "範例市測試路 100 號",
          urgent: true,
          urgent_reason: "Demo 測試",
        },
      },
    },
    11,
  );

  const validForm = assertUiView(validFormResult, "workspace", "form");
  if (validForm.data.result?.status !== "success") {
    throw new Error("Form backend validation success state missing");
  }
  if (validForm.data.result?.title !== "已儲存變更") {
    throw new Error("Form success feedback title missing");
  }
  if (validForm.data.result?.submission_id !== "smoke-success-1") {
    throw new Error("Form submission id missing");
  }

  const replayFormResult = await rpc(
    "tools/call",
    {
      name: "submit_form_demo",
      arguments: {
        submission_id: "smoke-success-1",
        values: {
          ...formView.data.values,
          customer_name: "",
        },
      },
    },
    12,
  );

  const replayForm = assertUiView(replayFormResult, "workspace", "form");
  if (replayForm.data.result?.status !== "success") {
    throw new Error("Form idempotent replay did not reuse first result");
  }
  if (replayForm.data.values?.customer_name === "") {
    throw new Error("Form idempotent replay executed duplicate payload");
  }

  const toolNames = new Set(tools.tools.map((tool) => tool.name));

  for (const expected of [
    "get_demo_status",
    "run_round_trip",
    "get_production_candidates",
    "get_customer_sales_ranking",
    "search_customer_mentions",
    "get_data_grid_demo",
    "get_form_demo",
    "submit_form_demo",
    "preview_production_orders",
  ]) {
    if (!toolNames.has(expected)) {
      throw new Error(`Missing MCP tool: ${expected}`);
    }
  }

  const resource = resources.resources.find((item) => item.uri === widgetUri);
  if (!resource) throw new Error("v7 widget resource missing");

  const html = widget.contents?.[0]?.text ?? "";

  for (const marker of [
    "ERP UI Runtime",
    "collection-workspace",
    "data-grid",
    "erp-form-control",
    "ranked-list",
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
  console.log(`Ranking renderer: ${ranking.presentation.renderer}`);
  console.log(`Mock ranked customers: ${ranking.data.total}`);
  console.log(`Grid renderer: ${dataGrid.presentation.renderer}`);
  console.log(`Grid records: ${dataGrid.data.total}`);
  console.log(`Form renderer: ${formView.presentation.renderer}`);
  console.log(`Form fields: ${formFields.length}`);
  console.log(`Form submit: ${validForm.data.result.status}`);
} finally {
  child.kill("SIGTERM");
  await sleep(100);

  if (serverOutput.trim()) {
    console.log("SERVER", serverOutput.trim());
  }
}
