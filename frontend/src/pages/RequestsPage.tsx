import { fetchRequests, type DashboardRequest } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { formatCurrency, formatDate, safeDisplay } from "../lib/utils";
import { ResourceListPage, StatusBadge } from "./ResourceListPage";

function requestPrimary(request: DashboardRequest) {
  return request.id || request.requestNumber || request.reference;
}

function requestReference(request: DashboardRequest) {
  return [request.requestNumber, request.reference].filter(Boolean).join(" / ");
}

export function RequestsPage() {
  return (
    <ResourceListPage<DashboardRequest>
      columns={[
        {
          key: "request",
          label: "Request",
          className: "w-[17%]",
          render: (request) => (
            <div>
              <p className="break-all font-mono text-[11px] font-semibold">{safeDisplay(requestPrimary(request))}</p>
              {requestReference(request) ? (
                <p className="mt-1 text-xs text-muted-foreground">{requestReference(request)}</p>
              ) : null}
            </div>
          ),
        },
        {
          key: "customer",
          label: "Requester",
          className: "w-[20%]",
          render: (request) => (
            <div>
              <p>{safeDisplay(request.customerName, "Customer")}</p>
              <p className="mt-1 truncate text-muted-foreground">{safeDisplay(request.customerEmail)}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          className: "w-[14%]",
          render: (request) => <StatusBadge value={request.status} />,
        },
        {
          key: "payment",
          label: "Payment",
          className: "w-[14%]",
          render: (request) => <StatusBadge value={request.paymentStatus || request.quoteStatus} />,
        },
        {
          key: "amount",
          label: "Amount",
          className: "w-[11%]",
          render: (request) => (
            <span className="font-medium">
              {request.quotedTotal === null
                ? safeDisplay(request.quoteMvr || request.quoteUsd || request.paymentStatus)
                : formatCurrency(request.quotedTotal, request.currency)}
            </span>
          ),
        },
        {
          key: "cost",
          label: "Cost",
          className: "w-[11%]",
          render: (request) => <FinanceBadge request={request} />,
        },
        {
          key: "profit",
          label: "Profit",
          className: "w-[12%]",
          render: (request) => <ProfitCell request={request} />,
        },
        {
          key: "created",
          label: "Date",
          render: (request) => formatDate(request.createdAt),
        },
      ]}
      detailFields={[
        { label: "Request ID", render: (request) => safeDisplay(request.id) },
        { label: "Request number", render: (request) => safeDisplay(request.requestNumber) },
        { label: "Reference", render: (request) => safeDisplay(request.reference) },
        { label: "Source type", render: (request) => safeDisplay(request.sourceType) },
        { label: "Public token", render: (request) => safeDisplay(request.publicToken) },
        { label: "Customer", render: (request) => safeDisplay(request.customerName) },
        { label: "Email", render: (request) => safeDisplay(request.customerEmail) },
        { label: "Product", render: (request) => safeDisplay(request.productTitle) },
        { label: "Product URL", render: (request) => safeDisplay(request.productUrl) },
        { label: "Status", render: (request) => <StatusBadge value={request.status} /> },
        { label: "Quote status", render: (request) => <StatusBadge value={request.quoteStatus} /> },
        { label: "Payment", render: (request) => <StatusBadge value={request.paymentStatus} /> },
        { label: "Receipt", render: (request) => <StatusBadge value={request.receiptStatus} /> },
        { label: "Quoted total", render: (request) => formatCurrency(request.quotedTotal, request.currency) },
        { label: "Quote MVR", render: (request) => safeDisplay(request.quoteMvr) },
        { label: "Quote USD", render: (request) => safeDisplay(request.quoteUsd) },
        { label: "Items", render: (request) => safeDisplay(request.itemCount) },
        { label: "Created", render: (request) => formatDate(request.createdAt) },
        { label: "Updated", render: (request) => formatDate(request.updatedAt) },
        { label: "Linked order", render: (request) => safeDisplay(request.linkedOrderId) },
        { label: "Latest message", render: (request) => safeDisplay(request.latestMessageStatus) },
        { label: "Email status", render: (request) => safeDisplay(request.emailStatus) },
        { label: "Finance status", render: (request) => <FinanceBadge request={request} /> },
        { label: "Profit", render: (request) => <ProfitCell request={request} /> },
        { label: "Linked cost records", render: (request) => <LinkedCosts request={request} /> },
      ]}
      detailTitle={(request) => safeDisplay(requestPrimary(request), "Request")}
      fetcher={fetchRequests}
      mobileMeta={(request) => <FinanceBadge request={request} />}
      mobileSubtitle={(request) =>
        `${safeDisplay(requestReference(request), "No request number")} · ${safeDisplay(request.customerName, "Customer")} · ${formatCurrency(
          request.quotedTotal,
          request.currency,
        )}`
      }
      mobileTitle={(request) => safeDisplay(requestPrimary(request), "Request")}
      searchPlaceholder="Search requests, customers, or references"
      statusOptions={["approved", "quoted", "submitted", "reviewing", "awaiting_customer", "fulfilled", "declined", "rejected"]}
      subtitle="Live purchase requests from the existing ZAPP API."
      title="Requests"
    />
  );
}

function FinanceBadge({ request }: { request: DashboardRequest }) {
  const summary = request.financeSummary;
  if (summary?.missingCostRecord) {
    return <Badge variant="warning">Missing cost</Badge>;
  }
  if (summary?.hasCostRecord) {
    return <Badge variant={Number(summary.totalProfitBase) >= 0 ? "success" : "destructive"}>Has cost</Badge>;
  }
  return <Badge variant="muted">No cost</Badge>;
}

function ProfitCell({ request }: { request: DashboardRequest }) {
  const summary = request.financeSummary;
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

function LinkedCosts({ request }: { request: DashboardRequest }) {
  const records = request.financeSummary?.costRecords ?? [];
  if (records.length === 0) {
    return <span className="text-muted-foreground">No linked cost records</span>;
  }
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-md border bg-background/60 p-2">
          <p className="font-medium">{safeDisplay(record.referenceLabel, `Cost #${record.id}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(record.profitBase ?? record.profit, record.profitBase === null ? record.currency : request.financeSummary?.baseCurrency)}
          </p>
        </div>
      ))}
    </div>
  );
}
