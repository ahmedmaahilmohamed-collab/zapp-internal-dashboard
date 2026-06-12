import { fetchRequests, type DashboardRequest } from "../lib/api";
import { formatCurrency, formatDate, safeDisplay } from "../lib/utils";
import { ResourceListPage, StatusBadge } from "./ResourceListPage";

export function RequestsPage() {
  return (
    <ResourceListPage<DashboardRequest>
      columns={[
        {
          key: "request",
          label: "Request",
          className: "w-[18%]",
          render: (request) => (
            <div>
              <p className="font-medium">
                {safeDisplay(request.requestNumber || request.reference || request.id)}
              </p>
              <p className="mt-1 text-muted-foreground">{safeDisplay(request.id)}</p>
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
          className: "w-[12%]",
          render: (request) => (
            <span className="font-medium">
              {request.quotedTotal === null
                ? safeDisplay(request.quoteMvr || request.quoteUsd || request.paymentStatus)
                : formatCurrency(request.quotedTotal, request.currency)}
            </span>
          ),
        },
        {
          key: "created",
          label: "Date",
          render: (request) => formatDate(request.createdAt),
        },
      ]}
      detailFields={[
        { label: "Request ID", render: (request) => safeDisplay(request.id) },
        { label: "Reference", render: (request) => safeDisplay(request.requestNumber || request.reference) },
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
      ]}
      detailTitle={(request) =>
        safeDisplay(request.requestNumber || request.reference || request.id, "Request")
      }
      fetcher={fetchRequests}
      mobileMeta={(request) => <StatusBadge value={request.paymentStatus || request.status} />}
      mobileSubtitle={(request) =>
        `${safeDisplay(request.customerName, "Customer")} · ${formatCurrency(
          request.quotedTotal,
          request.currency,
        )}`
      }
      mobileTitle={(request) =>
        safeDisplay(request.requestNumber || request.reference || request.id, "Request")
      }
      searchPlaceholder="Search requests, customers, or references"
      statusOptions={["approved", "quoted", "submitted", "reviewing", "awaiting_customer", "fulfilled", "declined", "rejected"]}
      subtitle="Live purchase requests from the existing ZAPP API."
      title="Requests"
    />
  );
}
