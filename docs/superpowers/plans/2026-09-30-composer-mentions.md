# Composer Mentions（客戶 @ 提及）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 ChatGPT composer 可以用 `@` 搜尋、引用本專案的客戶資料，選取後模型能直接查詢該客戶的銷售排行。

**Architecture:** 延續既有 Model → MCP Tool（Controller）→ Presentation → Generic UI Runtime 分層。新增 `search_customer_mentions` tool 依 `openai/mcp-extensions` 的 `mentions/search` 規格回傳 `resource_link`；擴充既有 `get_customer_sales_ranking` 支援 `customer_id` 篩選。兩者都只碰 Model（`server/model/demo-erp.js`）與 Controller（`server.js`）層，Presentation／Renderer 完全不動。

**Tech Stack:** Node.js（`type: module`）、`@modelcontextprotocol/sdk`、`@modelcontextprotocol/ext-apps`、`zod`。專案沒有 unit test 框架，測試手段是 `smoke-test.js`——啟動真實 server、走 JSON-RPC、用 `if (...) throw new Error(...)` 斷言。本計畫沿用同一套手法做 TDD（先加斷言讓 smoke test 失敗，再實作讓它通過）。

**設計文件：** `docs/superpowers/specs/2026-09-30-composer-mentions-design.md`

---

## 執行前提

- 不需要另開 git worktree——改動範圍小、只有兩個檔案，直接在目前 working directory 進行即可。
- 不需要重新 build 前端（`npm run build`）：這次修改只碰 `server.js` 與 `server/model/demo-erp.js`，不動 `src/`，`dist/index.html` 維持既有 build 產物即可。因此所有驗證直接執行 `node smoke-test.js`，不要跑 `npm run test:smoke`（那個 script 會多跑一次不必要的 `vite build`）。
- 每個 task 結束都要確認沒有殘留的 `node server.js` 背景行程，避免佔用 port `18788`（smoke-test.js 固定使用這個 port）。

---

### Task 1: 新增 `search_customer_mentions` mention 搜尋 tool

**Files:**
- Modify: `server/model/demo-erp.js`（新增 `searchCustomers` function）
- Modify: `server.js:13-17`（import）、新增 tool 註冊（插在 `get_customer_sales_ranking` 與 `get_data_grid_demo` 兩個 tool 註冊之間）
- Test: `smoke-test.js`（新增 mention 搜尋斷言 + `toolNames` 檢查清單）

- [ ] **Step 1: 在 smoke-test.js 寫下會失敗的斷言**

在 `smoke-test.js` 第 247 行（`if (ranking.presentation.summary?.[2]?.label !== "退貨筆數") { throw new Error("Return count label mismatch"); }` 這段結束）之後、第 249 行 `const gridResult = await rpc(` 之前，插入：

```js
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
```

在 `smoke-test.js` 第 399-412 行的 `toolNames` 檢查清單中，於 `"get_customer_sales_ranking",` 之後加入一行：

```js
    "search_customer_mentions",
```

- [ ] **Step 2: 執行 smoke test，確認失敗**

Run: `node smoke-test.js`

Expected: 腳本印出 `SMOKE OK` 之前就丟出例外並結束（非 0 exit code）。因為 `search_customer_mentions` 這個 tool 還不存在，`tools/call` 會回傳 `{ isError: true, content: [{ type: "text", text: "MCP error -32602: Tool search_customer_mentions not found" }] }`（沒有 `structuredContent`），所以第一個新增的斷言 `mentionsAllResult.structuredContent?.items?.length !== 6` 會成立，丟出：
```
Error: Mention search with empty query should return all mock customers
```

- [ ] **Step 3: 在 Model 層新增 `searchCustomers`**

在 `server/model/demo-erp.js` 檔案最後（第 146 行 `}` 之後）加入：

```js

export async function searchCustomers(query = "") {
  const q = query.trim().toLowerCase();

  const matches = customerSales.filter((row) => {
    if (!q) return true;
    return (
      row.customer_name.toLowerCase().includes(q) ||
      row.customer_no.toLowerCase().includes(q)
    );
  });

  return matches
    .map(({ customer_id, customer_no, customer_name }) => ({
      customer_id,
      customer_no,
      customer_name,
    }))
    .sort((a, b) => a.customer_name.localeCompare(b.customer_name));
}
```

