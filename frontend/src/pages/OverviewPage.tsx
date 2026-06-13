import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Coins,
  Database,
  FileText,
  Percent,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

import { Badge, BadgeProps } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  OverviewFinanceTrendPoint,
  OverviewRecentCostRecord,
  OverviewStatsResponse,
  OverviewZappSection,
  fetchOverviewStats,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { cn, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : `${Number(value).toFixed(2)}%`;
}

function numberLabel(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : value.toLocaleString();
}

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "success" || status === "approved" || status === "configured") return "success";
  if (status === "not_configured" || status === "timeout" || status === "degraded") return "warning";
  if (status === "unauthorized" || status === "forbidden" || status === "server_error") return "destructive";
  return "muted";
}

function shortDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await fetchOverviewStats());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const financeCurrency = stats?.finance.currency || "MVR";
  const roleLabel = useMemo(() => {
    if (user?.role === "admin") return "Admin";
    if (user?.role === "manager") return "Manager";
    return "Viewer";
  }, [user?.role]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-orange-700 dark:text-orange-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No overview data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const conversion = stats.zappApi.requestConversion;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
            <Badge variant={user?.role === "admin" ? "default" : user?.role === "manager" ? "success" : "muted"}>
              {roleLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Executive view of finance performance, request conversion, and ZAPP API availability. Last updated {formatDate(stats.generatedAt)}.
          </p>
        </div>
        <Button disabled={loading} variant="outline" onClick={load}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CircleDollarSign} label="Revenue / Sales" value={formatCurrency(stats.finance.totalSaleValue, financeCurrency)} />
        <StatCard icon={Database} label="Costs" value={formatCurrency(stats.finance.totalCostValue, financeCurrency)} />
        <StatCard
          icon={BarChart3}
          label="Profit"
          tone={stats.finance.totalProfit >= 0 ? "success" : "danger"}
          value={formatCurrency(stats.finance.totalProfit, financeCurrency)}
        />
        <StatCard icon={Percent} label="Average Margin" value={formatPercent(stats.finance.averageMarginPercent)} />
        <StatCard
          icon={FileText}
          label="Cost Records"
          meta={`${stats.finance.profitableRecordsCount} profitable · ${stats.finance.lossRecordsCount} losses`}
          value={numberLabel(stats.finance.totalCostRecords)}
        />
        <StatCard
          icon={ShoppingCart}
          label="Requests"
          meta={conversion.countsMayBePartial ? `${conversion.sampleSize} sampled` : "Live request summary"}
          tone={conversion.available ? "success" : "warning"}
          value={numberLabel(conversion.available ? conversion.total : null)}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion Rate"
          meta={`${numberLabel(conversion.approvedPaid)} approved/paid`}
          tone={conversion.conversionRate ? "success" : undefined}
          value={formatPercent(conversion.conversionRate)}
        />
        <StatCard
          icon={AlertCircle}
          label="Cancellation Rate"
          meta={`${numberLabel(conversion.cancelled)} cancelled`}
          tone={conversion.cancelled ? "warning" : undefined}
          value={formatPercent(conversion.cancellationRate)}
        />
        <StatCard icon={Coins} label="Active Currencies" value={numberLabel(stats.configuration.activeCurrenciesCount)} />
        <StatCard icon={Truck} label="Shipping Rates" value={numberLabel(stats.configuration.activeShippingRateCardsCount)} />
        <StatCard
          icon={ShieldCheck}
          label="Linked Records"
          meta={`${stats.finance.linkedOrdersCount} orders · ${stats.finance.linkedRequestsCount} requests`}
          value={numberLabel(stats.finance.linkedOrdersCount + stats.finance.linkedRequestsCount)}
        />
        {stats.permissions.canManageAccess ? (
          <StatCard
            icon={Users}
            label="Pending Users"
            tone={stats.access.pendingUsersCount ? "warning" : undefined}
            value={numberLabel(stats.access.pendingUsersCount)}
          />
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <FinanceSummaryCard currency={financeCurrency} records={stats.recentCostRecords} stats={stats} />
        <ZappStatusCard stats={stats} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RevenueCostsChart currency={financeCurrency} data={stats.financeTrend} />
        <ProfitTrendChart currency={financeCurrency} data={stats.financeTrend} />
        <MarginTrendChart data={stats.financeTrend} />
        <RequestConversionCard conversion={conversion} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <StatusBreakdownCard label="Order Status Breakdown" section={stats.zappApi.orders} />
        <StatusBreakdownCard label="Request Status Breakdown" section={stats.zappApi.requests} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  meta?: string;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-2 truncate text-2xl font-bold",
                tone === "success" && "text-emerald-600 dark:text-emerald-400",
                tone === "warning" && "text-orange-600 dark:text-orange-400",
                tone === "danger" && "text-red-600 dark:text-red-400",
              )}
              title={value}
            >
              {value}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {meta ? <p className="mt-3 truncate text-xs text-muted-foreground">{meta}</p> : null}
      </CardContent>
    </Card>
  );
}

