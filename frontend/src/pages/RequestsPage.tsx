import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  MessageSquare,
  MoreHorizontal,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  CostPayload,
  CurrencyRecord,
  DashboardCollectionResponse,
  DashboardRequest,
  createCost,
  fetchCurrencies,
  fetchRequests,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, downloadCsv, formatCurrency, safeDisplay } from "../lib/utils";

const PAGE_SIZE = 100;
const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const statusOptions = [
  "Submitted",
  "Reviewing",
  "Awaiting Customer",
  "Quoted",
  "Approved",
  "Cancelled",
];

const paymentOptions = [
  "Pending",
  "Receipt Uploaded",
  "Pending Verification",
  "Verified",
  "Paid",
];

const blankCostForm = {
  product_purchase_cost: "0",
  bml_tax: "0",
  import_tax: "0",
  shipping_cost: "0",
  additional_cost: "0",
  sale_total: "0",
  currency: "MVR",
  notes: "",
};

function requestPrimary(request: DashboardRequest) {
  return request.requestNumber || request.reference || request.id;
}

function truncateId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
}

function dateParts(value: string) {
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

function normalizedText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function labelFromStatus(value: string | null | undefined) {
  const normalized = normalizedText(value);
  if (!normalized) return "Unknown";
  if (normalized.includes("awaiting")) return "Awaiting Customer";
  if (normalized.includes("review")) return "Reviewing";
  if (normalized.includes("submit")) return "Submitted";
  if (normalized.includes("quote")) return "Quoted";
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("paid")) return "Paid";
  if (normalized.includes("receipt") && normalized.includes("upload")) return "Receipt Uploaded";
  if (normalized.includes("verification")) return "Pending Verification";
  if (normalized.includes("verified")) return "Verified";
  if (normalized.includes("pending") || normalized.includes("open")) return "Pending";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string | null | undefined) {
  const normalized = normalizedText(value);
  if (normalized.includes("approve") || normalized.includes("paid") || normalized.includes("verified")) return "success";
  if (normalized.includes("pending") || normalized.includes("awaiting") || normalized.includes("review") || normalized.includes("quote")) return "warning";
  if (normalized.includes("cancel") || normalized.includes("reject") || normalized.includes("fail")) return "destructive";
  return "muted";
}