- [ ] **Step 4: 在 server.js 匯入 `searchCustomers`**

修改 `server.js` 第 13-17 行的 import，加入 `searchCustomers`：

```js
import {
  getCustomerSalesRanking,
  listProductionCandidates,
  previewProductionOrders,
  searchCustomers,
} from "./server/model/demo-erp.js";
```

- [ ] **Step 5: 在 server.js 註冊 `search_customer_mentions` tool**

在 `server.js` 中，找到 `get_customer_sales_ranking` 的 `registerAppTool(...)` 區塊結尾（該區塊以 `);` 結尾，緊接著下一行是 `registerAppTool(\n    server,\n    "get_data_grid_demo",`）。在這兩者之間插入：

```js
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

```

注意：這個 tool 刻意不使用既有的 `uiToolMeta()` helper——它預設 `visibility: ["model", "app"]` 並帶 `resourceUri: WIDGET_URI`，但 mention 搜尋是給 host 直接呼叫做 typeahead，不需要模型主動呼叫、也不會渲染 ERP widget，所以獨立寫 `_meta`。

- [ ] **Step 6: 執行 smoke test，確認通過**

Run: `node smoke-test.js`

Expected: 印出 `SMOKE OK` 以及後續的 log 行（`Protocol: ...`、`Tools: ...` 等），exit code 為 0。

若失敗，先確認沒有殘留的舊 `node server.js` 行程佔用 18788 port：`lsof -i :18788`，有的話 `kill` 掉再重跑。

- [ ] **Step 7: Commit**

