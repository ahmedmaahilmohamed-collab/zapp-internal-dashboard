import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Database,
  Download,
  Eye,
  MoreHorizontal,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DashboardCollectionResponse, DashboardEmailLog, fetchEmailLogs } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, downloadCsv, safeDisplay } from "../lib/utils";

const PAGE_SIZE = 100;
const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";

function normalizedText(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function dateParts(value: string | null | undefined) {
  if (!value) {
    return { date: "--", time: "--" };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value, time: "" };
  }
  return {
    date: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function statusLabel(value: string) {
  const normalized = normalizedText(value);
  if (!normalized) return "Unknown";
  if (normalized.includes("deliver")) return "Delivered";
  if (normalized.includes("sent")) return "Sent";
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("bounce")) return "Failed";
  if (normalized.includes("pending") || normalized.includes("queued") || normalized.includes("process")) return "Pending";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(value: string) {
  const normalized = normalizedText(value);
  if (normalized.includes("deliver")) {
    return "border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300";
  }
  if (normalized.includes("sent")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (normalized.includes("pending") || normalized.includes("queued") || normalized.includes("process")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300";
  }
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("bounce")) {
    return "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  return "border-border bg-muted text-muted-foreground";
}

function isInternalId(value: string | null | undefined) {
  const text = String(value || "").trim().toLowerCase();
  return (
    !text ||
    /^c[a-z0-9]{12,}$/.test(text) ||
    /^request-[a-z0-9-]+$/.test(text) ||
    /^[a-f0-9-]{24,}$/.test(text)
  );
}

function linkedDisplay(log: DashboardEmailLog) {
  if (log.orderReference && !isInternalId(log.orderReference)) {
    return {
      primary: log.orderReference.startsWith("Order") ? log.orderReference : `Order ${log.orderReference}`,
      secondary: log.requestCustomerName || log.requestProductTitle || "Order",
    };
  }

  if (log.requestCustomerName) {
    return {
      primary: log.requestCustomerName,
      secondary: "Request",
    };
  }

  if (log.requestProductTitle) {
    return {
      primary: log.requestProductTitle,
      secondary: "Request",
    };
  }

  if (log.linkedRequestId || log.requestPublicToken) {
    return {
      primary: "Request",
      secondary: log.requestStatus ? statusLabel(log.requestStatus) : "Linked item",
    };
  }

  if (log.linkedOrderId) {
    return {
      primary: "Order",
      secondary: "Linked item",
    };
  }

  return {
    primary: "--",
    secondary: "",
  };
}

export function EmailLogsPage() {
  const { notify } = useToast();
  const [data, setData] = useState<DashboardCollectionResponse<DashboardEmailLog> | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DashboardEmailLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await fetchEmailLogs({
          search,
          status,
          dateFrom,
          dateTo,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load email logs.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, notify, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleLogs = useMemo(() => {
    const searchText = normalizedText(search);
    return (data?.items ?? []).filter((log) => {
      if (searchText) {
        const linked = linkedDisplay(log);
        const haystack = normalizedText(
          [
            log.subject,
            log.toEmail,
            log.fromEmail,
            log.provider,
            log.messageType,
            log.eventType,
            log.requestCustomerName,
            log.requestCustomerEmail,
            log.requestProductTitle,
            log.orderReference,
            linked.primary,
            linked.secondary,
          ].join(" "),
        );
        if (!haystack.includes(searchText)) {
          return false;
        }
      }
      return true;
    });
  }, [data?.items, search]);

  const summary = useMemo(() => {
    return visibleLogs.reduce(
      (acc, log) => {
        const label = statusLabel(log.status);
        acc.total += 1;
        if (label === "Sent") acc.sent += 1;
        else if (label === "Delivered") acc.delivered += 1;
        else if (label === "Pending") acc.pending += 1;
        else if (label === "Failed") acc.failed += 1;
        return acc;
      },
      { total: 0, sent: 0, delivered: 0, pending: 0, failed: 0 },
    );
  }, [visibleLogs]);

  const liveConnected =
    typeof data?.source?.upstreamStatus === "number" &&
    data.source.upstreamStatus >= 200 &&
    data.source.upstreamStatus < 300;

  function applySearch() {
    setSearch(searchInput);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  }

  function exportLogs() {
    const exported = downloadCsv(
      "email-logs.csv",
      visibleLogs.map((log) => {
        const linked = linkedDisplay(log);
        return {
          subject: log.subject,
          to: log.toEmail,
          from: log.fromEmail,
          status: statusLabel(log.status),
          provider: log.provider,
          linked_to: linked.primary,
          linked_type: linked.secondary,
          created_at: log.createdAt,
        };
      }),
    );
    notify(exported ? "Email logs CSV exported." : "No email logs to export.", exported ? "success" : "info");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Email Logs</h2>
            <Badge variant={liveConnected ? "success" : error ? "destructive" : "muted"}>
              {liveConnected ? "Live API connected" : "Awaiting live data"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live email activity from the existing ZAPP API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!visibleLogs.length} variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button disabled={loading} onClick={load}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Emails" value={summary.total} />
        <SummaryCard label="Sent" value={summary.sent} tone="success" />
        <SummaryCard label="Delivered" value={summary.delivered} tone="delivered" />
        <SummaryCard label="Pending" value={summary.pending} tone="warning" />
        <SummaryCard label="Failed" value={summary.failed} tone="danger" />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(360px,1.5fr)_180px_160px_160px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(inputClass, "pl-9")}
                placeholder="Search by subject, recipient, provider, or request..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            </label>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="bounced">Bounced</option>
            </select>
            <DateInput label="Start date" value={dateFrom} onChange={setDateFrom} />
            <DateInput label="End date" value={dateTo} onChange={setDateTo} />
            <div className="flex gap-2">
              <Button className="flex-1 xl:flex-none" onClick={applySearch}>Search</Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{visibleLogs.length} shown from {data?.total ?? 0} email log(s)</span>
            <span>Source: {data?.source?.path ?? "ZAPP API"} · HTTP {data?.source?.upstreamStatus ?? "--"} · {safeDisplay(data?.source?.elapsedMs)} ms</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-orange-700 dark:text-orange-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <div>
            <CardTitle>Email Activity</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced {dateParts(data?.fetchedAt).date} {dateParts(data?.fetchedAt).time}
            </p>
          </div>
          <Badge variant={loading ? "warning" : "muted"}>{loading ? "Loading" : `${visibleLogs.length} rows`}</Badge>
        </CardHeader>

        {loading && !data ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}
          </CardContent>
        ) : visibleLogs.length === 0 && !error ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No email logs found</p>
            <p className="text-sm text-muted-foreground">Adjust filters or refresh after ZAPP sends matching email events.</p>
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                  <tr>
                    <HeaderCell className="w-[290px]">Message</HeaderCell>
                    <HeaderCell className="w-[245px]">Recipient</HeaderCell>
                    <HeaderCell className="w-[130px]">Status</HeaderCell>
                    <HeaderCell className="w-[130px]">Provider</HeaderCell>
                    <HeaderCell className="w-[210px]">Linked To</HeaderCell>
                    <HeaderCell className="w-[135px]">Date</HeaderCell>
                    <HeaderCell className="w-[110px] text-center">Action</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleLogs.map((log) => (
                    <tr key={log.id || `${log.subject}-${log.createdAt}`} className="h-[76px] transition hover:bg-muted/30">
                      <td className="px-4 py-4 align-middle">
                        <MessageCell log={log} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <RecipientCell log={log} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <EmailStatusBadge value={log.status} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="block truncate whitespace-nowrap text-xs" title={log.provider}>{safeDisplay(log.provider)}</span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <LinkedCell log={log} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <DateCell value={log.createdAt} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setSelected(log)}>
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button size="icon" title="More details" variant="ghost" onClick={() => setSelected(log)}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {visibleLogs.map((log) => (
                <EmailLogCard key={log.id || `${log.subject}-${log.createdAt}`} log={log} onView={setSelected} />
              ))}
            </div>
          </>
        )}
      </Card>

      {selected ? <EmailLogDetails log={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "delivered" | "warning" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-bold",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "delivered" && "text-teal-600 dark:text-teal-300",
            tone === "warning" && "text-amber-600 dark:text-amber-300",
            tone === "danger" && "text-red-600 dark:text-red-400",
          )}
        >
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={label}
        className={cn(inputClass, "pl-9")}
        placeholder={label}
        title={label}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function HeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </th>
  );
}

function MessageCell({ log }: { log: DashboardEmailLog }) {
  const subtitle = log.messageType || log.eventType || log.direction || "Email";
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap text-sm font-medium" title={log.subject}>
        {safeDisplay(log.subject, "Untitled email")}
      </p>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-muted-foreground" title={subtitle}>
        {safeDisplay(subtitle)}
      </p>
    </div>
  );
}

function RecipientCell({ log }: { log: DashboardEmailLog }) {
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap text-sm font-medium" title={log.toEmail}>
        {safeDisplay(log.toEmail, "Recipient")}
      </p>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-muted-foreground" title={log.fromEmail}>
        From {safeDisplay(log.fromEmail)}
      </p>
    </div>
  );
}

function EmailStatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex h-7 min-w-[104px] items-center justify-center rounded-md border px-3 text-[10px] font-medium uppercase tracking-wider", statusClasses(value))}>
      {statusLabel(value)}
    </span>
  );
}

function LinkedCell({ log }: { log: DashboardEmailLog }) {
  const linked = linkedDisplay(log);
  if (linked.primary === "--") {
    return <span className="text-sm text-muted-foreground">--</span>;
  }
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap text-sm font-medium" title={linked.primary}>
        {linked.primary}
      </p>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-muted-foreground" title={linked.secondary}>
        {linked.secondary}
      </p>
    </div>
  );
}

function DateCell({ value }: { value: string }) {
  const parts = dateParts(value);
  return (
    <div className="whitespace-nowrap text-xs leading-5">
      <p>{parts.date}</p>
      <p className="text-muted-foreground">{parts.time}</p>
    </div>
  );
}

function EmailLogCard({ log, onView }: { log: DashboardEmailLog; onView: (log: DashboardEmailLog) => void }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <MessageCell log={log} />
        <EmailStatusBadge value={log.status} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Recipient"><RecipientCell log={log} /></InfoBlock>
        <InfoBlock label="Linked To"><LinkedCell log={log} /></InfoBlock>
        <InfoBlock label="Provider"><span className="text-sm">{safeDisplay(log.provider)}</span></InfoBlock>
        <InfoBlock label="Date"><DateCell value={log.createdAt} /></InfoBlock>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onView(log)}>
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmailLogDetails({ log, onClose }: { log: DashboardEmailLog; onClose: () => void }) {
  const fields: Array<[string, ReactNode]> = [
    ["Log ID", safeDisplay(log.id)],
    ["Status", <EmailStatusBadge key="status" value={log.status} />],
    ["Message type", safeDisplay(log.messageType)],
    ["Event type", safeDisplay(log.eventType)],
    ["Direction", safeDisplay(log.direction)],
    ["Provider", safeDisplay(log.provider)],
    ["Provider email ID", safeDisplay(log.resendEmailId)],
    ["Webhook delivery ID", safeDisplay(log.webhookDeliveryId)],
    ["Subject", safeDisplay(log.subject)],
    ["From", safeDisplay(log.fromEmail)],
    ["To", safeDisplay(log.toEmail)],
    ["Linked request ID", safeDisplay(log.linkedRequestId)],
    ["Linked order ID", safeDisplay(log.linkedOrderId)],
    ["Request token", safeDisplay(log.requestPublicToken)],
    ["Order reference", safeDisplay(log.orderReference)],
    ["Request customer", safeDisplay(log.requestCustomerName)],
    ["Request email", safeDisplay(log.requestCustomerEmail)],
    ["Request product", safeDisplay(log.requestProductTitle)],
    ["Request status", safeDisplay(log.requestStatus)],
    ["Error", safeDisplay(log.errorMessage)],
    ["Metadata", safeDisplay(log.metadataSummary)],
    ["Created", `${dateParts(log.createdAt).date} ${dateParts(log.createdAt).time}`],
    ["Updated", `${dateParts(log.updatedAt).date} ${dateParts(log.updatedAt).time}`],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold" title={log.subject}>
              {safeDisplay(log.subject, "Email log")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {safeDisplay(log.toEmail, "Recipient")} · {dateParts(log.createdAt).date}
            </p>
          </div>
          <Button aria-label="Close details" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="mt-2 break-words text-sm">{value}</div>
            </div>
          ))}
          <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Body / Preview</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {safeDisplay(log.bodyPreview, "No body preview available.")}
            </p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Upstream fields</p>
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {log.source?.availableFields?.join(", ") || "None reported"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
