import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Download, RefreshCcw, Trophy } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { FinanceReportResponse, ReportLeaderboardRecord, fetchFinanceReport } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { cn, downloadCsv, formatCurrency, formatDate, safeDisplay } from "../lib/utils";

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : `${Number(value).toFixed(2)}%`;
}

export function ReportsPage() {
  const { notify } = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<FinanceReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await fetchFinanceReport({ dateFrom, dateTo }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load finance report.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportRows = useMemo(() => report?.monthlyPnL ?? [], [report?.monthlyPnL]);

  function exportReport() {
    const exported = downloadCsv("finance-report-monthly-pnl.csv", exportRows);
    notify(exported ? "Report CSV exported." : "No report rows to export.", exported ? "success" : "info");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Base-currency finance reporting, category costs, and profitability leaderboards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!report?.monthlyPnL.length} variant="outline" onClick={exportReport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button disabled={loading} variant="outline" onClick={load}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[180px_180px_auto]">
          <label className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date from</span>
            <input className={inputClass} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date to</span>
            <input className={inputClass} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="flex items-end">
            <Button onClick={load}>Apply</Button>
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

      {loading && !report ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Revenue" value={formatCurrency(report.summary.revenue, report.baseCurrency)} />
            <Stat label="Costs" value={formatCurrency(report.summary.costs, report.baseCurrency)} />
            <Stat label="Profit" value={formatCurrency(report.summary.profit, report.baseCurrency)} tone={report.summary.profit >= 0 ? "success" : "danger"} />
            <Stat label="Margin" value={formatPercent(report.summary.marginPercent)} />
            <Stat label="Records" value={String(report.summary.recordCount)} meta={`${report.convertedRecordCount} converted`} />
            <Stat label="Excluded" value={String(report.excludedRecordCount)} tone={report.excludedRecordCount ? "warning" : undefined} />
            <Stat label="Base currency" value={report.baseCurrency} />
            <Stat label="Generated" value={formatDate(report.generatedAt)} />
          </div>

          {report.conversionWarnings.length ? (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader className="border-b p-4">
                <CardTitle>Conversion Warnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {report.conversionWarnings.map((warning) => (
                  <div key={warning.message} className="rounded-md border bg-background/60 p-3 text-sm">
                    <p className="font-medium">{warning.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{warning.recordCount} record(s) affected</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <MonthlyPnLChart report={report} />
            <CategoryBreakdown report={report} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Leaderboard title="Best Profit" records={report.leaderboards.bestProfit} currency={report.baseCurrency} />
            <Leaderboard title="Worst Profit" records={report.leaderboards.worstProfit} currency={report.baseCurrency} />
            <Leaderboard title="Best Margin" records={report.leaderboards.bestMargin} currency={report.baseCurrency} />
            <Leaderboard title="Worst Margin" records={report.leaderboards.worstMargin} currency={report.baseCurrency} />
          </div>

          <Card>
            <CardHeader className="border-b p-4">
              <CardTitle>Expected vs Actual Profit</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {report.expectedVsActual.message}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, meta, tone }: { label: string; value: string; meta?: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 truncate text-2xl font-bold",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "text-orange-600 dark:text-orange-400",
            tone === "danger" && "text-red-600 dark:text-red-400",
          )}
        >
          {value}
        </p>
        {meta ? <p className="mt-2 text-xs text-muted-foreground">{meta}</p> : null}
      </CardContent>
    </Card>
  );
}

function MonthlyPnLChart({ report }: { report: FinanceReportResponse }) {
  const data = report.monthlyPnL;
  const max = Math.max(...data.flatMap((item) => [item.revenue, item.costs, Math.abs(item.profit)]), 1);
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Monthly P&amp;L</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {data.length === 0 ? (
          <EmptyChart label="No monthly finance rows yet" />
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.month} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{item.month}</span>
                  <span className={item.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {formatCurrency(item.profit, report.baseCurrency)}
                  </span>
                </div>
                <div className="grid gap-1">
                  <Bar label="Revenue" value={item.revenue} max={max} color="bg-emerald-500" currency={report.baseCurrency} />
                  <Bar label="Costs" value={item.costs} max={max} color="bg-sky-500" currency={report.baseCurrency} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({ report }: { report: FinanceReportResponse }) {
  const max = Math.max(...report.categoryBreakdown.map((item) => item.amount), 1);
  return (
    <Card>
      <CardHeader className="border-b p-4">
        <CardTitle>Expense Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {report.categoryBreakdown.map((item) => (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{formatCurrency(item.amount, report.baseCurrency)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (item.amount / max) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{formatPercent(item.percentOfTotalCost)} of total cost</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Leaderboard({ title, records, currency }: { title: string; records: ReportLeaderboardRecord[]; currency: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
        <CardTitle>{title}</CardTitle>
        <Trophy className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-4">
        {records.length === 0 ? (
          <EmptyChart label="No matching records" />
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div key={`${title}-${record.id}`} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{safeDisplay(record.referenceLabel || record.sourceId, `Cost #${record.id}`)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{safeDisplay(record.customerName || record.title)}</p>
                  </div>
                  <Badge variant={record.profitBase >= 0 ? "success" : "destructive"}>
                    {formatCurrency(record.profitBase, currency)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Margin {formatPercent(record.marginPercent)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, max, color, currency }: { label: string; value: number; max: number; color: string; currency: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
      </div>
      <span className="text-right font-medium">{formatCurrency(value, currency)}</span>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border bg-muted/20 p-4 text-center">
      <BarChart3 className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