function FinanceSummaryCard({
  stats,
  records,
  currency,
}: {
  stats: OverviewStatsResponse;
  records: OverviewRecentCostRecord[];
  currency: string;
}) {
  const latest = records[0];
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Finance Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-3">
        <SummaryTile label="Total revenue" value={formatCurrency(stats.finance.totalSaleValue, currency)} />
        <SummaryTile label="Total cost" value={formatCurrency(stats.finance.totalCostValue, currency)} />
        <SummaryTile label="Total profit" value={formatCurrency(stats.finance.totalProfit, currency)} tone={stats.finance.totalProfit >= 0 ? "success" : "danger"} />
        <SummaryTile label="Linked orders" value={numberLabel(stats.finance.linkedOrdersCount)} />
        <SummaryTile label="Linked requests" value={numberLabel(stats.finance.linkedRequestsCount)} />
        <SummaryTile label="Last cost update" value={latest ? formatDate(latest.updatedAt) : "--"} />
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 truncate text-sm font-semibold", tone === "success" && "text-emerald-600 dark:text-emerald-400", tone === "danger" && "text-red-600 dark:text-red-400")}>
        {value}
      </p>
    </div>
  );
}

function ZappStatusCard({ stats }: { stats: OverviewStatsResponse }) {
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>ZAPP API Status</CardTitle>
          </div>
          <Badge variant={statusVariant(stats.zappApi.status)}>{stats.zappApi.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-sm font-medium">{stats.zappApi.configured ? "Configured" : "Not configured"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{stats.zappApi.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Finance totals are local. Live request/order summaries are shown only when the read-only ZAPP API is reachable.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Checked {formatDate(stats.zappApi.checkedAt)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ZappMiniStatus label="Orders" section={stats.zappApi.orders} />
          <ZappMiniStatus label="Requests" section={stats.zappApi.requests} />
          <ZappMiniStatus label="Email Logs" section={stats.zappApi.emailLogs} />
        </div>
        <div className="flex justify-end">
          {stats.permissions.canViewDiagnostics ? (
            <Button asChild variant="outline">
              <Link to="/diagnostics">
                Diagnostics
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Badge variant="muted">Diagnostics admin only</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ZappMiniStatus<T>({ label, section }: { label: string; section: OverviewZappSection<T> }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium">{label}</p>
        <Badge className="shrink-0" variant={statusVariant(section.status)}>{section.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-2 text-2xl font-bold">{numberLabel(section.total)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        HTTP {safeDisplay(section.upstreamStatus)} · {safeDisplay(section.elapsedMs)} ms
      </p>
    </div>
  );
}

function RevenueCostsChart({ data, currency }: { data: OverviewFinanceTrendPoint[]; currency: string }) {
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Revenue vs Costs</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {data.length === 0 ? <ChartEmpty label="No finance records yet" /> : <BarChart data={data} currency={currency} />}
      </CardContent>
    </Card>
  );
}

function ProfitTrendChart({ data, currency }: { data: OverviewFinanceTrendPoint[]; currency: string }) {
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Profit Trend</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {data.length < 2 ? <ChartEmpty label="Need at least two finance dates" /> : <LineChart data={data} valueKey="profit" currency={currency} tone="profit" />}
      </CardContent>
    </Card>
  );
}

function MarginTrendChart({ data }: { data: OverviewFinanceTrendPoint[] }) {
  const marginData = data.filter((point) => point.marginPercent !== null);
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Margin Trend</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {marginData.length < 2 ? <ChartEmpty label="Need at least two margin points" /> : <LineChart data={marginData} valueKey="marginPercent" tone="margin" />}
      </CardContent>
    </Card>
  );
}

function RequestConversionCard({ conversion }: { conversion: OverviewStatsResponse["zappApi"]["requestConversion"] }) {
  const values = [
    { label: "Quoted", value: conversion.quoted, color: "bg-sky-500" },
    { label: "Approved/Paid", value: conversion.approvedPaid, color: "bg-emerald-500" },
    { label: "Pending", value: conversion.pending, color: "bg-amber-500" },
    { label: "Cancelled", value: conversion.cancelled, color: "bg-red-500" },
  ];
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Request Conversion</CardTitle>
          <Badge variant={conversion.available ? "success" : "warning"}>{conversion.available ? "Live" : "Unavailable"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {!conversion.available ? (
          <ChartEmpty label="ZAPP request data is unavailable" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile label="Total requests" value={numberLabel(conversion.total)} />
              <SummaryTile label="Conversion" value={formatPercent(conversion.conversionRate)} tone={conversion.conversionRate ? "success" : undefined} />
              <SummaryTile label="Cancellation" value={formatPercent(conversion.cancellationRate)} tone={conversion.cancelled ? "danger" : undefined} />
              <SummaryTile label="Sample size" value={numberLabel(conversion.sampleSize)} />
            </div>
            <SegmentBar total={Math.max(conversion.sampleSize, 1)} values={values} />
            {conversion.countsMayBePartial ? (
              <p className="text-xs text-muted-foreground">Conversion counts are based on the fetched live sample.</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBreakdownCard<T>({ label, section }: { label: string; section: OverviewZappSection<T> }) {
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{label}</CardTitle>
          <Badge variant={section.available ? "success" : "warning"}>{section.available ? "Live" : "Unavailable"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!section.available || Object.keys(section.statusCounts).length === 0 ? (
          <ChartEmpty label="No status data available" />
        ) : (
          <StatusBars counts={section.statusCounts} total={section.sampleSize || section.total || 0} />
        )}
      </CardContent>
    </Card>
  );
}

function BarChart({ data, currency }: { data: OverviewFinanceTrendPoint[]; currency: string }) {
  const width = 640;
  const height = 230;
  const padding = 28;
  const max = Math.max(...data.flatMap((point) => [point.revenue, point.costs]), 1);
  const band = (width - padding * 2) / data.length;
  const barWidth = Math.max(5, Math.min(16, band / 3));

  return (
    <div className="space-y-3">
      <svg className="h-64 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img">
        <line className="text-border" stroke="currentColor" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        {data.map((point, index) => {
          const x = padding + index * band + band / 2;
          const revenueHeight = (point.revenue / max) * (height - padding * 2);
          const costHeight = (point.costs / max) * (height - padding * 2);
          return (
            <g key={point.date}>
              <rect className="fill-emerald-500/80" height={revenueHeight} rx="3" width={barWidth} x={x - barWidth - 2} y={height - padding - revenueHeight} />
              <rect className="fill-sky-500/80" height={costHeight} rx="3" width={barWidth} x={x + 2} y={height - padding - costHeight} />
              {index === 0 || index === data.length - 1 ? (
                <text className="fill-muted-foreground text-[10px]" textAnchor="middle" x={x} y={height - 6}>
                  {shortDate(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />Revenue</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500" />Costs</span>
        <span>Peak {formatCurrency(max, currency)}</span>
      </div>
    </div>
  );
}

function LineChart({
  data,
  valueKey,
  currency,
  tone,
}: {
  data: OverviewFinanceTrendPoint[];
  valueKey: "profit" | "marginPercent";
  currency?: string;
  tone: "profit" | "margin";
}) {
  const width = 640;
  const height = 230;
  const padding = 28;
  const values = data.map((point) => Number(point[valueKey] || 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const xFor = (index: number) => padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
  const yFor = (value: number) => height - padding - ((value - min) / range) * (height - padding * 2);
  const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  const latest = values[values.length - 1];

  return (
    <div className="space-y-3">
      <svg className="h-64 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img">
        <line className="text-border" stroke="currentColor" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <polyline
          className={tone === "profit" ? "text-emerald-500" : "text-primary"}
          fill="none"
          points={points}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {values.map((value, index) => (
          <circle key={`${data[index].date}-${value}`} className={tone === "profit" ? "fill-emerald-500" : "fill-primary"} cx={xFor(index)} cy={yFor(value)} r="3.5" />
        ))}
        <text className="fill-muted-foreground text-[10px]" textAnchor="start" x={padding} y={height - 6}>
          {shortDate(data[0].date)}
        </text>
        <text className="fill-muted-foreground text-[10px]" textAnchor="end" x={width - padding} y={height - 6}>
          {shortDate(data[data.length - 1].date)}
        </text>
      </svg>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Range {valueKey === "marginPercent" ? `${min.toFixed(1)}% to ${max.toFixed(1)}%` : `${formatCurrency(min, currency)} to ${formatCurrency(max, currency)}`}</span>
        <span className="font-medium text-foreground">Latest {valueKey === "marginPercent" ? `${latest.toFixed(2)}%` : formatCurrency(latest, currency)}</span>
      </div>
    </div>
  );
}

function SegmentBar({ values, total }: { values: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {values.map((item) => (
          <div key={item.label} className={item.color} style={{ width: `${Math.max(0, (item.value / total) * 100)}%` }} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", item.color)} />
              {item.label}
            </span>
            <span className="font-medium">{numberLabel(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBars({ counts, total }: { counts: Record<string, number>; total: number }) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => (
        <div key={status} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="capitalize text-muted-foreground">{status.replace(/_/g, " ")}</span>
            <span className="font-medium">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Sample total {numberLabel(total)}</p>
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-md border bg-muted/20 p-6 text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{label}</p>
      <p className="max-w-sm text-xs text-muted-foreground">Charts appear automatically when enough dashboard data is available.</p>
    </div>
  );
}
