# Composer Mentions（客戶 @ 提及）設計文件

日期：2026-09-30

## 背景與目標

`openai/mcp-extensions` 為 ChatGPT 的 MCP host 定義了一組 ChatGPT 專屬擴充能力，其中
「Composer mentions」讓使用者可以在對話輸入框用 `@` 直接搜尋、引用插件內的資源，
不必先讓模型跑一輪對話才能查到特定資料。

本設計把這個能力套用到本專案的「客戶銷售排行」功能：使用者在 composer 打
`@客戶名稱` 時，能直接從既有的 `customerSales` mock 資料中挑出客戶，選取後
模型可以直接查詢該客戶的銷售排行資料，而不需要重新描述客戶身份。

### 規格依據（`openai/mcp-extensions` docs/spec.md）

- Server 端只需要註冊一個一般的 MCP tool，並在 `_meta` 加上
  `"openai/extensions": { "mentions/search": {} }`，且 `_meta.ui.visibility`
  必須包含 `"app"`。
- 輸入：`{ query: string }`（`query` 可以是空字串）。
- 輸出：`{ items: ResourceLink[] }`，其中每個 `ResourceLink` 為
  `{ type: "resource_link", uri: string, name: string }`。
- 使用者選取後，該 resource_link 會被 ChatGPT host 當作一般 content block
  （可移除的 composer attachment）送進對話，**不會**觸發 `resources/read`
  或其他額外 handler；server 不需要另外解析這個 uri 本身。也因此，真正讓
  mention 產生效果的關鍵在於「模型後續呼叫既有 tool 時，能不能用這個 uri
  對應到的識別碼去做篩選」。

## 範圍

- **僅涵蓋客戶（customer）** 這個 domain entity，對應既有的
  `get_customer_sales_ranking` 功能。
- **不包含**：sidebar entrypoints、file extension handlers、extended
  forms（elicitation）。這三項屬於 `openai/mcp-extensions` 的其他擴充能力，
  與本次需求（客戶快速引用）無關，不在本次設計範圍內。
- **不包含**生產候選工單（production candidates）的 mention 搜尋——已與使用者
  確認本次只做客戶。

## 架構總覽

延續專案既有的 Model → MCP Tool（Controller）→ Presentation → Generic UI
Runtime 分層，這次新增/修改的部分都只落在 **Model** 與 **Controller** 兩層，
完全不動 Presentation 或 Renderer：

```text
customerSales (既有 mock 陣列，server/model/demo-erp.js)
        │
        ├── searchCustomers(query)           ← 新增
        │        ↓
        │   search_customer_mentions tool     ← 新增（server.js）
        │        ↓（回傳 resource_link 給 composer 選取）
        │
        └── getCustomerSalesRanking(input)   ← 擴充，加 customer_id 篩選
                 ↓
            get_customer_sales_ranking tool   ← 擴充 inputSchema（server.js）
                 ↓
            customerSalesRankingPresentation  ← 不變
                 ↓
            ranked-list renderer              ← 不變
```

## 元件設計

### 1. Model 層：`searchCustomers(query)`

新增於 `server/model/demo-erp.js`，直接重用既有的 `customerSales` 陣列
（不另外抽出新檔案，維持該陣列目前的唯一資料來源角色）。

行為：

- `query` 為空字串（或未提供）時，回傳全部客戶，依 `customer_name` 排序。
- 非空時，對 `customer_name`、`customer_no` 做 case-insensitive substring
  match（兩者符合其一即算命中）。
- 回傳欄位只需要 `{ customer_id, customer_no, customer_name }`——mention
  搜尋只是給使用者挑客戶，不需要銷售數字。

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

### 2. MCP Tool：`search_customer_mentions`

新增於 `server.js`，是本次唯一的全新 tool。

- **inputSchema**：`z.object({ query: z.string() })`
- **outputSchema**：
  ```js
  z.object({
    items: z.array(
      z.object({
        type: z.literal("resource_link"),
        uri: z.string(),
        name: z.string(),
      }),
    ),
  })
  ```
- **`_meta`**：
  ```js
  {
    "openai/extensions": { "mentions/search": {} },
    ui: { visibility: ["app"] },
  }
  ```
  這裡刻意不套用既有的 `uiToolMeta()` helper（它預設 `visibility:
  ["model", "app"]` 並帶 `resourceUri: WIDGET_URI`）——這個 tool 是給 ChatGPT
  composer 直接呼叫做 typeahead 搜尋用的，不需要、也不應該讓模型主動呼叫，
  更不會渲染我們的 ERP widget，所以獨立寫一份 `_meta`。
