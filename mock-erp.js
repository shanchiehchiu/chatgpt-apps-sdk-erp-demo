const candidates = [
  {
    id: 101,
    order_id: 1001,
    order_no: "SO-DEMO-001",
    order_date: "2026-09-20",
    customer_name: "範例客戶 A",
    delivery_date: "2026-10-02",
    delivery_time: "09:00",
    product_id: 501,
    product_serial: "FG-001",
    product_name: "經典禮盒 A",
    count: 12,
    product_model: "盒",
    converted: false,
    born_order_id: null,
    born_order_no: null
  },
  {
    id: 102,
    order_id: 1002,
    order_no: "SO-DEMO-002",
    order_date: "2026-09-21",
    customer_name: "範例客戶 B",
    delivery_date: "2026-10-03",
    delivery_time: "14:00",
    product_id: 502,
    product_serial: "FG-002",
    product_name: "冷凍米食 B",
    count: 30,
    product_model: "包",
    converted: false,
    born_order_id: null,
    born_order_no: null
  },
  {
    id: 103,
    order_id: 1003,
    order_no: "SO-DEMO-003",
    order_date: "2026-09-22",
    customer_name: "範例客戶 C",
    delivery_date: "2026-10-05",
    delivery_time: "11:30",
    product_id: 503,
    product_serial: "FG-003",
    product_name: "節慶組合 C",
    count: 8,
    product_model: "組",
    converted: false,
    born_order_id: null,
    born_order_no: null
  },
  {
    id: 104,
    order_id: 1004,
    order_no: "SO-DEMO-004",
    order_date: "2026-09-23",
    customer_name: "範例客戶 D",
    delivery_date: "2026-10-06",
    delivery_time: "15:00",
    product_id: 504,
    product_serial: "FG-004",
    product_name: "家庭分享盒 D",
    count: 20,
    product_model: "盒",
    converted: false,
    born_order_id: null,
    born_order_no: null
  },
  {
    id: 105,
    order_id: 1005,
    order_no: "SO-DEMO-005",
    order_date: "2026-09-24",
    customer_name: "範例客戶 E",
    delivery_date: "2026-10-08",
    delivery_time: "10:00",
    product_id: 505,
    product_serial: "FG-005",
    product_name: "企業贈禮 E",
    count: 50,
    product_model: "盒",
    converted: false,
    born_order_id: null,
    born_order_no: null
  }
];

function createBom(item, index) {
  const rootNo = `WO-DEMO-${String(index + 1).padStart(3, "0")}`;
  const semiNo = `${rootNo}-S1`;

  return [
    {
      no: rootNo,
      parent_no: null,
      products_id: item.product_id,
      product_serial: item.product_serial,
      product_name: item.product_name,
      count: item.count,
      delivery_date: item.delivery_date,
      status_id: 1,
      status_name: "預覽",
      materials: [
        {
          product_id: 8001,
          product_serial: "RM-001",
          product_name: "主要原料",
          count: item.count * 1.2
        },
        {
          product_id: 8002,
          product_serial: "PK-001",
          product_name: "外包裝",
          count: item.count
        }
      ]
    },
    {
      no: semiNo,
      parent_no: rootNo,
      products_id: 7001,
      product_serial: "SF-001",
      product_name: "共用半成品",
      count: item.count,
      delivery_date: item.delivery_date,
      status_id: 1,
      status_name: "預覽",
      materials: [
        {
          product_id: 8101,
          product_serial: "RM-010",
          product_name: "半成品原料 A",
          count: item.count * 0.5
        },
        {
          product_id: 8102,
          product_serial: "RM-011",
          product_name: "半成品原料 B",
          count: item.count * 0.25
        }
      ]
    }
  ];
}

export function listProductionCandidates({ delivery_date_start, delivery_date_end, limit = 30 } = {}) {
  let rows = [...candidates];

  if (delivery_date_start) {
    rows = rows.filter((row) => !row.delivery_date || row.delivery_date >= delivery_date_start);
  }
  if (delivery_date_end) {
    rows = rows.filter((row) => !row.delivery_date || row.delivery_date <= delivery_date_end);
  }

  rows = rows.slice(0, Math.max(1, Math.min(limit, 100)));

  return {
    source: "mock-erp",
    count: rows.length,
    items: rows
  };
}

export function previewProductionOrders(ids = []) {
  const selected = candidates.filter((row) => ids.includes(row.id));

  if (!selected.length) {
    throw new Error("找不到可預覽的範例訂購明細");
  }

  const born_orders = selected.flatMap((item, index) => createBom(item, index));

  return {
    source: "mock-erp",
    selected_item_ids: selected.map((item) => item.id),
    top_level_products_id: selected.map((item) => item.product_id),
    work_order_count: born_orders.length,
    born_orders
  };
}
