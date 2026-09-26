# ChatGPT Apps SDK + MCP ERP Demo

這是一個給團隊理解 **MCP、MCP Apps 與 ChatGPT Apps SDK** 的最小可跑範例。

它模擬一個常見 ERP 流程：

1. 使用者在 ChatGPT 詢問「有哪些訂購明細還沒轉生產工單」
2. ChatGPT 呼叫 MCP Tool
3. MCP Server 取得 ERP 資料
4. ChatGPT 內直接顯示互動式 Widget
5. 使用者勾選資料後，在 Widget 內再呼叫 MCP Tool
6. 右側預覽 BOM、半成品與生產工單結構

> 這個 Repository 是公開教學版。所有客戶、產品、BOM、品牌、專案名稱與資料都已改成 Mock Data，沒有連線任何真實 ERP 或資料庫。

---

## 先用一句話理解

如果同事不知道 MCP，可以先這樣理解：

> **MCP 可以先想成「給 AI 使用的 API 標準」；Apps SDK 則讓 MCP Tool 不只回文字，還能在 ChatGPT 裡顯示可操作的 UI。**

```text
使用者
  ↓
ChatGPT
  ↓  理解自然語言
MCP Tool
  ↓
你的後端 / ERP / API
  ↓
Tool Result
  ↓
MCP Apps UI Resource
  ↓
ChatGPT 裡的 React Widget
```

---

## 名詞不用背很多

| 名詞 | 在這個 Demo 裡的用途 |
| --- | --- |
| MCP Tool | AI 可以呼叫的後端能力 |
| MCP Resource | MCP 可以讀取的資源 |
| MCP Apps | MCP 的 UI 擴充標準，讓 Tool 可以綁定互動式 UI |
| Apps SDK | ChatGPT 對 MCP / MCP Apps 的產品整合與 UI 能力 |
| Widget | 真正在 ChatGPT iframe 裡執行的前端 UI |

最重要的觀念：

```text
MCP Tool
= 做事情

UI Resource
= 畫介面

_meta.ui.resourceUri
= 把 Tool 和 UI 綁在一起
```

---

## 這個 Demo 做了什麼

### 1. MCP Server

`server.js` 提供五個 Tool：

- `get_demo_status`
- `run_round_trip`
- `get_production_candidates`
- `get_customer_sales_ranking`
- `preview_production_orders`

其中包含兩個不同的 UI use case：「訂購轉生產工單」與「客戶銷售排行」。

### 2. Model / Domain Data

`server/model/demo-erp.js` 把 Mock ERP 整理成穩定的 canonical data：

```js
{
  domain: "production_candidates",
  total: 5,
  records: [...]
}
```

這一層只知道 ERP 資料，不知道畫面長什麼樣。

### 3. Presentation / ViewModel

`server/presentation/` 只描述「資料要怎麼呈現」；目前包含 production 與 sales 兩組 ViewModel：

```js
{
  renderer: "collection-workspace",
  search: {...},
  collection: {...},
  selection: {...}
}
```

資料與表示分開，所以未來換 Renderer 或接 Host-native Gen UI，不需要重寫 ERP capability。

### 4. MCP UI Resource

Server 註冊：

```text
ui://widget/erp-production-demo-v4.html
```

Widget build 後會以 HTML resource 提供給支援 MCP Apps 的 Host。

### 5. Generic UI Runtime

`src/runtime/` 不是某一個 ERP 功能的完整頁面，而是一組可重複使用的 Renderer。

目前有：

- `collection-workspace`：inline 摘要、搜尋、多選、批次 action、fullscreen 工作台
- `ranked-list`：排行、摘要指標、占比、inline / fullscreen
- `tree-detail`：樹狀工單 / BOM / 用料 detail

第二個 use case「客戶銷售排行」已經用 `ranked-list` 完成，而且沒有建立 `CustomerSalesRankingPage.jsx`。金額格式也由 domain data 的幣別資訊轉成 presentation schema，例如 NTD 會顯示為 NT$；Renderer 本身不寫死幣別。這就是資料 / Presentation / Renderer 分離真正要解決的問題。

### 6. Mock ERP

`mock-erp.js` 完全是假的範例資料：

- 假客戶
- 假訂單
- 假產品
- 假 BOM
- 假工單編號

所以 Clone 下來就能直接跑，不需要公司資料庫。

---

## 實際資料流

第一次由模型呼叫：

```text
使用者
  ↓
ChatGPT
  ↓
MCP Tool / Controller
  ↓
Model → Canonical Domain Data
  +
Presentation Adapter → UI Schema
  ↓
_meta.erpUi
  ↓
Generic AppRenderer
  ↓
collection-workspace
```

使用者在 Widget 裡勾選後：

```text
Generic Renderer
  ↓ tools/call
preview_production_orders
  ↓
Model → Preview Domain Data
  +
Presentation → tree-detail schema
  ↓
同一個 UI Runtime
  ↓
右側展開 BOM / 半成品 / 用料
```

這就是 Apps SDK / MCP Apps 比純文字 Tool 多出來的價值：

> **同一個對話裡，可以從自然語言進入 UI，再從 UI 繼續操作後端。**

---

## 專案結構

