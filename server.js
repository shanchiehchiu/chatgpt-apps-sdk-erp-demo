import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  getCustomerSalesRanking,
  listProductionCandidates,
  previewProductionOrders,
  searchCustomers,
} from "./server/model/demo-erp.js";
import { getDataGridDemoData } from "./server/demo/grid-fixture.js";
import {
  getFormDemoData,
  submitFormDemo,
} from "./server/demo/form-fixture.js";
import { dataGridDemoPresentation } from "./server/presentation/grid.js";
import { formDemoPresentation } from "./server/presentation/form.js";
import {
  productionCandidatesPresentation,
  productionPreviewPresentation,
} from "./server/presentation/production.js";
import { customerSalesRankingPresentation } from "./server/presentation/sales.js";
import { makeUiView } from "./server/presentation/ui.js";

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const widgetHtml = readFileSync(join(APP_DIR, "dist/index.html"), "utf8");
const WIDGET_URI = "ui://widget/erp-production-demo-v7.html";

let interactionCount = 0;
let lastInteractionAt = null;

const formSubmissionCache = new Map();
const FORM_SUBMISSION_CACHE_LIMIT = 100;

function resolveFormSubmission(submissionId, createData) {
  if (!submissionId) return createData();

  if (formSubmissionCache.has(submissionId)) {
    return formSubmissionCache.get(submissionId);
  }

  const data = createData();
  formSubmissionCache.set(submissionId, data);

  if (formSubmissionCache.size > FORM_SUBMISSION_CACHE_LIMIT) {
    const oldestKey = formSubmissionCache.keys().next().value;
    formSubmissionCache.delete(oldestKey);
  }

  return data;
}

const projectSchema = z.object({
  name: z.string(),
  branch: z.string(),
  status: z.string(),
  modified: z.number(),
  added: z.number(),
  deleted: z.number(),
  interactionCount: z.number(),
  lastInteractionAt: z.string().nullable(),
});

function projectSnapshot() {
  return {
    name: "chatgpt-apps-sdk-erp-demo",
    branch: "main",
    status: "MCP connected",
    modified: 0,
    added: 0,
    deleted: 0,
    interactionCount,
    lastInteractionAt,
  };
}

function uiToolMeta(visibility = ["model", "app"]) {
  return {
    ui: {
      resourceUri: WIDGET_URI,
      visibility,
    },
  };
}

