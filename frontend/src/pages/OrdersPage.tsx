import { fetchOrders, type DashboardOrder } from "../lib/api";
import { formatCurrency, formatDate, safeDisplay } from "../lib/utils";
import { ResourceListPage, StatusBadge } from "./ResourceListPage";

function orderSecondary(order: DashboardOrder) {
  const secondary = order.orderName || order.orderNumber;
  return secondary && secondary !== order.id ? secondary : "";
}

export function OrdersPage() {
  return (
    <ResourceListPage<DashboardOrder>
      columns={[
        {
          key: "order",
          label: "ID",
          className: "w-[18%]",
          render: (order) => (
            <div>
              <p className="break-all font-mono text-[11px] font-medium">{safeDisplay(order.id)}</p>
              {orderSecondary(order) ? (
                <p className="mt-1 truncate text-muted-foreground">{orderSecondary(order)}</p>
              ) : null}
            </div>
          ),
        },
        {
          key: "customer",
          label: "Customer",
          className: "w-[20%]",
          render: (order) => (
            <div>
              <p>{safeDisplay(order.customerName, "Customer")}</p>
              <p className="mt-1 truncate text-muted-foreground">{safeDisplay(order.customerEmail)}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          className: "w-[14%]",
          render: (order) => <StatusBadge value={order.status || order.fulfillmentStatus} />,
        },
        {
          key: "payment",
          label: "Payment",
          className: "w-[14%]",
          render: (order) => <StatusBadge value={order.financialStatus} />,
        },
        {
          key: "total",
          label: "Total",
          className: "w-[12%]",
          render: (order) => (
            <span className="font-medium">{formatCurrency(order.total, order.currency)}</span>
          ),
        },
        {
          key: "created",
          label: "Date",
          render: (order) => formatDate(order.createdAt),
        },
      ]}
      detailFields={[
        { label: "Order ID", render: (order) => safeDisplay(order.id) },
        { label: "Order name", render: (order) => safeDisplay(orderSecondary(order)) },
        { label: "Order number", render: (order) => safeDisplay(order.orderNumber) },
        { label: "Source type", render: (order) => safeDisplay(order.sourceType) },
        { label: "Customer", render: (order) => safeDisplay(order.customerName) },
        { label: "Email", render: (order) => safeDisplay(order.customerEmail) },
        { label: "Status", render: (order) => <StatusBadge value={order.status} /> },
        { label: "Financial status", render: (order) => <StatusBadge value={order.financialStatus} /> },
        { label: "Fulfillment", render: (order) => <StatusBadge value={order.fulfillmentStatus} /> },
        { label: "Total", render: (order) => formatCurrency(order.total, order.currency) },
        { label: "Items", render: (order) => safeDisplay(order.itemCount) },
        { label: "Receipt", render: (order) => <StatusBadge value={order.receiptStatus} /> },
        { label: "Delivery", render: (order) => <StatusBadge value={order.deliveryStatus} /> },
        { label: "Tracking", render: (order) => safeDisplay(order.trackingNumber) },
        { label: "Created", render: (order) => formatDate(order.createdAt) },
        { label: "Updated", render: (order) => formatDate(order.updatedAt) },
        { label: "Linked request", render: (order) => safeDisplay(order.linkedRequestId) },
        { label: "Source ID", render: (order) => safeDisplay(order.source?.sourceId) },
      ]}
      detailTitle={(order) => safeDisplay(order.id, "Order")}
      fetcher={fetchOrders}
      mobileMeta={(order) => <StatusBadge value={order.financialStatus || order.status} />}
      mobileSubtitle={(order) =>
        `${safeDisplay(order.customerName, "Customer")} · ${formatCurrency(order.total, order.currency)}`
      }
      mobileTitle={(order) => safeDisplay(order.id, "Order")}
      searchPlaceholder="Search orders, customers, or IDs"
      statusOptions={["approved", "paid", "fulfilled", "pending", "cancelled", "rejected"]}
      subtitle="Live Shopify orders from the existing ZAPP API."
      title="Orders"
    />
  );
}
