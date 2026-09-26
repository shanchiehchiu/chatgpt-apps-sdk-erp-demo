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
  listProductionCandidates,
  previewProductionOrders,
} from "./server/model/demo-erp.js";
import {
  makeUiView,
  productionCandidatesPresentation,
  productionPreviewPresentation,
} from "./server/presentation/production.js";

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const widgetHtml = readFileSync(join(APP_DIR, "dist/index.html"), "utf8");
const WIDGET_URI = "ui://widget/erp-production-demo-v2.html";

let interactionCount = 0;
let lastInteractionAt = null;

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
    version: "0.2.0",
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
