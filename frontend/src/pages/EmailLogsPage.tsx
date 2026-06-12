import { fetchEmailLogs, type DashboardEmailLog } from "../lib/api";
import { formatDate, safeDisplay } from "../lib/utils";
import { ResourceListPage, StatusBadge } from "./ResourceListPage";

export function EmailLogsPage() {
  return (
    <ResourceListPage<DashboardEmailLog>
      columns={[
        {
          key: "message",
          label: "Message",
          className: "w-[24%]",
          render: (log) => (
            <div>
              <p className="font-medium">{safeDisplay(log.subject, "Untitled email")}</p>
              <p className="mt-1 text-muted-foreground">
                {safeDisplay(log.messageType || log.eventType, "Message")}
              </p>
            </div>
          ),
        },
        {
          key: "recipient",
          label: "Recipient",
          className: "w-[20%]",
          render: (log) => (
            <div>
              <p>{safeDisplay(log.toEmail, "Recipient")}</p>
              <p className="mt-1 truncate text-muted-foreground">
                From {safeDisplay(log.fromEmail)}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          className: "w-[12%]",
          render: (log) => <StatusBadge value={log.status} />,
        },
        {
          key: "provider",
          label: "Provider",
          className: "w-[12%]",
          render: (log) => safeDisplay(log.provider),
        },
        {
          key: "linked",
          label: "Linked",
          className: "w-[18%]",
          render: (log) => (
            <div>
              <p>{safeDisplay(log.orderReference || log.linkedRequestId)}</p>
              <p className="mt-1 truncate text-muted-foreground">
                {safeDisplay(log.requestCustomerName || log.requestProductTitle)}
              </p>
            </div>
          ),
        },
        {
          key: "created",
          label: "Date",
          render: (log) => formatDate(log.createdAt),
        },
      ]}
      detailFields={[
        { label: "Log ID", render: (log) => safeDisplay(log.id) },
        { label: "Status", render: (log) => <StatusBadge value={log.status} /> },
        { label: "Message type", render: (log) => safeDisplay(log.messageType) },
        { label: "Event type", render: (log) => safeDisplay(log.eventType) },
        { label: "Direction", render: (log) => safeDisplay(log.direction) },
        { label: "Provider", render: (log) => safeDisplay(log.provider) },
        { label: "Subject", render: (log) => safeDisplay(log.subject) },
        { label: "From", render: (log) => safeDisplay(log.fromEmail) },
        { label: "To", render: (log) => safeDisplay(log.toEmail) },
        { label: "Request ID", render: (log) => safeDisplay(log.linkedRequestId) },
        { label: "Request token", render: (log) => safeDisplay(log.requestPublicToken) },
        { label: "Order reference", render: (log) => safeDisplay(log.orderReference) },
        { label: "Request customer", render: (log) => safeDisplay(log.requestCustomerName) },
        { label: "Request email", render: (log) => safeDisplay(log.requestCustomerEmail) },
        { label: "Request product", render: (log) => safeDisplay(log.requestProductTitle) },
        { label: "Request status", render: (log) => <StatusBadge value={log.requestStatus} /> },
        { label: "Resend ID", render: (log) => safeDisplay(log.resendEmailId) },
        { label: "Webhook delivery", render: (log) => safeDisplay(log.webhookDeliveryId) },
        { label: "Error", render: (log) => safeDisplay(log.errorMessage) },
        { label: "Metadata", render: (log) => safeDisplay(log.metadataSummary) },
        { label: "Created", render: (log) => formatDate(log.createdAt) },
        { label: "Updated", render: (log) => formatDate(log.updatedAt) },
      ]}
      detailTitle={(log) => safeDisplay(log.subject || log.messageType || log.id, "Email log")}
      fetcher={fetchEmailLogs}
      mobileMeta={(log) => <StatusBadge value={log.status} />}
      mobileSubtitle={(log) =>
        `${safeDisplay(log.toEmail, "Recipient")} · ${formatDate(log.createdAt)}`
      }
      mobileTitle={(log) => safeDisplay(log.subject || log.messageType || log.id, "Email log")}
      searchPlaceholder="Search subject, recipient, provider, request, or order"
      statusOptions={["sent", "delivered", "failed", "queued", "skipped", "bounced"]}
      subtitle="Live email activity from the existing ZAPP API."
      title="Email Logs"
    />
  );
}
