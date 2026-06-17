import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Database,
  Download,
  Eye,
  Filter,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DeveloperDetails } from "../components/list-page";
import { DashboardCollectionResponse, DashboardEmailLog, deleteEmailLog, deleteEmailLogs, fetchEmailLogs } from "../lib/api";
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

function emailLogDeleteId(log: DashboardEmailLog) {
  return (log.id || log.source?.sourceId || "").trim();
}

function linkedKind(log: DashboardEmailLog) {
  if (log.linkedOrderId || (log.orderReference && !isInternalId(log.orderReference))) {
    return "order";
  }
  if (log.linkedRequestId || log.requestPublicToken || log.requestCustomerName || log.requestProductTitle) {
    return "request";
  }
  return "unlinked";
}

function uniqueOptions(logs: DashboardEmailLog[], getValue: (log: DashboardEmailLog) => string) {
  return Array.from(
    new Set(
      logs
        .map((log) => getValue(log).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
}

function inputDateFromDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

export function EmailLogsPage() {
  const { notify } = useToast();
  const [data, setData] = useState<DashboardCollectionResponse<DashboardEmailLog> | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [recipient, setRecipient] = useState("");
  const [excludeRecipients, setExcludeRecipients] = useState("");
  const [provider, setProvider] = useState("");
  const [messageType, setMessageType] = useState("");
  const [direction, setDirection] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("");
  const [quickRange, setQuickRange] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DashboardEmailLog | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await fetchEmailLogs({
          search,
          status,
          recipient,
          excludeRecipients,
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
  }, [dateFrom, dateTo, excludeRecipients, notify, recipient, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleLogs = useMemo(() => {
    const searchText = normalizedText(search);
    const statusText = normalizedText(status);
    const recipientText = normalizedText(recipient);
    const providerText = normalizedText(provider);
    const messageTypeText = normalizedText(messageType);
    const directionText = normalizedText(direction);
    const excludedRecipientTerms = excludeRecipients
      .split(",")
      .map((value) => normalizedText(value))
      .filter(Boolean);
    return (data?.items ?? []).filter((log) => {
      if (statusText && !normalizedText(statusLabel(log.status)).includes(statusText) && !normalizedText(log.status).includes(statusText)) {
        return false;
      }
      const recipientHaystack = normalizedText(`${log.toEmail} ${log.requestCustomerEmail}`);
      if (recipientText && !recipientHaystack.includes(recipientText)) {
        return false;
      }
      if (excludedRecipientTerms.some((term) => recipientHaystack.includes(term))) {
        return false;
      }
      if (providerText && normalizedText(log.provider) !== providerText) {
        return false;
      }
      if (messageTypeText && normalizedText(log.messageType || log.eventType) !== messageTypeText) {
        return false;
      }
      if (directionText && normalizedText(log.direction) !== directionText) {
        return false;
      }
      if (linkedFilter && linkedKind(log) !== linkedFilter) {
        return false;
      }
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
  }, [data?.items, direction, excludeRecipients, linkedFilter, messageType, provider, recipient, search, status]);

  const filterOptions = useMemo(() => {
    const logs = data?.items ?? [];
    return {
      providers: uniqueOptions(logs, (log) => log.provider),
      messageTypes: uniqueOptions(logs, (log) => log.messageType || log.eventType),
      directions: uniqueOptions(logs, (log) => log.direction),
    };
  }, [data?.items]);

  const visibleSelectableIds = useMemo(
    () => visibleLogs.map(emailLogDeleteId).filter(Boolean),
    [visibleLogs],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIdSet = useMemo(() => new Set(visibleSelectableIds), [visibleSelectableIds]);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 && visibleSelectableIds.every((id) => selectedIdSet.has(id));
  const selectedVisibleCount = selectedIds.filter((id) => visibleIdSet.has(id)).length;
  const activeFilterCount = [
    search,
    status,
    recipient,
    excludeRecipients,
    provider,
    messageType,
    direction,
    linkedFilter,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)));
  }, [visibleIdSet]);

  useEffect(() => {
    setSelectedIds([]);
  }, [dateFrom, dateTo, direction, excludeRecipients, linkedFilter, messageType, provider, recipient, search, status]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && selectMode) {
        setSelectMode(false);
        setSelectedIds([]);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectMode]);

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
    setRecipient("");
    setExcludeRecipients("");
    setProvider("");
    setMessageType("");
    setDirection("");
    setLinkedFilter("");
    setQuickRange("");
    setDateFrom("");
    setDateTo("");
    setSelectedIds([]);
  }

  function applyQuickRange(value: string) {
    setQuickRange(value);
    if (!value) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const days = value === "24h" ? 1 : value === "7d" ? 7 : value === "30d" ? 30 : 90;
    setDateFrom(inputDateFromDaysAgo(days));
    setDateTo(todayInputDate());
  }

  function toggleLogSelection(log: DashboardEmailLog) {
    const id = emailLogDeleteId(log);
    if (!id) {
      notify("This email log has no stable ID to select.", "error");
      return;
    }
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIdSet.has(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleSelectableIds])));
  }

  function toggleSelectMode() {
    setSelectMode((current) => !current);
    setSelectedIds([]);
  }

  async function removeLogs(ids: string[], confirmMessage: string) {
    const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (normalizedIds.length === 0) {
      notify("No selectable email logs found.", "error");
      return;
    }
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBulkDeleting(normalizedIds.length > 1);
    setDeletingId(normalizedIds.length === 1 ? normalizedIds[0] : "__bulk__");
    try {
      if (normalizedIds.length === 1) {
        await deleteEmailLog(normalizedIds[0]);
      } else {
        await deleteEmailLogs(normalizedIds);
      }
      setSelectedIds((current) => current.filter((id) => !normalizedIds.includes(id)));
      setSelected((current) => (current && normalizedIds.includes(emailLogDeleteId(current)) ? null : current));
      await load();
      notify(normalizedIds.length === 1 ? "Email log deleted from dashboard." : `${normalizedIds.length} email logs deleted from dashboard.`, "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to delete email logs.";
      setError(message);
      notify(message, "error");
    } finally {
      setDeletingId("");
      setBulkDeleting(false);
    }
  }

  async function removeLog(log: DashboardEmailLog) {
    const id = emailLogDeleteId(log);
    const label = log.subject || log.toEmail || "this email log";
    await removeLogs([id], `Delete ${label} from this dashboard? This hides the live log locally and does not modify ZAPP.`);
  }

  async function removeSelectedLogs() {
    await removeLogs(
      selectedIds,
      `Delete ${selectedIds.length} selected email log${selectedIds.length === 1 ? "" : "s"} from this dashboard? This hides the live logs locally and does not modify ZAPP.`,
    );
  }

  function exportLogs() {
    exportRows(visibleLogs, "email-logs.csv");
  }

  function exportSelectedLogs() {
    exportRows(
      visibleLogs.filter((log) => selectedIdSet.has(emailLogDeleteId(log))),
      "selected-email-logs.csv",
    );
  }

  function exportRows(rows: DashboardEmailLog[], filename: string) {
    const exported = downloadCsv(
      filename,
      rows.map((log) => {
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
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 overflow-x-hidden">
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
          <Button disabled={!visibleLogs.length || loading} variant={selectMode ? "secondary" : "outline"} onClick={toggleSelectMode}>
            {selectMode ? `Cancel selection${selectedIds.length ? ` (${selectedIds.length})` : ""}` : "Select"}
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
        <CardHeader className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
            <Badge variant={activeFilterCount ? "warning" : "muted"}>
              {activeFilterCount ? `${activeFilterCount} active` : "No filters"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAdvancedOpen((open) => !open)}>
              <SlidersHorizontal className="h-4 w-4" />
              Advanced
              <ChevronDown className={cn("h-4 w-4 transition", advancedOpen && "rotate-180")} />
            </Button>
            <Button onClick={applySearch}>
              <Search className="h-4 w-4" />
              Apply
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 p-4">
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-12">
            <FilterField className="lg:col-span-6" label="Search">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={cn(inputClass, "pl-9")}
                  placeholder="Subject, recipient, provider, request, or order"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applySearch();
                  }}
                />
              </label>
            </FilterField>
            <FilterField className="sm:col-span-1 lg:col-span-3" label="Status">
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
                <option value="bounced">Bounced</option>
              </select>
            </FilterField>
            <FilterField className="sm:col-span-1 lg:col-span-3" label="Quick date">
              <select className={inputClass} value={quickRange} onChange={(event) => applyQuickRange(event.target.value)}>
                <option value="">Custom / all time</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </FilterField>
            <FilterField className="lg:col-span-4" label="Recipient contains">
              <input
                className={inputClass}
                placeholder="customer@email.com or domain"
                title="Show emails sent to this recipient or domain"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
            </FilterField>
            <FilterField className="lg:col-span-4" label="Hide recipients">
              <input
                className={inputClass}
                placeholder="Comma-separated emails or domains"
                title="Hide emails sent to these recipients or domains"
                value={excludeRecipients}
                onChange={(event) => setExcludeRecipients(event.target.value)}
              />
            </FilterField>
            <FilterField className="lg:col-span-2" label="Start date">
              <DateInput label="Start date" value={dateFrom} onChange={(value) => { setQuickRange(""); setDateFrom(value); }} />
            </FilterField>
            <FilterField className="lg:col-span-2" label="End date">
              <DateInput label="End date" value={dateTo} onChange={(value) => { setQuickRange(""); setDateTo(value); }} />
            </FilterField>
          </div>

          {advancedOpen ? (
            <div className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Provider">
                <select className={inputClass} value={provider} onChange={(event) => setProvider(event.target.value)}>
                  <option value="">All providers</option>
                  {filterOptions.providers.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </FilterField>
              <FilterField label="Message type">
                <select className={inputClass} value={messageType} onChange={(event) => setMessageType(event.target.value)}>
                  <option value="">All message types</option>
                  {filterOptions.messageTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </FilterField>
              <FilterField label="Direction">
                <select className={inputClass} value={direction} onChange={(event) => setDirection(event.target.value)}>
                  <option value="">All directions</option>
                  {filterOptions.directions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </FilterField>
              <FilterField label="Linked item">
                <select className={inputClass} value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value)}>
                  <option value="">All linked states</option>
                  <option value="request">Linked to request</option>
                  <option value="order">Linked to order</option>
                  <option value="unlinked">Unlinked only</option>
                </select>
              </FilterField>
            </div>
          ) : null}

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

      {selectedIds.length > 0 ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{selectedIds.length} email log{selectedIds.length === 1 ? "" : "s"} selected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedVisibleCount} visible in the current filters. Deleting hides the selected live logs from this dashboard only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={bulkDeleting} variant="outline" onClick={exportSelectedLogs}>
                <Download className="h-4 w-4" />
                Export selected
              </Button>
              <Button variant="outline" onClick={() => { setSelectedIds([]); setSelectMode(false); }}>
                Clear selection
              </Button>
              <Button
                className="border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300"
                disabled={bulkDeleting}
                variant="outline"
                onClick={removeSelectedLogs}
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? "Deleting..." : "Delete selected"}
              </Button>
            </div>
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
              <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                  <tr>
                    {selectMode ? (
                      <HeaderCell className="w-[52px] text-center">
                        <input
                          aria-label="Select all visible email logs"
                          checked={allVisibleSelected}
                          disabled={visibleSelectableIds.length === 0}
                          type="checkbox"
                          onChange={toggleAllVisible}
                        />
                      </HeaderCell>
                    ) : null}
                    <HeaderCell className="w-[290px]">Message</HeaderCell>
                    <HeaderCell className="w-[245px]">Recipient</HeaderCell>
                    <HeaderCell className="w-[130px]">Status</HeaderCell>
                    <HeaderCell className="w-[130px]">Provider</HeaderCell>
                    <HeaderCell className="w-[210px]">Linked To</HeaderCell>
                    <HeaderCell className="w-[135px]">Date</HeaderCell>
                    <HeaderCell className="w-[130px] text-center">Action</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleLogs.map((log) => (
                    <tr
                      key={log.id || `${log.subject}-${log.createdAt}`}
                      className={cn("h-[76px] transition hover:bg-muted/30", selectMode && "cursor-pointer", selectedIdSet.has(emailLogDeleteId(log)) && "bg-primary/5")}
                      onClick={() => {
                        if (selectMode) toggleLogSelection(log);
                      }}
                    >
                      {selectMode ? (
                        <td className="px-4 py-4 text-center align-middle">
                          <input
                            aria-label="Select email log"
                            checked={selectedIdSet.has(emailLogDeleteId(log))}
                            disabled={!emailLogDeleteId(log)}
                            type="checkbox"
                            onChange={() => toggleLogSelection(log)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                      ) : null}
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
                        {selectMode ? (
                          <span className="block text-center text-xs text-muted-foreground">
                            {selectedIdSet.has(emailLogDeleteId(log)) ? "Selected" : "Select row"}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelected(log)}>
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              disabled={deletingId === emailLogDeleteId(log)}
                              size="icon"
                              title="Delete from dashboard"
                              variant="ghost"
                              onClick={() => removeLog(log)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {visibleLogs.map((log) => (
                <EmailLogCard
                  key={log.id || `${log.subject}-${log.createdAt}`}
                  deleting={deletingId === emailLogDeleteId(log)}
                  isSelected={selectedIdSet.has(emailLogDeleteId(log))}
                  log={log}
                  onDelete={removeLog}
                  onSelect={toggleLogSelection}
                  onView={setSelected}
                  selectMode={selectMode}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {selected ? (
        <EmailLogDetails
          deleting={deletingId === emailLogDeleteId(selected)}
          log={selected}
          onClose={() => setSelected(null)}
          onDelete={removeLog}
        />
      ) : null}
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

function FilterField({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
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

function EmailLogCard({
  deleting,
  isSelected,
  log,
  onDelete,
  onSelect,
  onView,
  selectMode,
}: {
  deleting: boolean;
  isSelected: boolean;
  log: DashboardEmailLog;
  onDelete: (log: DashboardEmailLog) => void;
  onSelect: (log: DashboardEmailLog) => void;
  onView: (log: DashboardEmailLog) => void;
  selectMode: boolean;
}) {
  return (
    <div
      className={cn("rounded-md border bg-background p-4", selectMode && "cursor-pointer", isSelected && "border-primary/30 bg-primary/5")}
      onClick={() => {
        if (selectMode) onSelect(log);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {selectMode ? (
            <input
              aria-label="Select email log"
              checked={isSelected}
              className="mt-1 shrink-0"
              disabled={!emailLogDeleteId(log)}
              type="checkbox"
              onChange={() => onSelect(log)}
              onClick={(event) => event.stopPropagation()}
            />
          ) : null}
          <MessageCell log={log} />
        </div>
        <EmailStatusBadge value={log.status} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Recipient"><RecipientCell log={log} /></InfoBlock>
        <InfoBlock label="Linked To"><LinkedCell log={log} /></InfoBlock>
        <InfoBlock label="Provider"><span className="text-sm">{safeDisplay(log.provider)}</span></InfoBlock>
        <InfoBlock label="Date"><DateCell value={log.createdAt} /></InfoBlock>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {selectMode ? (
          <span className="text-xs text-muted-foreground">{isSelected ? "Selected" : "Tap card to select"}</span>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => onView(log)}>
              <Eye className="h-3.5 w-3.5" />
              View
            </Button>
            <Button disabled={deleting} size="sm" variant="outline" onClick={() => onDelete(log)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
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

function EmailLogDetails({
  deleting,
  log,
  onClose,
  onDelete,
}: {
  deleting: boolean;
  log: DashboardEmailLog;
  onClose: () => void;
  onDelete: (log: DashboardEmailLog) => void;
}) {
  const fields: Array<[string, ReactNode]> = [
    ["Status", <EmailStatusBadge key="status" value={log.status} />],
    ["Message type", safeDisplay(log.messageType)],
    ["Event type", safeDisplay(log.eventType)],
    ["Direction", safeDisplay(log.direction)],
    ["Provider", safeDisplay(log.provider)],
    ["Subject", safeDisplay(log.subject)],
    ["From", safeDisplay(log.fromEmail)],
    ["To", safeDisplay(log.toEmail)],
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
  const developerFields: Array<[string, ReactNode]> = [
    ["Log ID", safeDisplay(log.id)],
    ["Provider email ID", safeDisplay(log.resendEmailId)],
    ["Webhook delivery ID", safeDisplay(log.webhookDeliveryId)],
    ["Linked request ID", safeDisplay(log.linkedRequestId)],
    ["Linked order ID", safeDisplay(log.linkedOrderId)],
    ["Request token", safeDisplay(log.requestPublicToken)],
    ["Metadata", safeDisplay(log.metadataSummary)],
    ["Source ID", safeDisplay(log.source?.sourceId)],
    ["Upstream fields", log.source?.availableFields?.join(", ") || "None reported"],
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
          <div className="flex shrink-0 gap-2">
            <Button disabled={deleting} size="sm" variant="outline" onClick={() => onDelete(log)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button aria-label="Close details" size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
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
          <DeveloperDetails fields={developerFields} />
        </div>
      </div>
    </div>
  );
}
