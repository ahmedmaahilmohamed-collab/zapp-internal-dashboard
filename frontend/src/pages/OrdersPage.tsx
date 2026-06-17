import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Copy,
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
import {
  CostPayload,
  CurrencyRecord,
  DashboardCollectionResponse,
  DashboardOrder,
  createCost,
  fetchCurrencies,
  fetchOrders,
} from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, downloadCsv, formatCurrency, safeDisplay } from "../lib/utils";

const PAGE_SIZE = 100;
const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const statusOptions = [
  "Fulfilled",
  "Unfulfilled",
  "Partially Fulfilled",
  "Approved",
  "Pending",
  "Cancelled",
  "Refunded",
];

const paymentOptions = [
  "Paid",
  "Pending",
  "Authorized",
  "Partially Paid",
  "Refunded",
  "Voided",
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

function orderPrimary(order: DashboardOrder) {
  return order.orderName || (order.orderNumber ? `#${order.orderNumber}` : order.id);
}

function orderSubtitle(order: DashboardOrder) {
  const pieces = [order.sourceType, order.itemCount ? `${order.itemCount} item${order.itemCount === 1 ? "" : "s"}` : ""].filter(Boolean);
  return pieces.join(" · ");
}

function truncateId(value: string) {
  return value.length <= 16 ? value : `${value.slice(0, 12)}...`;
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
  if (normalized.includes("partial") && normalized.includes("fulfill")) return "Partially Fulfilled";
  if (normalized.includes("fulfill")) return "Fulfilled";
  if (normalized.includes("unfulfill")) return "Unfulfilled";
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("refund")) return "Refunded";
  if (normalized.includes("void")) return "Voided";
  if (normalized.includes("authoriz")) return "Authorized";
  if (normalized.includes("paid")) return "Paid";
  if (normalized.includes("pending") || normalized.includes("open")) return "Pending";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string | null | undefined) {
  const normalized = normalizedText(value);
  if (normalized.includes("paid") || normalized.includes("fulfilled") || normalized.includes("approve")) return "success";
  if (normalized.includes("pending") || normalized.includes("open") || normalized.includes("authoriz") || normalized.includes("partial")) return "warning";
  if (normalized.includes("cancel") || normalized.includes("refund") || normalized.includes("void") || normalized.includes("reject")) return "destructive";
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

export function OrdersPage() {
  const { notify } = useToast();
  const [data, setData] = useState<DashboardCollectionResponse<DashboardOrder> | null>(null);
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
  const [selected, setSelected] = useState<DashboardOrder | null>(null);
  const [costOrder, setCostOrder] = useState<DashboardOrder | null>(null);
  const [costForm, setCostForm] = useState(blankCostForm);
  const [costError, setCostError] = useState("");
  const [savingCost, setSavingCost] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orders, activeCurrencies] = await Promise.all([
        fetchOrders({
          search,
          status: status ? status.toLowerCase().replace(/\s+/g, "_") : "",
          dateFrom,
          dateTo,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
        fetchCurrencies({ includeInactive: false }),
      ]);
      setData(orders);
      setCurrencies(activeCurrencies);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load orders.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, notify, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleOrders = useMemo(() => {
    const searchText = normalizedText(search);
    const statusText = normalizedText(status);
    const paymentText = normalizedText(payment);
    const filtered = (data?.items ?? []).filter((order) => {
      if (statusText) {
        const orderStatus = normalizedText(`${order.status} ${order.fulfillmentStatus}`);
        if (!orderStatus.includes(statusText)) {
          return false;
        }
      }
      if (paymentText) {
        const orderPayment = normalizedText(order.financialStatus);
        if (!orderPayment.includes(paymentText)) {
          return false;
        }
      }
      const createdTime = order.createdAt ? new Date(order.createdAt).getTime() : Number.NaN;
      if (dateFrom && (Number.isNaN(createdTime) || createdTime < new Date(`${dateFrom}T00:00:00`).getTime())) {
        return false;
      }
      if (dateTo && (Number.isNaN(createdTime) || createdTime > new Date(`${dateTo}T23:59:59`).getTime())) {
        return false;
      }
      if (searchText) {
        const haystack = normalizedText(
          [
            order.id,
            order.orderName,
            order.orderNumber,
            order.customerName,
            order.customerEmail,
            order.status,
            order.financialStatus,
            order.fulfillmentStatus,
            order.trackingNumber,
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
        return Number(b.total || 0) - Number(a.total || 0);
      }
      if (sortBy === "lowest") {
        return Number(a.total || 0) - Number(b.total || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [data?.items, dateFrom, dateTo, payment, search, sortBy, status]);

  const summary = useMemo(() => {
    return visibleOrders.reduce(
      (acc, order) => {
        const fulfillment = labelFromStatus(order.fulfillmentStatus || order.status);
        const paymentLabel = labelFromStatus(order.financialStatus);
        acc.totalOrders += 1;
        acc.totalValue += Number(order.total || 0);
        if (paymentLabel === "Paid") acc.paid += 1;
        if (fulfillment === "Fulfilled") acc.fulfilled += 1;
        if (paymentLabel === "Pending" || fulfillment === "Pending" || fulfillment === "Unfulfilled") acc.pending += 1;
        if (fulfillment === "Cancelled" || paymentLabel === "Refunded") acc.cancelled += 1;
        return acc;
      },
      {
        totalOrders: 0,
        totalValue: 0,
        paid: 0,
        fulfilled: 0,
        pending: 0,
        cancelled: 0,
      },
    );
  }, [visibleOrders]);

  const liveConnected =
    typeof data?.source?.upstreamStatus === "number" &&
    data.source.upstreamStatus >= 200 &&
    data.source.upstreamStatus < 300;
  const summaryCurrency = visibleOrders.find((order) => order.currency)?.currency || "MVR";

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

  function exportOrders() {
    const exported = downloadCsv(
      "orders.csv",
      visibleOrders.map((order) => ({
        order: orderPrimary(order),
        internal_id: order.id,
        customer: order.customerName,
        email: order.customerEmail,
        status: order.status,
        financial_status: order.financialStatus,
        fulfillment_status: order.fulfillmentStatus,
        total: order.total,
        currency: order.currency,
        profit_base: order.financeSummary?.totalProfitBase,
        margin_percent: order.financeSummary?.marginPercent,
        created_at: order.createdAt,
      })),
    );
    notify(exported ? "Orders CSV exported." : "No orders to export.", exported ? "success" : "info");
  }

  async function copyOrderLabel(order: DashboardOrder) {
    try {
      await navigator.clipboard.writeText(orderPrimary(order));
      notify("Order copied.", "success");
    } catch {
      notify("Unable to copy order.", "error");
    }
  }

  function openCostForm(order: DashboardOrder) {
    setCostOrder(order);
    setCostError("");
    setCostForm({
      ...blankCostForm,
      sale_total: String(order.total || 0),
      currency: activeCurrencyOrBase(currencies, order.currency),
    });
  }

  function readOnlyAction(label: string) {
    notify(`${label} is read-only in this dashboard phase.`, "info");
  }

  async function saveCost(event: FormEvent) {
    event.preventDefault();
    if (!costOrder) return;

    setSavingCost(true);
    setCostError("");
    const payload: CostPayload = {
      source_type: "order",
      source_id: costOrder.id,
      linked_order_id: costOrder.id,
      reference_label: costOrder.orderName || costOrder.orderNumber || costOrder.id,
      customer_name: costOrder.customerName || null,
      title: costOrder.orderName || costOrder.orderNumber || "Shopify order",
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
      setCostOrder(null);
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
            <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
            <Badge variant={liveConnected ? "success" : error ? "destructive" : "muted"}>
              {liveConnected ? "Live API connected" : "Awaiting live data"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live Shopify orders with fulfillment, payment, and internal profitability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!visibleOrders.length} variant="outline" onClick={exportOrders}>
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
        <SummaryCard label="Total Orders" value={String(summary.totalOrders)} />
        <SummaryCard label="Total Value" value={formatCurrency(summary.totalValue, summaryCurrency)} />
        <SummaryCard label="Paid" value={String(summary.paid)} tone="success" />
        <SummaryCard label="Fulfilled" value={String(summary.fulfilled)} tone="success" />
        <SummaryCard label="Pending" value={String(summary.pending)} />
        <SummaryCard label="Cancelled / Refunded" value={String(summary.cancelled)} tone="danger" />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 xl:grid-cols-[1.35fr_190px_190px_150px_150px_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(inputClass, "pl-9")}
                placeholder="Search order, customer, email, or tracking"
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
            <span>{visibleOrders.length} shown from {data?.total ?? 0} live order(s)</span>
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
            <CardTitle>Shopify Orders</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced {formatOrderDate(data?.fetchedAt).date} {formatOrderDate(data?.fetchedAt).time}
            </p>
          </div>
          <Badge variant={loading ? "warning" : "muted"}>{loading ? "Loading" : `${visibleOrders.length} rows`}</Badge>
        </CardHeader>

        {loading && !data ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}
          </CardContent>
        ) : visibleOrders.length === 0 && !error ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No orders found</p>
            <p className="text-sm text-muted-foreground">Adjust the filters or refresh after new ZAPP orders arrive.</p>
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1160px] table-fixed border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                  <tr>
                    <HeaderCell className="w-[180px]">Order</HeaderCell>
                    <HeaderCell className="w-[220px]">Customer</HeaderCell>
                    <HeaderCell className="w-[150px]">Fulfillment</HeaderCell>
                    <HeaderCell className="w-[150px]">Payment</HeaderCell>
                    <HeaderCell className="w-[140px] text-right">Total</HeaderCell>
                    <HeaderCell className="w-[138px]">Cost</HeaderCell>
                    <HeaderCell className="w-[130px] text-right">Profit</HeaderCell>
                    <HeaderCell className="w-[128px]">Date</HeaderCell>
                    <HeaderCell className="w-[150px] text-center">Action</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleOrders.map((order) => (
                    <tr key={order.id || JSON.stringify(order.source)} className="h-[76px] transition hover:bg-muted/30">
                      <td className="px-4 py-4 align-middle">
                        <OrderLabel order={order} onCopy={copyOrderLabel} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <CustomerCell order={order} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <LargeStatusBadge value={order.fulfillmentStatus || order.status} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <LargeStatusBadge value={order.financialStatus} />
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <AmountCell order={order} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <CostBadge order={order} onClick={openCostForm} />
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <ProfitCell order={order} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <DateCell value={order.createdAt} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <RowActions order={order} onMore={() => readOnlyAction("More actions")} onView={setSelected} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id || JSON.stringify(order.source)}
                  order={order}
                  onCopy={copyOrderLabel}
                  onCost={openCostForm}
                  onMore={() => readOnlyAction("More actions")}
                  onView={setSelected}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {selected ? <OrderDetails order={selected} onClose={() => setSelected(null)} /> : null}
      {costOrder ? (
        <CostModal
          currencies={currencies}
          error={costError}
          form={costForm}
          order={costOrder}
          saving={savingCost}
          setForm={setCostForm}
          onClose={() => setCostOrder(null)}
          onSubmit={saveCost}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 truncate text-2xl font-bold",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "danger" && "text-red-600 dark:text-red-400",
          )}
        >
          {value}
        </p>
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

function OrderLabel({ order, onCopy }: { order: DashboardOrder; onCopy: (order: DashboardOrder) => void }) {
  const primary = orderPrimary(order);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[118px] truncate whitespace-nowrap font-mono text-xs font-semibold" title={primary}>
          {truncateId(primary)}
        </span>
        {primary ? (
          <Button aria-label="Copy order" className="h-7 w-7 shrink-0" size="icon" variant="ghost" onClick={() => onCopy(order)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {orderSubtitle(order) ? (
        <p className="mt-1 truncate whitespace-nowrap text-[11px] text-muted-foreground" title={orderSubtitle(order)}>
          {orderSubtitle(order)}
        </p>
      ) : null}
      {order.trackingNumber ? (
        <p className="mt-1 truncate whitespace-nowrap text-[11px] text-muted-foreground" title={order.trackingNumber}>
          {order.trackingNumber}
        </p>
      ) : null}
    </div>
  );
}

function CustomerCell({ order }: { order: DashboardOrder }) {
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap text-sm font-medium" title={order.customerName}>
        {safeDisplay(order.customerName, "Customer")}
      </p>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-muted-foreground" title={order.customerEmail}>
        {safeDisplay(order.customerEmail)}
      </p>
    </div>
  );
}

function LargeStatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className="flex h-7 min-w-[112px] justify-center rounded-md px-3 normal-case tracking-normal"
      variant={statusTone(value)}
    >
      {labelFromStatus(value)}
    </Badge>
  );
}

function AmountCell({ order }: { order: DashboardOrder }) {
  return <span className="whitespace-nowrap text-sm font-semibold">{formatCurrency(order.total, order.currency || "MVR")}</span>;
}

function CostBadge({ order, onClick }: { order: DashboardOrder; onClick: (order: DashboardOrder) => void }) {
  const summary = order.financeSummary;
  if (summary?.missingCostRecord) {
    return (
      <button
        className="flex h-8 min-w-[120px] items-center justify-center rounded-md border border-orange-500/20 bg-orange-500/10 px-3 text-[10px] font-medium text-orange-600 transition hover:bg-orange-500/20 dark:text-orange-400"
        title="Profit cannot be calculated until cost data is entered."
        type="button"
        onClick={() => onClick(order)}
      >
        Cost Required
      </button>
    );
  }
  if (summary?.hasCostRecord) {
    return (
      <Badge className="flex h-8 min-w-[120px] justify-center rounded-md normal-case tracking-normal" variant="success">
        Cost Added
      </Badge>
    );
  }
  return (
    <button
      className="flex h-8 min-w-[120px] items-center justify-center rounded-md border bg-muted px-3 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/70"
      title="Profit cannot be calculated until cost data is entered."
      type="button"
      onClick={() => onClick(order)}
    >
      No Cost Data
    </button>
  );
}

function ProfitCell({ order }: { order: DashboardOrder }) {
  const summary = order.financeSummary;
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

function formatOrderDate(value: string | undefined) {
  return dateParts(value || "");
}

function RowActions({
  order,
  onMore,
  onView,
}: {
  order: DashboardOrder;
  onMore: () => void;
  onView: (order: DashboardOrder) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button size="sm" variant="outline" onClick={() => onView(order)}>
        <Eye className="h-3.5 w-3.5" />
        View
      </Button>
      <Button size="icon" title="More actions" variant="ghost" onClick={onMore}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function OrderCard({
  order,
  onCopy,
  onCost,
  onMore,
  onView,
}: {
  order: DashboardOrder;
  onCopy: (order: DashboardOrder) => void;
  onCost: (order: DashboardOrder) => void;
  onMore: () => void;
  onView: (order: DashboardOrder) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <OrderLabel order={order} onCopy={onCopy} />
        <DateCell value={order.createdAt} />
      </div>
      <div className="mt-4">
        <CustomerCell order={order} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LargeStatusBadge value={order.fulfillmentStatus || order.status} />
        <LargeStatusBadge value={order.financialStatus} />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <AmountCell order={order} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
          <ProfitCell order={order} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <CostBadge order={order} onClick={onCost} />
        <RowActions order={order} onMore={onMore} onView={onView} />
      </div>
    </div>
  );
}

function OrderDetails({ order, onClose }: { order: DashboardOrder; onClose: () => void }) {
  const fields = [
    ["Order", orderPrimary(order)],
    ["Internal order ID", order.id],
    ["Order name", order.orderName],
    ["Order number", order.orderNumber],
    ["Source type", order.sourceType],
    ["Customer", order.customerName],
    ["Email", order.customerEmail],
    ["Status", labelFromStatus(order.status)],
    ["Financial status", labelFromStatus(order.financialStatus)],
    ["Fulfillment", labelFromStatus(order.fulfillmentStatus)],
    ["Total", formatCurrency(order.total, order.currency)],
    ["Items", safeDisplay(order.itemCount)],
    ["Receipt", labelFromStatus(order.receiptStatus)],
    ["Delivery", labelFromStatus(order.deliveryStatus)],
    ["Tracking", order.trackingNumber],
    ["Created", `${dateParts(order.createdAt).date} ${dateParts(order.createdAt).time}`],
    ["Updated", `${dateParts(order.updatedAt).date} ${dateParts(order.updatedAt).time}`],
    ["Linked request", order.linkedRequestId],
    ["Source ID", order.source?.sourceId],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
          <div>
            <h3 className="text-lg font-semibold">{truncateId(orderPrimary(order))}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{safeDisplay(order.customerName, "Shopify order")}</p>
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
              <LinkedCosts order={order} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedCosts({ order }: { order: DashboardOrder }) {
  const records = order.financeSummary?.costRecords ?? [];
  if (records.length === 0) {
    return <span className="text-sm text-muted-foreground">No linked cost records</span>;
  }
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-md border bg-background/60 p-2">
          <p className="font-medium">{safeDisplay(record.referenceLabel, `Cost #${record.id}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Profit {formatCurrency(record.profitBase ?? record.profit, record.profitBase === null ? record.currency : order.financeSummary?.baseCurrency)}
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
  order,
  saving,
  setForm,
  onClose,
  onSubmit,
}: {
  currencies: CurrencyRecord[];
  error: string;
  form: typeof blankCostForm;
  order: DashboardOrder;
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
            <p className="mt-1 text-xs text-muted-foreground">{orderPrimary(order)}</p>
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