```text
.
├── server.js                  # MCP Controller / Tools / UI Resource
├── mock-erp.js                # 完全假的 ERP 原始資料
├── server/
│   ├── model/
│   │   └── demo-erp.js        # Canonical Domain Data
│   └── presentation/
│       ├── production.js      # 生產流程 ViewModel
│       ├── sales.js           # 銷售排行 ViewModel
│       └── ui.js              # 共用 ViewModel helper
├── src/
│   ├── main.jsx               # 很薄的 App entry
│   ├── mcp/
│   │   └── useMcpBridge.js    # MCP Apps bridge
│   ├── runtime/
│   │   ├── AppRenderer.jsx
│   │   ├── BrandLockup.jsx
│   │   ├── CollectionWorkspace.jsx
│   │   ├── RankedList.jsx
│   │   ├── TreeDetail.jsx
│   │   └── value.js
│   ├── components/
│   │   └── ProjectStatusCard.jsx
│   └── main.css
├── smoke-test.js
├── dev-tunnel.js
└── package.json
```

更完整的分層說明請看 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 本機啟動

需求：

- Node.js 20+
- npm

安裝：

```bash
npm install
```

先跑整合測試：

```bash
npm run test:smoke
```

正常會看到：

```text
SMOKE OK
```

啟動 MCP Server：

```bash
npm run start
```

預設：

```text
http://localhost:18787/mcp
```

---

## 要接 ChatGPT 測試

ChatGPT 需要可以從網路存取你的 MCP Server，所以本機開發時需要 HTTPS tunnel。

如果有安裝 `cloudflared`：

```bash
npm run dev:tunnel
```

它會輸出類似：

```text
https://xxxxx.trycloudflare.com/mcp
```

然後在 ChatGPT Developer Mode 裡新增 MCP / Plugin 連線，填入這個 `/mcp` URL。

> 開發用 Quick Tunnel 不適合正式環境。正式部署請使用自己的 HTTPS domain、Authentication、Authorization 與 audit log。

---

## Tool 為什麼不直接回 HTML？

這裡刻意把兩件事分開：

### Tool 回資料

```js
return {
  structuredContent: {
    view: "erp_ui",
    domain: data.domain,
    count: data.total
  },
  _meta: {
    erpUi: {
      slot: presentation.slot,
      presentation,
      data
    }
  }
};
```

### Resource 回 UI

```js
registerAppResource(
  server,
  "erp-production-demo-widget",
  "ui://widget/erp-production-demo-v4.html",
  ...
);
```

### 再用 metadata 綁定

```js
_meta: {
  ui: {
    resourceUri: "ui://widget/erp-production-demo-v4.html"
  }
}
```

所以不是 Tool 直接塞一坨 HTML 回去。

比較接近：

```text
Tool
≈ Controller / API

UI Resource
≈ View / SPA Bundle

resourceUri
≈ 指定這個 Tool 要搭配哪個 View
```

---

## `structuredContent` 和 `_meta` 的差別

這個 Demo 刻意示範一個 UI-first 做法。

`structuredContent` 只放很小的 view marker：

```js
{
  view: "production_candidates"
}
```

完整列表放在：

```js
_meta.erpCandidates
```

好處是可以降低模型把 Widget 裡的資料再重複講一次的機率。

但如果你的 Tool 必須在「不支援 UI 的 MCP Client」也完整可用，就應該把模型需要的安全資料放進 `structuredContent`。

也就是：

> **`_meta` 適合 UI 專用資料；`structuredContent` 適合模型也需要理解的資料。**

---

## 如何換成真實 ERP

Demo 現在是：

```text
server.js
  ↓
mock-erp.js
```

正式專案可以替換成：

```text
server.js
  ↓
REST API
  ↓
Laravel / Rails / Spring / Rust
  ↓
DB
```

或：

```text
server.js
  ↓
內部 service / adapter
  ↓
既有 ERP business logic
```

建議原則：

1. **不要把 business logic 重寫進 MCP Server**
2. MCP Server 只負責把既有能力包成清楚的 Tool
3. Tool input / output 要有 schema
4. 寫入型 Tool 要清楚標示 destructive / confirmation 行為
5. UI 只是 workflow layer，不要讓安全規則只存在前端

---

## 為什麼有 inline 和 fullscreen？

Inline 適合：

- 快速看摘要
- 顯示少量待處理資料
- 提供進入完整工作流程的入口

Fullscreen 適合：

- 搜尋
- 多選
- 批次操作
- 複雜資料比較
- BOM / tree / split view

不要把整套 ERP 塞進聊天訊息裡的小卡片。

---

## 安全注意事項

公開 Repository 前至少確認：

- 不要提交 API Key / Token / Password
- 不要提交真實客戶名稱
- 不要提交真實產品與訂單
- 不要提交內網 Domain / IP
- 不要提交本機絕對路徑
- 不要提交 production DB connection
- 不要把 Authorization 只做在 Widget
- 不要因為 Tool 是 app-only 就假設後端不需要權限檢查

這個 Demo 本身沒有任何真實系統連線。

---

## 技術棧

- React
- Vite
- Tailwind CSS
- `@modelcontextprotocol/sdk`
- `@modelcontextprotocol/ext-apps`
- `@openai/apps-sdk-ui`
- Zod

---

## 延伸閱讀

- OpenAI — MCP server and UI quickstart  
  https://developers.openai.com/plugins/build/app-quickstart

- OpenAI — Add UI to your MCP server  
  https://developers.openai.com/plugins/build/chatgpt-ui

- OpenAI — Build an MCP server  
  https://developers.openai.com/plugins/build/mcp-server

- MCP Apps specification / SDK  
  https://github.com/modelcontextprotocol/ext-apps

---

## License

MIT
