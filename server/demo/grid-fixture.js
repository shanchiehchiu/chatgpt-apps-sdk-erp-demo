const CUSTOMERS = [
  "範例客戶 A",
  "範例客戶 B",
  "範例客戶 C",
  "範例客戶 D",
  "範例客戶 E",
  "範例客戶 F",
];

const STATUSES = [
  { value: "pending", label: "待處理" },
  { value: "processing", label: "處理中" },
  { value: "done", label: "已完成" },
  { value: "hold", label: "暫停" },
];

const SALESPEOPLE = ["王小明", "李小華", "陳怡君"];

const BASE_ROWS = Array.from({ length: 27 }, (_, index) => {
  const id = index + 1;
  const status = STATUSES[index % STATUSES.length].value;
  const day = String((index % 24) + 1).padStart(2, "0");

  return {
    id,
    order_no: `SO-DEMO-${String(id).padStart(3, "0")}`,
    customer_name: CUSTOMERS[index % CUSTOMERS.length],
    status,
    salesperson: SALESPEOPLE[index % SALESPEOPLE.length],
    amount: 1800 + index * 1375,
    item_count: 1 + (index % 8),
    delivery_date: `2026-10-${day}`,
    priority: index % 7 === 0 ? "high" : index % 3 === 0 ? "medium" : "normal",
  };
});

export function getDataGridDemoData(input = {}) {
  const requestedIds = Array.isArray(input.ids)
    ? new Set(input.ids.map((value) => Number(value)))
    : null;

  const records = requestedIds
    ? BASE_ROWS.filter((row) => requestedIds.has(row.id))
    : BASE_ROWS;

  return {
    domain: "data_grid_demo",
    source: "fixture",
    total: records.length,
    records,
    currency: {
      code: "TWD",
      name: "台幣",
      price_float: 0,
    },
  };
}
