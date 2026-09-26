const BRAND = {
  mark: "格",
  name: "ERP UI Runtime",
  section: "Primitive Lab",
};

export function dataGridDemoPresentation(data = {}) {
  const currency = data.currency?.code || "TWD";
  const digits = Number(data.currency?.price_float ?? 0);

  return {
    version: 1,
    slot: "workspace",
    renderer: "data-grid",
    brand: BRAND,
    title: "Data Grid Primitive",
    description: "通用 ERP 資料表格元件測試，不綁定任何業務頁面",
    count: {
      path: "total",
      suffix: " 筆",
    },
    inline: {
      limit: 4,
      columns: ["order_no", "customer_name", "status", "amount"],
      openLabel: "開啟 Grid",
    },
    search: {
      placeholder: "搜尋單號、客戶、業務",
      fields: ["order_no", "customer_name", "salesperson"],
    },
    filters: [
      {
        id: "status",
        field: "status",
        label: "狀態",
        type: "select",
        allLabel: "全部狀態",
        options: [
          { value: "pending", label: "待處理" },
          { value: "processing", label: "處理中" },
          { value: "done", label: "已完成" },
          { value: "hold", label: "暫停" },
        ],
      },
      {
        id: "salesperson",
        field: "salesperson",
        label: "業務",
        type: "select",
        allLabel: "全部業務",
        options: [
          { value: "王小明", label: "王小明" },
          { value: "李小華", label: "李小華" },
          { value: "陳怡君", label: "陳怡君" },
        ],
      },
      {
        id: "delivery_date",
        field: "delivery_date",
        label: "需求日期",
        type: "date-range",
      },
      {
        id: "amount",
        field: "amount",
        label: "金額",
        type: "number-range",
      },
    ],
    grid: {
      recordsPath: "records",
      key: "id",
      emptyText: "沒有符合目前條件的資料",
      columns: [
        {
          field: "order_no",
          label: "單號",
          sortable: true,
          minWidth: 132,
        },
        {
          field: "customer_name",
          label: "客戶",
          sortable: true,
          minWidth: 150,
        },
        {
          field: "status",
          label: "狀態",
          type: "badge",
          sortable: true,
          minWidth: 96,
          valueMap: {
            pending: { label: "待處理", color: "warning" },
            processing: { label: "處理中", color: "secondary" },
            done: { label: "已完成", color: "success" },
            hold: { label: "暫停", color: "danger" },
          },
        },
        {
          field: "salesperson",
          label: "業務",
          sortable: true,
          minWidth: 96,
        },
        {
          field: "item_count",
          label: "品項",
          format: "integer",
          align: "right",
          sortable: true,
          minWidth: 72,
        },
        {
          field: "amount",
          label: "金額",
          format: "currency",
          currency,
          locale: "en-US",
          currencyDisplay: "symbol",
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
          align: "right",
          sortable: true,
          minWidth: 120,
        },
        {
          field: "delivery_date",
          label: "需求日期",
          format: "date",
          sortable: true,
          minWidth: 112,
        },
        {
          field: "priority",
          label: "優先度",
          type: "badge",
          sortable: true,
          minWidth: 90,
          valueMap: {
            high: { label: "高", color: "danger" },
            medium: { label: "中", color: "warning" },
            normal: { label: "一般", color: "secondary" },
          },
        },
      ],
    },
    pagination: {
      mode: "client",
      pageSize: 10,
      pageSizeOptions: [10, 20, 50],
    },
    selection: {
      mode: "multiple",
      selectedSuffix: " 筆已選",
      clearLabel: "清除選取",
      actions: [
        {
          tool: "get_data_grid_demo",
          label: "只看已選",
          input: {
            ids: "$selection",
          },
        },
      ],
    },
    refresh: {
      tool: "get_data_grid_demo",
      label: "重設資料",
      args: {},
    },
    footerText: "Primitive Demo · 搜尋、篩選、排序、分頁皆在 Widget 端執行",
  };
}
