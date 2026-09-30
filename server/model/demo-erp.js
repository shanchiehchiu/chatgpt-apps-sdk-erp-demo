import {
  listProductionCandidates as listMockCandidates,
  previewProductionOrders as previewMockOrders,
} from "../../mock-erp.js";

export async function listProductionCandidates(input = {}) {
  const result = listMockCandidates(input);

  return {
    domain: "production_candidates",
    source: result.source,
    total: result.count,
    records: result.items,
  };
}

export async function previewProductionOrders(ids) {
  const result = previewMockOrders(ids);

  return {
    domain: "production_order_preview",
    source: result.source,
    selectedIds: result.selected_item_ids,
    rootProductIds: result.top_level_products_id,
    total: result.work_order_count,
    records: result.born_orders,
  };
}

const customerSales = [
  {
    customer_id: 201,
    customer_no: "C-DEMO-001",
    customer_name: "範例客戶 A",
    sales_count: 18,
    return_count: 1,
    gross_sales_amount: 428000,
    return_amount: 12000,
  },
  {
    customer_id: 202,
    customer_no: "C-DEMO-002",
    customer_name: "範例客戶 B",
    sales_count: 14,
    return_count: 0,
    gross_sales_amount: 356000,
    return_amount: 0,
  },
  {
    customer_id: 203,
    customer_no: "C-DEMO-003",
    customer_name: "範例客戶 C",
    sales_count: 11,
    return_count: 1,
    gross_sales_amount: 298000,
    return_amount: 18000,
  },
  {
    customer_id: 204,
    customer_no: "C-DEMO-004",
    customer_name: "範例客戶 D",
    sales_count: 9,
    return_count: 0,
    gross_sales_amount: 224000,
    return_amount: 0,
  },
  {
    customer_id: 205,
    customer_no: "C-DEMO-005",
    customer_name: "範例客戶 E",
    sales_count: 8,
    return_count: 1,
    gross_sales_amount: 181000,
    return_amount: 9000,
  },
  {
    customer_id: 206,
    customer_no: "C-DEMO-006",
    customer_name: "範例客戶 F",
    sales_count: 6,
    return_count: 0,
    gross_sales_amount: 126000,
    return_amount: 0,
  },
];

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

  const records = rows.slice(0, limit).map((row, index) => ({
    ...row,
    rank: index + 1,
    share_percent: netTotal
      ? Number(((row.net_sales_amount / netTotal) * 100).toFixed(2))
      : 0,
  }));

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