- **annotations**：`readOnlyHint: true`、`openWorldHint: false`、
  `destructiveHint: false`（與其餘查詢型 tool 一致）。
- **URI scheme**：`erp://customer/{customer_id}`，例如
  `erp://customer/201`。這是本專案自訂的 scheme，純粹作為之後
  `get_customer_sales_ranking` 解析 `customer_id` 的識別碼載體；不需要註冊
  對應的 `resources/*` handler（依規格，host 不會對它呼叫 `resources/read`）。
- **name**：直接使用 `customer_name`（mock 資料中名稱已唯一，不需要加註
  `customer_no` 消歧）。
- **Handler**：

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
          items: customers.map((c) => ({
            type: "resource_link",
            uri: `erp://customer/${c.customer_id}`,
            name: c.customer_name,
          })),
        },
      };
    },
  );
  ```

### 3. 擴充 `get_customer_sales_ranking`

**Model 層**（`getCustomerSalesRanking`，`server/model/demo-erp.js`）：

- `input` 新增可選欄位 `customer_id`。
- 排名／占比計算邏輯不變——永遠先對「全體客戶」算出 `rank` 與
  `share_percent`，確保排名與占比在有無篩選時都是同一套基準，不會因為篩選
  而失真。
- 在套用 `limit` 之前，如果 `input.customer_id` 有提供：
  - 從已算好 rank/share 的全體結果中，找出 `customer_id` 相符的那一筆，
    `records` 陣列只放這一筆，`total` 對應變成 `1`（找不到則 `records: []`、
    `total: 0`）。
  - 忽略 `limit`（篩選單一客戶時，limit 沒有意義）。
- `summary`（`net_sales_amount` 等彙總）與 `period` 維持以全體客戶計算，讓
  fullscreen 畫面上方的 Summary Strip 仍能呈現「這位客戶在整體中的位置」的
  對照基準。

**Controller 層**（`server.js` 內 `get_customer_sales_ranking` 的
`inputSchema`）新增：

```js
customer_id: z.number().int().optional(),
```

其餘 tool 定義（`outputSchema`、`annotations`、`_meta`）不變。

**Presentation / Renderer**：完全不需要修改。`customerSalesRankingPresentation`
與 `RankedList.jsx` 本來就是單純渲染 `data.records` 陣列，篩選後只剩一筆一樣
能正確顯示 rank 徽章、名稱、金額、占比與進度條。

## 測試計畫

延續 `smoke-test.js` 既有的「起一個真實 server + 走 JSON-RPC」風格，新增兩段
驗證（不引入測試框架）：

1. **`search_customer_mentions`**
   - `query: ""` → 斷言回傳 `items.length === 6`（等於 mock 客戶總數）。
   - `query: "範例客戶 A"` → 斷言剛好命中 1 筆，且
     `items[0].uri === "erp://customer/201"`、`items[0].name === "範例客戶 A"`。
   - 斷言 `tools/list` 回傳的 tool 定義中，`search_customer_mentions` 的
     `_meta["openai/extensions"]["mentions/search"]` 存在。

2. **`get_customer_sales_ranking` 加 `customer_id`**
   - 帶入 `customer_id: 201` → 斷言 `structuredContent.count === 1`，
     `_meta.erpUi.data.records.length === 1`，且該筆 `customer_id === 201`。
   - 斷言該筆的 `rank`／`share_percent` 與「不帶 `customer_id` 查詢全體」時
     同一位客戶的數值一致（驗證排名基準沒有因篩選而改變）。

3. 既有 `toolNames` 檢查清單（smoke-test.js 第 399-412 行）加入
   `"search_customer_mentions"`。

## 非目標 / Out of Scope

- 生產候選工單（production candidates）尚不支援 mention 搜尋。
- Sidebar entrypoints、file extension handlers、extended forms（elicitation）
  三項 `mcp-extensions` 能力不在本次範圍。
- 不處理「未來接真實 ERP 時如何做全文搜尋 / 分頁」——目前 6 筆 mock 資料用
  substring match 已足夠，真實資料量大時的索引策略留待實際串接時再設計。

## 風險與已知限制

- Mock 客戶名稱目前互不重複，因此 `search_customer_mentions` 的回傳沒有做
  `customer_no` 消歧顯示；若未來 mock 資料出現同名客戶，需要在 `name` 欄位
  補上 `customer_no`。
- `erp://customer/{id}` 是本專案自訂 scheme，未註冊為標準 MCP resource；若
  未來有需要讓其他 tool 或外部系統解析這個 uri，需另外設計 resource
  handler，目前規格不要求也不涵蓋。
