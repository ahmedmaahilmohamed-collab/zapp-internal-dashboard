import { fetchOrders, type DashboardOrder } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { formatCurrency, formatDate, safeDisplay } from "../lib/utils";
import { ResourceListPage, StatusBadge } from "./ResourceListPage";

function orderPrimary(order: DashboardOrder) {
  return order.id || order.orderName || order.orderNumber;
}

function orderReference(order: DashboardOrder) {
  return [order.orderName, order.orderNumber].filter(Boolean).join(" / ");
}

export function OrdersPage() {
  return (
    <ResourceListPage<DashboardOrder>
      columns={[
        {
          key: "order",
          label: "Order",
          className: "w-[17%]",
          render: (order) => (
            <div>
              <p className="break-all font-mono text-[11px] font-semibold">{safeDisplay(orderPrimary(order))}</p>
              {orderReference(order) ? (
                <p className="mt-1 text-xs text-muted-foreground">{orderReference(order)}</p>
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
          className: "w-[11%]",
          render: (order) => (
            <span className="font-medium">{formatCurrency(order.total, order.currency)}</span>
          ),
        },
        {
          key: "cost",
          label: "Cost",
          className: "w-[11%]",
          render: (order) => <FinanceBadge order={order} />,
        },
        {
          key: "profit",
          label: "Profit",
          className: "w-[12%]",
          render: (order) => <ProfitCell order={order} />,
        },
        {
          key: "created",
          label: "Date",
          render: (order) => formatDate(order.createdAt),
        },
      ]}
      detailFields={[
        { label: "Order ID", render: (order) => safeDisplay(order.id) },
        { label: "Order name", render: (order) => safeDisplay(order.orderName) },
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
        { label: "Finance status", render: (order) => <FinanceBadge order={order} /> },
        { label: "Profit", render: (order) => <ProfitCell order={order} /> },
        { label: "Linked cost records", render: (order) => <LinkedCosts order={order} /> },
      ]}
      detailTitle={(order) => safeDisplay(orderPrimary(order), "Order")}
      fetcher={fetchOrders}
      mobileMeta={(order) => <FinanceBadge order={order} />}
      mobileSubtitle={(order) =>
        `${safeDisplay(orderReference(order), "No order number")} · ${safeDisplay(order.customerName, "Customer")} · ${formatCurrency(order.total, order.currency)}`
      }
      mobileTitle={(order) => safeDisplay(orderPrimary(order), "Order")}
      searchPlaceholder="Search orders, customers, or IDs"
      statusOptions={["approved", "paid", "fulfilled", "pending", "cancelled", "rejected"]}
      subtitle="Live Shopify orders from the existing ZAPP API."
      title="Orders"
    />
  );
}

function FinanceBadge({ order }: { order: DashboardOrder }) {
  const summary = order.financeSummary;
  if (summary?.missingCostRecord) {
    return <Badge variant="warning">Missing cost</Badge>;
  }
  if (summary?.hasCostRecord) {
    return <Badge variant={Number(summary.totalProfitBase) >= 0 ? "success" : "destructive"}>Has cost</Badge>;
  }
  return <Badge variant="muted">No cost</Badge>;
}

function ProfitCell({ order }: { order: DashboardOrder }) {
  const summary = order.financeSummary;
  if (!summary?.hasCostRecord) {
    return <span className="text-muted-foreground">--</span>;
  }
  const profit = Number(summary.totalProfitBase || 0);
  return (
    <div>
      <p className={profit >= 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-red-600 dark:text-red-400"}>
        {formatCurrency(profit, summary.baseCurrency)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {summary.marginPercent === null ? "--" : `${Number(summary.marginPercent).toFixed(2)}%`}
      </p>
    </div>
  );
}

function LinkedCosts({ order }: { order: DashboardOrder }) {
  const records = order.financeSummary?.costRecords ?? [];
  if (records.length === 0) {
    return <span className="text-muted-foreground">No linked cost records</span>;
  }
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-md border bg-background/60 p-2">
          <p className="font-medium">{safeDisplay(record.referenceLabel, `Cost #${record.id}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(record.profitBase ?? record.profit, record.profitBase === null ? record.currency : order.financeSummary?.baseCurrency)}
          </p>
        </div>
      ))}
    </div>
  );
}
