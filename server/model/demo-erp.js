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
