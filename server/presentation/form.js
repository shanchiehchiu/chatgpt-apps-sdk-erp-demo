const BRAND = {
  mark: "表",
  name: "ERP UI Runtime",
  section: "Primitive Lab",
};

const deliveryCondition = {
  field: "delivery_method",
  operator: "equals",
  value: "delivery",
};

const urgentCondition = {
  field: "urgent",
  operator: "equals",
  value: true,
};

export function formDemoPresentation() {
  return {
    version: 1,
    slot: "workspace",
    renderer: "form",
    brand: BRAND,
    title: "Form Primitive",
    description: "通用 ERP 表單元件測試，不綁定任何業務頁面",
    inline: {
      openLabel: "開啟表單",
      fields: ["customer_name", "order_date", "quantity", "payment_method"],
    },
    form: {
      valuesPath: "values",
      resultPath: "result",
      columns: 2,
      sections: [
        {
          id: "basic",
          title: "基本資料",
          description: "優先帶入已知資訊，減少重複輸入。",
          fields: [
            "order_no",
            "customer_name",
            "contact_name",
            "contact_phone",
            "order_date",
            "payment_method",
            "currency",
          ],
        },
        {
          id: "order",
          title: "訂購內容",
          fields: ["quantity", "unit_price", "delivery_method", "delivery_address"],
        },
        {
          id: "extra",
          title: "其他設定",
          description: "低頻欄位放在後段，不干擾主要開單流程。",
          fields: ["urgent", "urgent_reason", "note"],
        },
      ],
      fields: [
        {
          name: "order_no",
          label: "單號",
          type: "text",
          readonly: true,
          help: "範例值由系統自動產生。",
        },
        {
          name: "customer_name",
          label: "客戶名稱",
          type: "text",
          required: true,
          placeholder: "輸入客戶名稱",
          maxLength: 80,
        },
        {
          name: "contact_name",
          label: "聯絡人",
          type: "text",
          required: true,
          placeholder: "輸入聯絡人",
          maxLength: 40,
        },
        {
          name: "contact_phone",
          label: "聯絡電話",
          type: "text",
          required: true,
          placeholder: "0912-345-678",
          pattern: "^09\\d{2}-?\\d{3}-?\\d{3}$",
          patternMessage: "請輸入有效的台灣手機號碼",
        },
        {
          name: "order_date",
          label: "訂購日期",
          type: "date",
          required: true,
        },
        {
          name: "payment_method",
          label: "付款方式",
          type: "select",
          required: true,
          options: [
            { value: "cash", label: "現金" },
            { value: "monthly", label: "月結" },
            { value: "transfer", label: "匯款" },
          ],
        },
        {
          name: "currency",
          label: "幣別",
          type: "select",
          disabled: true,
          options: [{ value: "TWD", label: "TWD 台幣" }],
          help: "Demo 用欄位，用來驗證 disabled state。",
        },
        {
          name: "quantity",
          label: "數量",
          type: "number",
          required: true,
          min: 1,
          max: 999,
          step: 1,
        },
        {
          name: "unit_price",
          label: "單價",
          type: "number",
          required: true,
          min: 0,
          step: 1,
          prefix: "NT$",
        },
        {
          name: "delivery_method",
          label: "交付方式",
          type: "select",
          required: true,
          options: [
            { value: "pickup", label: "自取" },
            { value: "delivery", label: "配送" },
          ],
        },
        {
          name: "delivery_address",
          label: "配送地址",
          type: "text",
          span: 2,
          placeholder: "輸入配送地址",
          visibleWhen: deliveryCondition,
          requiredWhen: deliveryCondition,
        },
        {
          name: "urgent",
          label: "急件",
          type: "checkbox",
          checkboxLabel: "標記為急件",
          help: "只有真正需要加速處理時才勾選。",
        },
        {
          name: "urgent_reason",
          label: "急件原因",
          type: "text",
          span: 2,
          placeholder: "簡短說明急件原因",
          visibleWhen: urgentCondition,
          requiredWhen: urgentCondition,
          maxLength: 100,
        },
        {
          name: "note",
          label: "備註",
          type: "textarea",
          span: 2,
          rows: 4,
          maxLength: 200,
          placeholder: "補充需要讓後續人員知道的資訊",
        },
      ],
    },
    submit: {
      tool: "submit_form_demo",
      label: "儲存變更",
      loadingLabel: "儲存中…",
      successLabel: "已儲存",
      input: {
        submission_id: "$submissionId",
        values: "$form",
      },
    },
    resetLabel: "還原變更",
    footerText: "Primitive Demo · 前端驗證 + MCP Tool 後端驗證 + Idempotency",
  };
}
