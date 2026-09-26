# 架構說明：MCP + Apps SDK 的 MVC / ViewModel 做法

這個 Demo 刻意不採用「一個 ERP 功能寫一套 React Page」的方式。

核心目標是：

> ERP 能力與資料保持穩定，UI 只是可替換的表示層。

整體可以直接用熟悉的 MVC / ViewModel 思路理解：

```text
ERP / Domain Service
        ↓
Model Adapter
        ↓
MCP Tool / Controller
        ↓
Canonical Domain Data
        +
Presentation / ViewModel Schema
        ↓
Generic UI Runtime
        ↓
React Renderer
```

## 1. Model / Domain

檔案：

```text
server/model/demo-erp.js
```

它的責任只有：

- 取得 ERP / API / DB 資料
- 整理成穩定的 domain data
- 不知道畫面要用表格、列表還是圖表

例如：

```js
{
  domain: "production_candidates",
  source: "mock-erp",
  total: 5,
  records: [...]
}
```

未來接真實 ERP 時，只需要把 Mock Adapter 換成 REST API、Laravel Service 或其他 backend adapter。

## 2. Controller / MCP Tool

檔案：

```text
server.js
```

MCP Tool 的角色很像 Controller：

1. 接收 tool arguments
2. 呼叫 Model
3. 選擇適合的 Presentation Adapter
4. 回 MCP result

Tool 本身不寫 JSX，也不決定 CSS。

目前 UI-first Tool 的結果大致是：

```js
structuredContent: {
  view: "erp_ui",
  domain: "production_candidates",
  count: 5
},
_meta: {
  erpUi: {
    slot: "workspace",
    presentation: {...},
    data: {...}
  }
}
```

## 3. Presentation / ViewModel

檔案：

```text
server/presentation/production.js
```

Presentation 只描述：

- 用哪個 renderer
- 哪些欄位是 title / subtitle / meta
- 哪些欄位可搜尋
- 是否支援 multiple selection
- batch action 要呼叫哪個 MCP Tool
- detail 要用哪個 renderer

例如：

```js
{
  renderer: "collection-workspace",
  search: {
    fields: ["order_no", "customer_name", "product_name"]
  },
  selection: {
    mode: "multiple",
    action: {
      tool: "preview_production_orders",
      input: { ids: "$selection" }
    }
  }
}
```

這一層就是 ViewModel / Presentation Adapter。

## 4. View / Generic UI Runtime

檔案：

```text
src/runtime/
```

目前有五個 reusable primitives：

### collection-workspace

負責：

- inline 摘要
- fullscreen 工作台
- 搜尋
- 多選
- 全選目前結果
- contextual batch action
- loading / error
- safe area
- detail slot

### data-grid

負責：

- 欄位 schema
- 搜尋
- select / 日期 / 數值篩選
- 排序
- client pagination
- checkbox 多選
- contextual batch action
- badge / number / currency / date formatting
- inline / fullscreen

進階篩選採 progressive disclosure；batch toolbar 只有在選取資料後才出現。

### form

負責：

- section / field schema
- 預設值
- readonly / disabled
- text / number / date / select / textarea / checkbox
- 條件顯示 / 條件必填
- 前端驗證與欄位錯誤
- dirty state / reset
- MCP submit action
- submission id / idempotency
- 成功 / 失敗儲存回饋
- 後端驗證錯誤回填
- inline / fullscreen

Form 以減少輸入為優先，label 永久可見，不使用 placeholder 取代 label。

### ranked-list

負責：

- 排名
- summary metrics
- 主值 / 次要值格式化
- 占比 progress
- inline / fullscreen

### tree-detail

負責：

- parent / child tree
- summary
- status
- 展開 nested materials
- detail footer action

`AppRenderer.jsx` 會依照：

```js
presentation.renderer
```

決定要使用哪一個通用 Renderer。

## 5. MCP Apps Bridge

檔案：

```text
src/mcp/useMcpBridge.js
```

它只負責 Host communication：

- `ui/initialize`
- tool result notification
- `tools/call`
- inline / fullscreen
- safe area
- bridge error

它不知道「訂購單」、「客戶」或「BOM」是什麼。

## 新功能怎麼加？

「客戶銷售排行」已經作為第二個 use case 完成，而且沒有建立：

```text
CustomerSalesRankingPage.jsx
```

實際流程：

```text
get_customer_sales_ranking
      ↓
Model 回 canonical data
      ↓
sales presentation schema
      ↓
通用 ranked-list renderer
```

這證明新功能不必等於新頁面。之後如果既有 renderer 能表達，就只新增 Model / Tool / Presentation。

`data-grid` 與 `form` 都已用獨立 Primitive Lab 完成，不綁任何 ERP 業務頁面。查詢型功能提供 records + columns / filters / actions schema；表單型功能提供 values + sections / fields / submit schema。

只有新的 workflow 真的需要不同 interaction pattern 時，才新增 primitive，例如：

- `detail`
- `chart`
- `master-detail`

## 為什麼這樣設計？

因為目標不是做一個 Demo 畫面，而是支援很多 ERP capabilities：

```text
100 個 MCP capabilities
        ↓
少量 Presentation Schema
        ↓
6～10 個穩定的 enterprise UI primitives
```

這樣可以避免：

```text
功能 A → APage.jsx
功能 B → BPage.jsx
功能 C → CPage.jsx
...
```

## 未來接 Gen UI

目前 Renderer 是我們自己的 React Runtime：

```text
Canonical Data
+
Presentation Schema
        ↓
AppRenderer
```

如果未來 ChatGPT / MCP Host 提供成熟的 declarative Gen UI：

```text
Canonical Data
+
Presentation Intent / Schema
        ↓
Host-native Gen UI
```

Model、ERP business logic 與 MCP capability 不需要重寫。

也就是：

> 現在先把資料與表示拆乾淨，未來換 UI Runtime，而不是換整個後端。
