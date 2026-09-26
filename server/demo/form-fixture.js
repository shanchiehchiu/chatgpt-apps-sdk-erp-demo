const defaultValues = {
  order_no: "SO-DEMO-20260926-001",
  customer_name: "範例客戶 A",
  contact_name: "王小明",
  contact_phone: "0912-345-678",
  order_date: "2026-09-26",
  payment_method: "monthly",
  currency: "TWD",
  quantity: 12,
  unit_price: 1280,
  delivery_method: "pickup",
  delivery_address: "",
  urgent: false,
  urgent_reason: "",
  note: "",
};

export function getFormDemoData(input = {}) {
  const values = {
    ...defaultValues,
    ...(input.values ?? {}),
  };

  return {
    domain: "form_demo",
    source: "fixture",
    total: Object.keys(values).length,
    values,
    result: input.result ?? null,
  };
}

export function validateFormDemo(values = {}) {
  const errors = {};

  if (!String(values.customer_name ?? "").trim()) {
    errors.customer_name = "請填寫客戶名稱";
  }

  if (!String(values.contact_name ?? "").trim()) {
    errors.contact_name = "請填寫聯絡人";
  }

  if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(String(values.contact_phone ?? ""))) {
    errors.contact_phone = "請輸入有效的台灣手機號碼";
  }

  if (!String(values.order_date ?? "").trim()) {
    errors.order_date = "請選擇訂購日期";
  }

  const quantity = Number(values.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
    errors.quantity = "數量需介於 1～999";
  }

  const unitPrice = Number(values.unit_price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    errors.unit_price = "單價不可小於 0";
  }

  if (
    values.delivery_method === "delivery" &&
    !String(values.delivery_address ?? "").trim()
  ) {
    errors.delivery_address = "選擇配送時必須填寫地址";
  }

  if (values.urgent && !String(values.urgent_reason ?? "").trim()) {
    errors.urgent_reason = "勾選急件時請填寫原因";
  }

  if (String(values.note ?? "").length > 200) {
    errors.note = "備註不可超過 200 字";
  }

  return errors;
}

export function submitFormDemo(values = {}) {
  const errors = validateFormDemo(values);

  if (Object.keys(errors).length > 0) {
    return getFormDemoData({
      values,
      result: {
        status: "error",
        message: "後端驗證未通過，請修正欄位後再送出。",
        errors,
      },
    });
  }

  return getFormDemoData({
    values,
    result: {
      status: "success",
      message: "Demo 表單已通過後端驗證；沒有寫入任何 ERP 資料。",
      errors: {},
      submitted_at: new Date().toISOString(),
    },
  });
}