```bash
git add server.js server/model/demo-erp.js smoke-test.js
git commit -m "$(cat <<'EOF'
Add search_customer_mentions tool for ChatGPT composer @-mentions

Implements the openai/mcp-extensions "Composer mentions" contract:
a mentions/search tool that lets users @-mention a customer directly
from the mock customer directory.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 擴充 `get_customer_sales_ranking` 支援 `customer_id` 篩選

**Files:**
- Modify: `server/model/demo-erp.js:87-146`（`getCustomerSalesRanking`）
- Modify: `server.js`（`get_customer_sales_ranking` 的 `inputSchema`）
- Test: `smoke-test.js`（新增 `customer_id` 篩選斷言）

- [ ] **Step 1: 在 smoke-test.js 寫下會失敗的斷言**

在 Task 1 新增的 mention 搜尋斷言區塊之後（即 `mentionTool` 的 visibility 檢查之後）、`const gridResult = await rpc(` 之前，插入：

```js
  const customerFilteredRankingResult = await rpc(
    "tools/call",
    {
      name: "get_customer_sales_ranking",
      arguments: {
        start_date: "2026-01-01",
        end_date: "2026-09-26",
        customer_id: 201,
      },
    },
    15,
  );

  const customerFiltered = assertUiView(
    customerFilteredRankingResult,
    "workspace",
    "ranked-list",
  );

  if (customerFilteredRankingResult.structuredContent?.count !== 1) {
    throw new Error(
      "Customer-filtered ranking should return exactly one record",
    );
  }

  if (customerFiltered.data.records.length !== 1) {
    throw new Error("Customer-filtered ranking canonical records mismatch");
  }

  const filteredRecord = customerFiltered.data.records[0];

  if (filteredRecord.customer_id !== 201) {
    throw new Error("Customer-filtered ranking returned wrong customer");
  }

  const matchingUnfiltered = ranking.data.records.find(
    (record) => record.customer_id === 201,
  );

  if (!matchingUnfiltered) {
    throw new Error("Customer 201 missing from unfiltered ranking baseline");
  }

  if (filteredRecord.rank !== matchingUnfiltered.rank) {
    throw new Error(
      "Customer-filtered rank should match unfiltered ranking baseline",
    );
  }

  if (filteredRecord.share_percent !== matchingUnfiltered.share_percent) {
    throw new Error(
      "Customer-filtered share_percent should match unfiltered ranking baseline",
    );
  }
```

（`ranking` 變數是先前既有的 `get_customer_sales_ranking` 無篩選呼叫結果，`assertUiView` helper 也是既有函式，兩者都已在檔案上方定義。）

- [ ] **Step 2: 執行 smoke test，確認失敗**

Run: `node smoke-test.js`

Expected: 目前 `get_customer_sales_ranking` 的 `inputSchema` 沒有 `customer_id` 欄位，zod 預設會忽略未知欄位（不會報錯），所以 tool 會照常回傳全體 6 筆客戶。`customerFilteredRankingResult.structuredContent?.count` 會是 `6` 而不是 `1`，丟出：
```
Error: Customer-filtered ranking should return exactly one record
```

- [ ] **Step 3: 擴充 Model 層 `getCustomerSalesRanking`**

把 `server/model/demo-erp.js` 第 87-146 行的 `getCustomerSalesRanking` 整個函式取代為：

```js
export async function getCustomerSalesRanking(input = {}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startDate = input.start_date ?? `${now.getUTCFullYear()}-01-01`;
  const endDate = input.end_date ?? today;
  const limit = Math.max(1, Math.min(Number(input.limit ?? 10), 50));

  const rows = customerSales
    .map((row) => ({
      ...row,
      net_sales_amount: row.gross_sales_amount - row.return_amount,
    }))
    .sort((a, b) => b.net_sales_amount - a.net_sales_amount);

  const netTotal = rows.reduce(
    (sum, row) => sum + row.net_sales_amount,
    0,
  );

  const rankedRows = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    share_percent: netTotal
      ? Number(((row.net_sales_amount / netTotal) * 100).toFixed(2))
      : 0,
  }));

  const records =
    input.customer_id != null
      ? rankedRows.filter((row) => row.customer_id === input.customer_id)
      : rankedRows.slice(0, limit);

  return {
    domain: "customer_sales_ranking",
    source: "mock-erp",
    period: {
      start_date: startDate,
      end_date: endDate,
    },
    metric: "net_sales_amount",
    currency: {
      id: 1,
      code: "NTD",
      name: "範例台幣",
      price_float: 0,
    },
    total: records.length,
    totalCustomers: rows.length,
    summary: {
      gross_sales_amount: rows.reduce(
        (sum, row) => sum + row.gross_sales_amount,
        0,
      ),
      return_amount: rows.reduce(
        (sum, row) => sum + row.return_amount,
        0,
      ),
      net_sales_amount: netTotal,
      sales_count: rows.reduce((sum, row) => sum + row.sales_count, 0),
      return_count: rows.reduce((sum, row) => sum + row.return_count, 0),
      customer_count: rows.length,
    },
    records,
  };
}
```

（差異：原本直接對 `rows.slice(0, limit)` 算 `rank`/`share_percent`；現在先對全體 `rows` 算出 `rankedRows`，再依 `customer_id` 是否提供決定要「篩選單一客戶」還是「照舊 slice(0, limit)」。`summary`／`totalCustomers` 維持以全體 `rows` 計算，篩選與否都一樣。）

- [ ] **Step 4: 在 server.js 的 inputSchema 加上 `customer_id`**

把 `get_customer_sales_ranking` tool 定義中的 `inputSchema`：

```js
      inputSchema: z.object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
```

改成：

```js
      inputSchema: z.object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        customer_id: z.number().int().optional(),
      }),
```

- [ ] **Step 5: 執行 smoke test，確認通過**

Run: `node smoke-test.js`

Expected: 印出 `SMOKE OK` 以及後續 log 行，exit code 為 0。

- [ ] **Step 6: Commit**

```bash
git add server.js server/model/demo-erp.js smoke-test.js
git commit -m "$(cat <<'EOF'
Add customer_id filter to get_customer_sales_ranking

Lets a @-mentioned customer (via search_customer_mentions) resolve
to a single-row ranking view, while rank/share_percent stay computed
against the full customer set for an accurate baseline.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## 完成後驗證

- [ ] 確認 `node smoke-test.js` 最後一次執行是乾淨通過（Step 2-Task2 之後沒有再改動任何檔案）。
- [ ] 確認沒有殘留的 `node server.js` 背景行程：`ps aux | grep "[s]erver.js"` 應該沒有輸出。
- [ ] `git log --oneline -3` 應該看到本計畫的兩個 commit。
