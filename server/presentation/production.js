const BRAND = {
  mark: "E",
  name: "範例 ERP",
  section: "生產管理",
};

export function productionCandidatesPresentation() {
  return {
    version: 1,
    slot: "workspace",
    renderer: "collection-workspace",
    brand: BRAND,
    title: "訂購轉生產工單",
    count: { path: "total", suffix: " 筆待處理" },
    statusText: "唯讀預覽",
    inline: {
      title: "待轉生產工單",
      limit: 3,
      remainingPrefix: "另有 ",
      remainingSuffix: " 筆",
      openLabel: "開啟工作台",
      item: {
        title: { field: "product_name" },
        subtitle: {
          fields: [
            { field: "customer_name" },
            { field: "delivery_date", fallback: "未設定送貨日" },
          ],
          separator: " · ",
        },
        trailing: { field: "count", prefix: "×" },
      },
    },
    collection: {
      key: "id",
      emptyText: "找不到符合條件的訂購明細",
      item: {
        title: { field: "product_name" },
        subtitle: {
          fields: [
            { field: "order_no" },
            { field: "customer_name" },
          ],
          separator: " · ",
        },
        meta: {
          fields: [
            { field: "delivery_date", fallback: "未設定送貨日" },
            { field: "delivery_time" },
            { field: "product_serial" },
          ],
          separator: " · ",
        },
        trailing: { field: "count", label: "數量" },
      },
    },
    search: {
      placeholder: "搜尋訂單、客戶、產品",
      fields: ["order_no", "customer_name", "product_name", "product_serial"],
    },
    refresh: {
      tool: "get_production_candidates",
      label: "重新整理",
      args: { limit: 30 },
    },
    selection: {
      mode: "multiple",
      selectedSuffix: " 筆已選",
      note: "預覽不會寫入 ERP",
      clearLabel: "清除",
      selectAllLabel: "全選目前結果",
      clearVisibleLabel: "清除目前選取",
      emptyHint: "選擇訂購明細後即可預覽工單與 BOM",
      action: {
        tool: "preview_production_orders",
        label: "預覽工單",
        input: { ids: "$selection" },
      },
    },
    detail: {
      empty: {
        icon: "↳",
        title: "預覽工單結構",
        whenSelected:
          "已選 {count} 筆訂購明細，按下預覽後會在這裡展開工單、半成品與直接用料。",
        whenEmpty:
          "先從左側選擇訂購明細，再預覽實際會產生的工單與 BOM 用料。",
      },
    },
  };
}

export function productionPreviewPresentation() {
  return {
    version: 1,
    slot: "detail",
    renderer: "tree-detail",
    eyebrow: "預覽結果",
    summary: {
      countPath: "total",
      countSuffix: " 張生產工單",
      sourceCountPath: "selectedIds.length",
      sourceCountPrefix: "由 ",
      sourceCountSuffix: " 筆訂購明細展開",
    },
    statusText: "唯讀預覽",
    footerText: "Demo 不建立工單、不扣庫存",
    backLabel: "返回選擇",
    tree: {
      recordsPath: "records",
      key: "no",
      parentKey: "parent_no",
      topLevelIdsPath: "rootProductIds",
      topLevelCompareField: "products_id",
      codeField: "no",
      titleField: "product_name",
      serialField: "product_serial",
      quantityField: "count",
      dateField: "delivery_date",
      statusField: "status_name",
      topLevelLabel: "成品",
      childLabel: "半成品",
      quantityPrefix: "需求 ",
      materials: {
        field: "materials",
        countPrefix: "直接用料 ",
        countSuffix: " 項",
        openLabel: "用料",
        closeLabel: "收合",
        emptyText: "無直接用料",
        keyField: "product_id",
        titleField: "product_name",
        serialField: "product_serial",
        quantityField: "count",
      },
    },
  };
}

export function makeUiView(presentation, data) {
  return { slot: presentation.slot, presentation, data };
}
