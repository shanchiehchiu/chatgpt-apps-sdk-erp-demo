const BRAND = {
  mark: "E",
  name: "範例 ERP",
  section: "銷售分析",
};

function normalizeCurrencyCode(code) {
  const normalized = String(code ?? "").trim().toUpperCase();

  if (normalized === "NTD") return "TWD";

  return normalized || undefined;
}

function currencyFormat(data) {
  return {
    format: "currency",
    currency: normalizeCurrencyCode(data.currency?.code),
    locale: "en-US",
    currencyDisplay: "symbol",
    maximumFractionDigits: Number(data.currency?.price_float ?? 2),
    minimumFractionDigits: Number(data.currency?.price_float ?? 0),
  };
}

export function customerSalesRankingPresentation(data = {}) {
  const money = currencyFormat(data);
  const currencyName = data.currency?.name || "範例本位幣";
  const currencyCode = data.currency?.code
    ? ` ${data.currency.code}`
    : "";

  return {
    version: 1,
    slot: "workspace",
    renderer: "ranked-list",
    brand: BRAND,
    title: "客戶銷售排行",
    description: "依淨銷售額排序（銷售－退貨）",
    period: {
      startPath: "period.start_date",
      endPath: "period.end_date",
    },
    inlineLimit: 5,
    openLabel: "查看完整排行",
    emptyText: "此期間沒有可排名的銷售資料",
    summary: [
      {
        label: "淨銷售額",
        path: "summary.net_sales_amount",
        ...money,
      },
      {
        label: "銷售筆數",
        path: "summary.sales_count",
        format: "integer",
        suffix: " 筆",
      },
      {
        label: "退貨筆數",
        path: "summary.return_count",
        format: "integer",
        suffix: " 筆",
      },
    ],
    ranking: {
      recordsPath: "records",
      key: "customer_id",
      rank: { field: "rank" },
      title: { field: "customer_name" },
      subtitle: {
        fields: [
          { field: "customer_no", prefix: "客編 " },
          { field: "sales_count", prefix: "銷售 ", suffix: " 筆" },
          { field: "return_count", prefix: "退貨 ", suffix: " 筆" },
        ],
        separator: " · ",
      },
      value: {
        field: "net_sales_amount",
        ...money,
      },
      valueLabel: "淨銷售額",
      secondaryValue: {
        field: "share_percent",
        format: "percent",
        maximumFractionDigits: 2,
      },
      secondaryLabel: "占比",
      progressField: "share_percent",
    },
    footerText: `Mock Data 本位幣（${currencyName}${currencyCode}）`,
  };
}
