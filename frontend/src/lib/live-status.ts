import type { DashboardOrder, DashboardRequest } from "./api";

export function normalizedStatusText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function isCancelledOrder(order: DashboardOrder) {
  const statusText = normalizedStatusText(
    [
      order.status,
      order.financialStatus,
      order.fulfillmentStatus,
      order.deliveryStatus,
      order.receiptStatus,
    ].join(" "),
  );
  return ["cancel", "refund", "void", "not required"].some((term) => statusText.includes(term));
}

export function orderDisplayFulfillmentStatus(order: DashboardOrder) {
  if (isCancelledOrder(order)) {
    return "cancelled";
  }
  if (order.fulfillmentStatus) {
    return order.fulfillmentStatus;
  }
  if (normalizedStatusText(order.sourceType) === "shopify order") {
    return "cancelled";
  }
  return "";
}

export function isCancelledRequest(request: DashboardRequest) {
  const statusText = normalizedStatusText(
    [
      request.status,
      request.quoteStatus,
      request.paymentStatus,
      request.receiptStatus,
      request.emailStatus,
    ].join(" "),
  );
  return ["cancel", "refund", "void", "reject", "declin"].some((term) => statusText.includes(term));
}

export function liveRecordKeys(record: {
  id?: string | null;
  orderName?: string | null;
  orderNumber?: string | null;
  requestNumber?: string | null;
  reference?: string | null;
  publicToken?: string | null;
  linkedOrderId?: string | null;
  linkedRequestId?: string | null;
  source?: { sourceId?: string | null } | null;
}) {
  return [
    record.id,
    record.orderName,
    record.orderNumber,
    record.orderNumber ? `#${record.orderNumber}` : null,
    record.requestNumber,
    record.reference,
    record.publicToken,
    record.linkedOrderId,
    record.linkedRequestId,
    record.source?.sourceId,
  ]
    .map((value) => normalizedMatchValue(value))
    .filter(Boolean);
}

export function normalizedMatchValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}
