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
  MailCheck,
  Percent,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import { Badge, BadgeProps } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  DashboardOrder,
  DashboardEmailLog,
  DashboardRequest,
  OverviewRecentCostRecord,
  OverviewStatsResponse,
  OverviewZappSection,
  fetchOverviewStats,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { cn, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

function formatPercent(value: number | null) {
  return value === null ? "--" : `${Number(value).toFixed(2)}%`;
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
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
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
            Local finance, configuration, and ZAPP API availability.
          </p>
        </div>
        <Button disabled={loading} variant="outline" onClick={load}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CircleDollarSign}
          label="Revenue / Sales"
          value={formatCurrency(stats.finance.totalSaleValue, financeCurrency)}
        />
        <StatCard
          icon={Database}
          label="Costs"
          value={formatCurrency(stats.finance.totalCostValue, financeCurrency)}
        />
        <StatCard
          icon={BarChart3}
          label="Profit"
          tone={stats.finance.totalProfit >= 0 ? "success" : "danger"}
          value={formatCurrency(stats.finance.totalProfit, financeCurrency)}
        />
        <StatCard
          icon={Percent}
          label="Average Margin"
          value={formatPercent(stats.finance.averageMarginPercent)}
        />
        <StatCard
          icon={FileText}
          label="Cost Records"
          meta={`${stats.finance.profitableRecordsCount} profitable · ${stats.finance.lossRecordsCount} losses`}
          value={numberLabel(stats.finance.totalCostRecords)}
        />
        <StatCard
          icon={Coins}
          label="Active Currencies"
          value={numberLabel(stats.configuration.activeCurrenciesCount)}
        />
        <StatCard
          icon={Truck}
          label="Shipping Rates"
          value={numberLabel(stats.configuration.activeShippingRateCardsCount)}
        />
        <StatCard
          icon={ShoppingCart}
          label="Live Orders"
          meta={stats.zappApi.orders.available ? "Live API connected" : stats.zappApi.orders.status}
          tone={stats.zappApi.orders.available ? "success" : "warning"}
          value={numberLabel(stats.zappApi.orders.total)}
        />
        <StatCard
          icon={FileText}
          label="Live Requests"
          meta={stats.zappApi.requests.available ? "Live API connected" : stats.zappApi.requests.status}
          tone={stats.zappApi.requests.available ? "success" : "warning"}
          value={numberLabel(stats.zappApi.requests.total)}
        />
        <StatCard
          icon={MailCheck}
          label="Email Logs"
          meta={stats.zappApi.emailLogs.available ? "Live API connected" : stats.zappApi.emailLogs.status}
          tone={stats.zappApi.emailLogs.available ? "success" : "warning"}
          value={numberLabel(stats.zappApi.emailLogs.total)}
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

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <ZappStatusCard stats={stats} />
        <RecentCosts records={stats.recentCostRecords} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecentOrders section={stats.zappApi.orders} />
        <RecentRequests section={stats.zappApi.requests} />
      </div>

      {stats.permissions.canViewDiagnostics ? (
        <RecentEmailLogs section={stats.zappApi.emailLogs} />
      ) : null}
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
          <p className="text-sm font-medium">
            {stats.zappApi.configured ? "Configured" : "Not configured"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{stats.zappApi.message}</p>
          <p className="mt-3 text-xs text-muted-foreground">Checked {formatDate(stats.zappApi.checkedAt)}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
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

function ZappMiniStatus<T>({
  label,
  section,
}: {
  label: string;
  section: OverviewZappSection<T>;
}) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start 2xl:flex-row 2xl:items-center">
        <p className="text-sm font-medium">{label}</p>
        <Badge variant={statusVariant(section.status)}>{section.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-2 text-2xl font-bold">{numberLabel(section.total)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        HTTP {safeDisplay(section.upstreamStatus)} · {safeDisplay(section.elapsedMs)} ms
      </p>
    </div>
  );
}

function RecentCosts({ records }: { records: OverviewRecentCostRecord[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b p-4">
        <CardTitle>Recent Cost Records</CardTitle>
      </CardHeader>
      {records.length === 0 ? (
        <EmptyPanel icon={Database} label="No cost records yet" />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Sale</th>
                  <th className="px-4 py-3">Profit</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {safeDisplay(record.referenceLabel || record.linkedOrderId || record.linkedRequestId, `Cost #${record.id}`)}
                      <p className="mt-1 text-muted-foreground">{formatPercent(record.marginPercent)}</p>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(record.saleTotal, record.currency)}</td>
                    <td
                      className={cn(
                        "px-4 py-3 font-semibold",
                        record.profit > 0 && "text-emerald-600 dark:text-emerald-400",
                        record.profit < 0 && "text-red-600 dark:text-red-400",
                      )}
                    >
                      {formatCurrency(record.profit, record.currency)}
                    </td>
                    <td className="px-4 py-3">{formatDate(record.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {records.map((record) => (
              <div key={record.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {safeDisplay(record.referenceLabel || record.linkedOrderId || record.linkedRequestId, `Cost #${record.id}`)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.updatedAt)}</p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-semibold",
                      record.profit > 0 && "text-emerald-600 dark:text-emerald-400",
                      record.profit < 0 && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {formatCurrency(record.profit, record.currency)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Sale {formatCurrency(record.saleTotal, record.currency)} · Margin {formatPercent(record.marginPercent)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RecentOrders({ section }: { section: OverviewZappSection<DashboardOrder> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Recent Orders</CardTitle>
          <Badge variant={statusVariant(section.status)}>{section.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      {!section.available ? (
        <UnavailablePanel message={section.message} />
      ) : section.recent.length === 0 ? (
        <EmptyPanel icon={ShoppingCart} label="No recent orders" />
      ) : (
        <div className="divide-y">
          {section.recent.slice(0, 5).map((order) => (
            <div key={order.id || order.orderName} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{safeDisplay(order.id, "Order")}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {safeDisplay(order.orderName || order.orderNumber || order.customerName || order.customerEmail)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">{formatCurrency(order.total, order.currency || "USD")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentRequests({ section }: { section: OverviewZappSection<DashboardRequest> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Recent Requests</CardTitle>
          <Badge variant={statusVariant(section.status)}>{section.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      {!section.available ? (
        <UnavailablePanel message={section.message} />
      ) : section.recent.length === 0 ? (
        <EmptyPanel icon={FileText} label="No recent requests" />
      ) : (
        <div className="divide-y">
          {section.recent.slice(0, 5).map((request) => (
            <div key={request.id || request.requestNumber} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">
                  {safeDisplay(request.id, "Request")}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {safeDisplay(request.requestNumber || request.reference || request.customerName || request.customerEmail)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">{formatCurrency(request.quotedTotal, request.currency || "MVR")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentEmailLogs({ section }: { section: OverviewZappSection<DashboardEmailLog> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Recent Email Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(section.status)}>{section.status.replace(/_/g, " ")}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/email-logs">
                Open
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      {!section.available ? (
        <UnavailablePanel message={section.message} />
      ) : section.recent.length === 0 ? (
        <EmptyPanel icon={MailCheck} label="No recent email logs" />
      ) : (
        <div className="divide-y">
          {section.recent.slice(0, 6).map((log) => (
            <div key={log.id || log.subject} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {safeDisplay(log.subject || log.messageType, "Email")}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {safeDisplay(log.toEmail)} · {safeDisplay(log.provider)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant={statusVariant(log.status)}>{safeDisplay(log.status, "unknown")}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: typeof Database; label: string }) {
  return (
    <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </CardContent>
  );
}

function UnavailablePanel({ message }: { message: string | null }) {
  return (
    <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">Unavailable</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {message || "ZAPP API data is not available."}
        </p>
      </div>
    </CardContent>
  );
}