function createAppServer() {
  const server = new McpServer({
    name: "chatgpt-apps-sdk-erp-demo",
    version: "0.5.1",
  });

  registerAppResource(
    server,
    "erp-production-demo-widget",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: { prefersBorder: false },
            "openai/ui": {
              availableDisplayModes: ["inline", "fullscreen"],
            },
            "openai/widgetDescription":
              "Generic ERP UI runtime demo. Domain data and presentation schema are separated, then rendered by reusable enterprise UI primitives. Avoid duplicating the same rows in assistant prose.",
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "get_demo_status",
    {
      title: "取得 Demo 狀態",
      description: "確認 MCP server 與 Widget round trip 是否正常。",
      inputSchema: z.object({}),
      outputSchema: z.object({ project: projectSchema }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: { ui: { resourceUri: WIDGET_URI } },
    },
    async () => ({
      content: [{ type: "text", text: "Demo status loaded." }],
      structuredContent: { project: projectSnapshot() },
    }),
  );

  registerAppTool(
    server,
    "run_round_trip",
    {
      title: "測試 Widget 與 MCP 往返",
      description: "由 Widget 呼叫 MCP tool，更新 server state，再把結果送回 Widget。",
      inputSchema: z.object({}),
      outputSchema: z.object({ project: projectSchema }),
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: { ui: { resourceUri: WIDGET_URI } },
    },
    async () => {
      interactionCount += 1;
      lastInteractionAt = new Date().toISOString();

      return {
        content: [
          {
            type: "text",
            text: `Round trip #${interactionCount} completed.`,
          },
        ],
        structuredContent: { project: projectSnapshot() },
      };
    },
  );

  registerAppTool(
    server,
    "get_production_candidates",
    {
      title: "查詢待轉生產工單明細",
      description:
        "從範例 ERP Model 取得待轉生產工單的 canonical domain data，再套用獨立 presentation schema，由通用 collection-workspace renderer 顯示。",
      inputSchema: z.object({
        delivery_date_start: z.string().optional(),
        delivery_date_end: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("production_candidates"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(),
    },
    async (args) => {
      const data = await listProductionCandidates(args);
      const presentation = productionCandidatesPresentation();

      return {
        content: [],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  registerAppTool(
    server,
    "get_customer_sales_ranking",
    {
      title: "查詢客戶銷售排行",
      description:
        "從 Mock ERP 取得客戶淨銷售排行，並用通用 ranked-list renderer 呈現。若未提供日期，預設使用今年至今天。",
      inputSchema: z.object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        customer_id: z.number().int().optional(),
      }),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("customer_sales_ranking"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(),
    },
    async (args) => {
      const data = await getCustomerSalesRanking(args);
      const presentation = customerSalesRankingPresentation(data);

      return {
        content: [],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  registerAppTool(
    server,
    "search_customer_mentions",
    {
      title: "搜尋客戶提及",
      description:
        "供 ChatGPT composer 的 @ 提及 typeahead 搜尋使用，回傳可提及的客戶清單。",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({
        items: z.array(
          z.object({
            type: z.literal("resource_link"),
            uri: z.string(),
            name: z.string(),
          }),
        ),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      // 刻意不用 uiToolMeta()：這個 tool 只給 composer typeahead 呼叫，不渲染
      // widget，不可以帶 resourceUri（uiToolMeta() 預設會加上）。
      _meta: {
        "openai/extensions": { "mentions/search": {} },
        ui: { visibility: ["app"] },
      },
    },
    async ({ query }) => {
      const customers = await searchCustomers(query);

      return {
        content: [],
        structuredContent: {
          items: customers.map((customer) => ({
            type: "resource_link",
            uri: `erp://customer/${customer.customer_id}`,
            name: customer.customer_name,
          })),
        },
      };
    },
  );

  registerAppTool(
    server,
    "get_data_grid_demo",
    {
      title: "開啟 Data Grid Primitive",
      description:
        "載入一組 Mock Data，驗證通用 data-grid renderer：欄位 schema、搜尋、篩選、排序、分頁、多選、批次 action 與格式化。",
      inputSchema: z.object({
        ids: z.array(z.number().int()).optional(),
      }),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("data_grid_demo"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(),
    },
    async (args) => {
      const data = getDataGridDemoData(args);
      const presentation = dataGridDemoPresentation(data);

      return {
        content: [],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  registerAppTool(
    server,
    "get_form_demo",
    {
      title: "開啟 Form Primitive",
      description:
        "載入不綁定業務頁面的 Mock Form。每個使用者要求只需呼叫一次；Tool 成功後 UI 已完成載入，不要在同一回合重複呼叫。用來驗證欄位 schema、預設值、readonly / disabled、條件顯示、條件必填、前端驗證與 MCP submit action。",
      inputSchema: z.object({}),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("form_demo"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(),
    },
    async () => {
      const data = getFormDemoData();
      const presentation = formDemoPresentation();

      return {
        content: [
          {
            type: "text",
            text: `Form Primitive 已載入，共 ${data.total} 個欄位。UI 已呈現，本回合不需要再次載入。`,
          },
        ],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  registerAppTool(
    server,
    "submit_form_demo",
    {
      title: "驗證 Form Primitive",
      description:
        "接收 Form Primitive 值並執行 Mock 後端驗證。Demo 不寫入資料，只回傳驗證結果與欄位錯誤。",
      inputSchema: z.object({
        submission_id: z.string().min(1).max(120),
        values: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        ),
      }),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("form_demo"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(["app"]),
    },
    async ({ submission_id, values }) => {
      const data = resolveFormSubmission(
        submission_id,
        () => submitFormDemo(values, submission_id),
      );
      const presentation = formDemoPresentation();

      return {
        content: [
          {
            type: "text",
            text:
              data.result?.status === "success"
                ? "表單儲存流程已完成。"
                : "表單仍有欄位需要修正，已回傳欄位錯誤。",
          },
        ],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  registerAppTool(
    server,
    "preview_production_orders",
    {
      title: "預覽生產工單",
      description:
        "依照勾選的範例訂購明細產生 canonical preview data，再以獨立 tree-detail presentation schema 顯示 BOM、半成品與用料。此工具不會寫入資料。",
      inputSchema: z.object({
        ids: z.array(z.number().int()).min(1).max(30),
      }),
      outputSchema: z.object({
        view: z.literal("erp_ui"),
        domain: z.literal("production_order_preview"),
        count: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: uiToolMeta(["app"]),
    },
    async ({ ids }) => {
      const data = await previewProductionOrders(ids);
      const presentation = productionPreviewPresentation();

      return {
        content: [],
        structuredContent: {
          view: "erp_ui",
          domain: data.domain,
          count: data.total,
        },
        _meta: {
          erpUi: makeUiView(presentation, data),
        },
      };
    },
  );

  return server;
}

const port = Number(process.env.PORT ?? 18787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ChatGPT Apps SDK + MCP generic ERP UI runtime demo");
    return;
  }

  const allowed = new Set(["POST", "GET", "DELETE"]);

  if (url.pathname === MCP_PATH && req.method && allowed.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createAppServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`MCP demo listening on http://localhost:${port}${MCP_PATH}`);
});