function numberFrom(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function activeCurrencyOrBase(currencies: CurrencyRecord[], code: string | null | undefined) {
  if (code && currencies.some((currency) => currency.code === code && currency.is_active)) {
    return code;
  }
  return (
    currencies.find((currency) => currency.is_base && currency.is_active)?.code ||
    currencies.find((currency) => currency.is_active)?.code ||
    "MVR"
  );
}

export function RequestsPage() {
  const { notify } = useToast();
  const [data, setData] = useState<DashboardCollectionResponse<DashboardRequest> | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DashboardRequest | null>(null);
  const [costRequest, setCostRequest] = useState<DashboardRequest | null>(null);
  const [costForm, setCostForm] = useState(blankCostForm);
  const [costError, setCostError] = useState("");
  const [savingCost, setSavingCost] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [requests, activeCurrencies] = await Promise.all([
        fetchRequests({
          search,
          status: status ? status.toLowerCase().replace(/\s+/g, "_") : "",
          dateFrom,
          dateTo,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
        fetchCurrencies({ includeInactive: false }),
      ]);
      setData(requests);
      setCurrencies(activeCurrencies);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load requests.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, notify, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRequests = useMemo(() => {
    const searchText = normalizedText(search);
    const paymentText = normalizedText(payment);
    const filtered = (data?.items ?? []).filter((request) => {
      if (paymentText) {
        const requestPayment = normalizedText(`${request.paymentStatus} ${request.receiptStatus}`);
        if (!requestPayment.includes(paymentText)) {
          return false;
        }
      }
      if (searchText) {
        const haystack = normalizedText(
          [
            request.id,
            request.requestNumber,
            request.reference,
            request.publicToken,
            request.customerName,
            request.customerEmail,
            request.productTitle,
          ].join(" "),
        );
        if (!haystack.includes(searchText)) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === "highest") {
        return Number(b.quotedTotal || 0) - Number(a.quotedTotal || 0);
      }
      if (sortBy === "lowest") {
        return Number(a.quotedTotal || 0) - Number(b.quotedTotal || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [data?.items, payment, search, sortBy]);

  const summary = useMemo(() => {
    return visibleRequests.reduce(
      (acc, request) => {
        const statusLabel = labelFromStatus(request.status);
        acc.totalRequests += 1;
        acc.totalValue += Number(request.quotedTotal || 0);
        if (statusLabel === "Reviewing") acc.pendingReview += 1;
        if (statusLabel === "Awaiting Customer") acc.awaitingCustomer += 1;
        if (statusLabel === "Quoted") acc.quoted += 1;
        if (statusLabel === "Approved") acc.approved += 1;
        return acc;
      },
      {
        totalRequests: 0,
        totalValue: 0,
        pendingReview: 0,
        awaitingCustomer: 0,
        quoted: 0,
        approved: 0,
      },
    );
  }, [visibleRequests]);

  const liveConnected =
    typeof data?.source?.upstreamStatus === "number" &&
    data.source.upstreamStatus >= 200 &&
    data.source.upstreamStatus < 300;
  const summaryCurrency = visibleRequests.find((request) => request.currency)?.currency || "MVR";

  function applySearch() {
    setSearch(searchInput);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setPayment("");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
  }

  function exportRequests() {
    const exported = downloadCsv(
      "requests.csv",
      visibleRequests.map((request) => ({
        id: request.id,
        request_number: request.requestNumber,
        reference: request.reference,
        customer: request.customerName,
        email: request.customerEmail,
        status: request.status,
        payment: request.paymentStatus,
        quoted_total: request.quotedTotal,
        currency: request.currency,
        profit_base: request.financeSummary?.totalProfitBase,
        margin_percent: request.financeSummary?.marginPercent,
        created_at: request.createdAt,
      })),
    );
    notify(exported ? "Requests CSV exported." : "No requests to export.", exported ? "success" : "info");
  }

  async function copyRequestId(request: DashboardRequest) {
    try {
      await navigator.clipboard.writeText(requestPrimary(request));
      notify("Request ID copied.", "success");
    } catch {
      notify("Unable to copy request ID.", "error");
    }
  }

  function openCostForm(request: DashboardRequest) {
    setCostRequest(request);
    setCostError("");
    setCostForm({
      ...blankCostForm,
      sale_total: String(request.quotedTotal || 0),
      currency: activeCurrencyOrBase(currencies, request.currency),
    });
  }

  function readOnlyAction(label: string) {
    notify(`${label} is read-only in this dashboard phase.`, "info");
  }

  async function saveCost(event: FormEvent) {
    event.preventDefault();
    if (!costRequest) return;

    setSavingCost(true);
    setCostError("");
    const payload: CostPayload = {
      source_type: "request",
      source_id: costRequest.id,
      linked_request_id: costRequest.id,
      reference_label: costRequest.requestNumber || costRequest.reference || costRequest.id,
      customer_name: costRequest.customerName || null,
      title: costRequest.productTitle || costRequest.reference || "Purchase request",
      product_purchase_cost: numberFrom(costForm.product_purchase_cost),
      bml_tax: numberFrom(costForm.bml_tax),
      import_tax: numberFrom(costForm.import_tax),
      shipping_cost: numberFrom(costForm.shipping_cost),
      additional_cost: numberFrom(costForm.additional_cost),
      sale_total: numberFrom(costForm.sale_total),
      currency: costForm.currency,
      notes: costForm.notes || null,
    };

    try {
      await createCost(payload);
      setCostRequest(null);
      setCostForm(blankCostForm);
      notify("Cost record created.", "success");
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to create cost record.";
      setCostError(message);
      notify(message, "error");
    } finally {
      setSavingCost(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Requests</h2>
            <Badge variant={liveConnected ? "success" : error ? "destructive" : "muted"}>
              {liveConnected ? "Live API connected" : "Awaiting live data"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live purchase requests with quote status, payment state, and internal profitability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!visibleRequests.length} variant="outline" onClick={exportRequests}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button disabled={loading} onClick={load}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total Requests" value={String(summary.totalRequests)} />
        <SummaryCard label="Total Value" value={formatCurrency(summary.totalValue, summaryCurrency)} />
        <SummaryCard label="Pending Review" value={String(summary.pendingReview)} />
        <SummaryCard label="Awaiting Customer" value={String(summary.awaitingCustomer)} />
        <SummaryCard label="Quoted" value={String(summary.quoted)} />
        <SummaryCard label="Approved" value={String(summary.approved)} tone="success" />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 xl:grid-cols-[1.35fr_170px_210px_150px_150px_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(inputClass, "pl-9")}
                placeholder="Search ID, customer, email, or title"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            </label>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select className={inputClass} value={payment} onChange={(event) => setPayment(event.target.value)}>
              <option value="">All payments</option>
              {paymentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <DateInput value={dateFrom} onChange={setDateFrom} />
            <DateInput value={dateTo} onChange={setDateTo} />
            <select className={inputClass} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
            <div className="flex gap-2">
              <Button className="flex-1 xl:flex-none" onClick={applySearch}>Search</Button>
              <Button aria-label="Reset filters" size="icon" variant="outline" onClick={resetFilters}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{visibleRequests.length} shown from {data?.total ?? 0} live request(s)</span>
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
            <CardTitle>Purchase Requests</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced {formatRequestDate(data?.fetchedAt).date} {formatRequestDate(data?.fetchedAt).time}
            </p>
          </div>
          <Badge variant={loading ? "warning" : "muted"}>{loading ? "Loading" : `${visibleRequests.length} rows`}</Badge>
        </CardHeader>

        {loading && !data ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}
          </CardContent>
        ) : visibleRequests.length === 0 && !error ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No requests found</p>
            <p className="text-sm text-muted-foreground">Adjust the filters or refresh after new ZAPP requests arrive.</p>
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                  <tr>
                    <HeaderCell className="w-[178px]">Request</HeaderCell>
                    <HeaderCell className="w-[220px]">Customer</HeaderCell>
                    <HeaderCell className="w-[145px]">Status</HeaderCell>
                    <HeaderCell className="w-[165px]">Payment</HeaderCell>
                    <HeaderCell className="w-[140px] text-right">Amount</HeaderCell>
                    <HeaderCell className="w-[138px]">Cost</HeaderCell>
                    <HeaderCell className="w-[130px] text-right">Profit</HeaderCell>
                    <HeaderCell className="w-[128px]">Date</HeaderCell>
                    <HeaderCell className="w-[210px] text-center">Action</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleRequests.map((request) => (
                    <tr key={request.id || JSON.stringify(request.source)} className="h-[76px] transition hover:bg-muted/30">
                      <td className="px-4 py-4 align-middle">
                        <RequestId request={request} onCopy={copyRequestId} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <CustomerCell request={request} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <LargeStatusBadge value={request.status} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <LargeStatusBadge value={request.paymentStatus || request.receiptStatus || request.quoteStatus} />
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <AmountCell request={request} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <CostBadge request={request} onClick={openCostForm} />
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <ProfitCell request={request} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <DateCell value={request.createdAt} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <RowActions
                          request={request}
                          onMessage={() => readOnlyAction("Message")}
                          onMore={() => readOnlyAction("More actions")}
                          onQuote={() => readOnlyAction("Quote")}
                          onView={setSelected}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {visibleRequests.map((request) => (
                <RequestCard
                  key={request.id || JSON.stringify(request.source)}
                  request={request}
                  onCopy={copyRequestId}
                  onCost={openCostForm}
                  onMessage={() => readOnlyAction("Message")}
                  onMore={() => readOnlyAction("More actions")}
                  onQuote={() => readOnlyAction("Quote")}
                  onView={setSelected}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {selected ? <RequestDetails request={selected} onClose={() => setSelected(null)} /> : null}
      {costRequest ? (
        <CostModal
          currencies={currencies}
          error={costError}
          form={costForm}
          request={costRequest}
          saving={savingCost}
          setForm={setCostForm}
          onClose={() => setCostRequest(null)}
          onSubmit={saveCost}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-2 truncate text-2xl font-bold", tone === "success" && "text-emerald-600 dark:text-emerald-400")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input className={cn(inputClass, "pl-9")} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
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

function RequestId({ request, onCopy }: { request: DashboardRequest; onCopy: (request: DashboardRequest) => void }) {
  const primary = requestPrimary(request);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[112px] truncate whitespace-nowrap font-mono text-xs font-semibold" title={primary}>
          {truncateId(primary)}
        </span>
        {primary ? (
          <Button aria-label="Copy request ID" className="h-7 w-7 shrink-0" size="icon" variant="ghost" onClick={() => onCopy(request)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {request.productTitle ? (
        <p className="mt-1 truncate whitespace-nowrap text-[11px] text-muted-foreground" title={request.productTitle}>
          {request.productTitle}
        </p>
      ) : null}
    </div>
  );
}

function CustomerCell({ request }: { request: DashboardRequest }) {
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap text-sm font-medium" title={request.customerName}>
        {safeDisplay(request.customerName, "Customer")}
      </p>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-muted-foreground" title={request.customerEmail}>
        {safeDisplay(request.customerEmail)}
      </p>
    </div>
  );
}

function LargeStatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className="flex h-8 min-w-[120px] justify-center rounded-full px-3 normal-case tracking-normal"
      variant={statusTone(value)}
    >
      {labelFromStatus(value)}
    </Badge>
  );
}

function AmountCell({ request }: { request: DashboardRequest }) {
  if (request.quotedTotal === null) {
    return <span className="whitespace-nowrap text-sm font-medium">{safeDisplay(request.quoteMvr || request.quoteUsd)}</span>;
  }
  return <span className="whitespace-nowrap text-sm font-semibold">{formatCurrency(request.quotedTotal, request.currency || "MVR")}</span>;
}

function CostBadge({ request, onClick }: { request: DashboardRequest; onClick: (request: DashboardRequest) => void }) {
  const summary = request.financeSummary;
  if (summary?.missingCostRecord) {
    return (
      <button
        className="flex h-8 min-w-[120px] items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 text-[10px] font-medium text-orange-600 transition hover:bg-orange-500/20 dark:text-orange-400"
        title="Profit cannot be calculated until cost data is entered."
        type="button"
        onClick={() => onClick(request)}
      >
        Cost Required
      </button>
    );
  }
  if (summary?.hasCostRecord) {
    return (
      <Badge className="flex h-8 min-w-[120px] justify-center rounded-full normal-case tracking-normal" variant="success">
        Cost Added
      </Badge>
    );
  }
  return (
    <button
      className="flex h-8 min-w-[120px] items-center justify-center rounded-full border bg-muted px-3 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/70"
      title="Profit cannot be calculated until cost data is entered."
      type="button"
      onClick={() => onClick(request)}
    >
      No Cost Data
    </button>
  );
}

function ProfitCell({ request }: { request: DashboardRequest }) {
  const summary = request.financeSummary;
  if (!summary?.hasCostRecord || summary.totalProfitBase === null || summary.totalProfitBase === undefined) {
    return (
      <div className="text-right text-sm text-muted-foreground">
        <p>--</p>
        <p className="text-[11px]">--</p>
      </div>
    );
  }
  const profit = Number(summary.totalProfitBase || 0);
  const tone = profit > 0 ? "text-emerald-600 dark:text-emerald-400" : profit < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
  return (
    <div className={cn("text-right", tone)}>
      <p className="whitespace-nowrap text-sm font-semibold">{formatCurrency(profit, summary.baseCurrency)}</p>
      <p className="mt-1 text-[11px]">{summary.marginPercent === null ? "--" : `${Number(summary.marginPercent).toFixed(2)}%`}</p>
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

function formatRequestDate(value: string | undefined) {
  return dateParts(value || "");
}

function RowActions({
  request,
  onMessage,
  onMore,
  onQuote,
  onView,
}: {
  request: DashboardRequest;
  onMessage: () => void;
  onMore: () => void;
  onQuote: () => void;
  onView: (request: DashboardRequest) => void;
}) {
  const status = normalizedText(request.status);
  const canQuote = !status.includes("cancel") && !status.includes("approve");
  return (
    <div className="flex items-center justify-center gap-1">
      <Button size="sm" variant="outline" onClick={() => onView(request)}>
        <Eye className="h-3.5 w-3.5" />
        View
      </Button>
      <Button size="icon" title="Message customer" variant="ghost" onClick={onMessage}>
        <MessageSquare className="h-4 w-4" />
      </Button>
      {canQuote ? (
        <Button size="icon" title="Quote request" variant="ghost" onClick={onQuote}>
          <FileText className="h-4 w-4" />
        </Button>
      ) : null}
      <Button size="icon" title="More actions" variant="ghost" onClick={onMore}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RequestCard({
  request,
  onCopy,
  onCost,
  onMessage,
  onMore,
  onQuote,
  onView,
}: {
  request: DashboardRequest;
  onCopy: (request: DashboardRequest) => void;
  onCost: (request: DashboardRequest) => void;
  onMessage: () => void;
  onMore: () => void;
  onQuote: () => void;
  onView: (request: DashboardRequest) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <RequestId request={request} onCopy={onCopy} />
        <DateCell value={request.createdAt} />
      </div>
      <div className="mt-4">
        <CustomerCell request={request} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LargeStatusBadge value={request.status} />
        <LargeStatusBadge value={request.paymentStatus || request.receiptStatus || request.quoteStatus} />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
          <AmountCell request={request} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
          <ProfitCell request={request} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <CostBadge request={request} onClick={onCost} />
        <RowActions request={request} onMessage={onMessage} onMore={onMore} onQuote={onQuote} onView={onView} />
      </div>
    </div>
  );
}

function RequestDetails({ request, onClose }: { request: DashboardRequest; onClose: () => void }) {
  const fields = [
    ["Request ID", requestPrimary(request)],
    ["Request number", request.requestNumber],
    ["Reference", request.reference],
    ["Customer", request.customerName],
    ["Email", request.customerEmail],
    ["Product", request.productTitle],
    ["Product URL", request.productUrl],
    ["Status", labelFromStatus(request.status)],
    ["Payment", labelFromStatus(request.paymentStatus || request.receiptStatus)],
    ["Quoted total", request.quotedTotal === null ? safeDisplay(request.quoteMvr || request.quoteUsd) : formatCurrency(request.quotedTotal, request.currency)],
    ["Linked order", request.linkedOrderId],
    ["Latest message", request.latestMessageStatus],
    ["Email status", request.emailStatus],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
          <div>
            <h3 className="text-lg font-semibold">{truncateId(requestPrimary(request))}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{request.productTitle || "Purchase request"}</p>
          </div>
          <Button aria-label="Close details" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-2 break-words text-sm">{safeDisplay(value)}</p>
            </div>
          ))}
          <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Linked cost records</p>
            <div className="mt-2">
              <LinkedCosts request={request} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedCosts({ request }: { request: DashboardRequest }) {
  const records = request.financeSummary?.costRecords ?? [];
  if (records.length === 0) {
    return <span className="text-sm text-muted-foreground">No linked cost records</span>;
  }
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-md border bg-background/60 p-2">
          <p className="font-medium">{safeDisplay(record.referenceLabel, `Cost #${record.id}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Profit {formatCurrency(record.profitBase ?? record.profit, record.profitBase === null ? record.currency : request.financeSummary?.baseCurrency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function CostModal({
  currencies,
  error,
  form,
  request,
  saving,
  setForm,
  onClose,
  onSubmit,
}: {
  currencies: CurrencyRecord[];
  error: string;
  form: typeof blankCostForm;
  request: DashboardRequest;
  saving: boolean;
  setForm: (form: typeof blankCostForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
          <div>
            <h3 className="text-lg font-semibold">Create Cost Record</h3>
            <p className="mt-1 text-xs text-muted-foreground">{requestPrimary(request)}</p>
          </div>
          <Button aria-label="Close cost form" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
          {error ? (
            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300 sm:col-span-2">
              {error}
            </div>
          ) : null}
          <CostField label="Revenue">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.sale_total} onChange={(event) => setForm({ ...form, sale_total: event.target.value })} />
          </CostField>
          <CostField label="Currency">
            <select className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
              {currencies.length === 0 ? <option value={form.currency}>{form.currency}</option> : null}
              {currencies.map((currency) => <option key={currency.id} value={currency.code}>{currency.code}</option>)}
            </select>
          </CostField>
          <CostField label="Product purchase cost">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.product_purchase_cost} onChange={(event) => setForm({ ...form, product_purchase_cost: event.target.value })} />
          </CostField>
          <CostField label="BML / payment tax">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.bml_tax} onChange={(event) => setForm({ ...form, bml_tax: event.target.value })} />
          </CostField>
          <CostField label="Import tax">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.import_tax} onChange={(event) => setForm({ ...form, import_tax: event.target.value })} />
          </CostField>
          <CostField label="Shipping cost">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.shipping_cost} onChange={(event) => setForm({ ...form, shipping_cost: event.target.value })} />
          </CostField>
          <CostField label="Additional cost">
            <input required className={inputClass} min="0" step="0.01" type="number" value={form.additional_cost} onChange={(event) => setForm({ ...form, additional_cost: event.target.value })} />
          </CostField>
          <div className="sm:col-span-2">
            <CostField label="Notes">
              <textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </CostField>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button disabled={saving} type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Cost"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CostField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
