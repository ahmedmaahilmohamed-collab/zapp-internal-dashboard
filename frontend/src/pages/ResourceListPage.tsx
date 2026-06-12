import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Database, RefreshCcw, Search, Wifi, X } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ApiClientError, DashboardCollectionResponse } from "../lib/api";
import { cn, formatDate, safeDisplay } from "../lib/utils";

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface DetailField<T> {
  label: string;
  render: (item: T) => ReactNode;
}

interface ResourceListPageProps<T extends { id: string; source?: { availableFields?: string[] } }> {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  defaultStatus?: string;
  statusOptions: string[];
  fetcher: (query: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<DashboardCollectionResponse<T>>;
  columns: Column<T>[];
  mobileTitle: (item: T) => string;
  mobileSubtitle: (item: T) => string;
  mobileMeta: (item: T) => ReactNode;
  detailTitle: (item: T) => string;
  detailFields: DetailField<T>[];
}

const PAGE_SIZE = 20;

export function ResourceListPage<T extends { id: string; source?: { availableFields?: string[] } }>({
  title,
  subtitle,
  searchPlaceholder,
  defaultStatus = "",
  statusOptions,
  fetcher,
  columns,
  mobileTitle,
  mobileSubtitle,
  mobileMeta,
  detailTitle,
  detailFields,
}: ResourceListPageProps<T>) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(defaultStatus);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DashboardCollectionResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [selected, setSelected] = useState<T | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextData = await fetcher({
        search,
        status,
        dateFrom,
        dateTo,
        page,
        pageSize: PAGE_SIZE,
      });
      setData(nextData);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Unable to load records."));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, fetcher, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = data?.pageCount ?? 1;
  const liveConnected =
    typeof data?.source?.upstreamStatus === "number" &&
    data.source.upstreamStatus >= 200 &&
    data.source.upstreamStatus < 300;
  const showing = useMemo(() => {
    if (!data) {
      return "No records loaded";
    }

    if (data.total === 0) {
      return "0 records";
    }

    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.total, data.page * data.pageSize);
    return `${start}-${end} of ${data.total}`;
  }, [data]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus(defaultStatus);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={liveConnected ? "success" : error ? "destructive" : "muted"}>
            {liveConnected ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <Wifi className="mr-1 h-3 w-3" />
            )}
            {liveConnected ? "Live API connected" : "Awaiting live data"}
          </Badge>
          <Button disabled={loading} onClick={load}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                placeholder={searchPlaceholder}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applySearch();
                  }
                }}
              />
            </label>

            <select
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label className="relative block">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPage(1);
                  setDateFrom(event.target.value);
                }}
              />
            </label>

            <label className="relative block">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPage(1);
                  setDateTo(event.target.value);
                }}
              />
            </label>

            <div className="flex gap-2">
              <Button className="flex-1 lg:flex-none" onClick={applySearch}>
                Search
              </Button>
              <Button aria-label="Reset filters" size="icon" variant="outline" onClick={resetFilters}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{showing}</span>
            <span>
              Source: {data?.source?.path ?? "ZAPP API"} · HTTP {data?.source?.upstreamStatus ?? "--"} ·{" "}
              {safeDisplay(data?.source?.elapsedMs)} ms
            </span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-orange-700 dark:text-orange-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{error.message}</p>
                {"errorType" in error && error.errorType ? (
                  <p className="mt-1 text-xs">Classification: {error.errorType}</p>
                ) : null}
              </div>
            </div>
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced {formatDate(data?.fetchedAt)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={liveConnected ? "success" : error ? "warning" : "muted"}>
              {liveConnected ? "Live" : loading ? "Loading" : "Offline"}
            </Badge>
            <Badge variant={error ? "warning" : "muted"}>{loading ? "Loading" : showing}</Badge>
          </div>
        </CardHeader>

        {loading && !data ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </CardContent>
        ) : data?.items.length === 0 && !error ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No records found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust filters or refresh after the ZAPP API has matching data.
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                          column.className,
                        )}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="w-24 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.items ?? []).map((item) => (
                    <tr key={item.id || JSON.stringify(item.source)} className="hover:bg-muted/30">
                      {columns.map((column) => (
                        <td key={column.key} className={cn("px-4 py-3 text-xs", column.className)}>
                          {column.render(item)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(item)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {(data?.items ?? []).map((item) => (
                <button
                  key={item.id || JSON.stringify(item.source)}
                  className="rounded-md border bg-background p-4 text-left transition hover:bg-muted/30"
                  onClick={() => setSelected(item)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{mobileTitle(item)}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {mobileSubtitle(item)}
                      </p>
                    </div>
                    {mobileMeta(item)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          disabled={loading || page <= 1}
          variant="outline"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          disabled={loading || page >= pageCount}
          variant="outline"
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
              <div>
                <h3 className="text-lg font-semibold">{detailTitle(selected)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.source?.availableFields?.length ?? 0} upstream fields detected
                </p>
              </div>
              <Button aria-label="Close details" size="icon" variant="ghost" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {detailFields.map((field) => (
                <div key={field.label} className="rounded-md border bg-muted/20 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </p>
                  <div className="mt-2 break-words text-sm">{field.render(selected)}</div>
                </div>
              ))}
              <div className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Upstream fields
                </p>
                <p className="mt-2 break-words text-xs text-muted-foreground">
                  {selected.source?.availableFields?.join(", ") || "None reported"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase();
  const variant =
    normalized.includes("paid") ||
    normalized.includes("approved") ||
    normalized.includes("fulfilled") ||
    normalized.includes("success")
      ? "success"
      : normalized.includes("pending") ||
          normalized.includes("awaiting") ||
          normalized.includes("open")
        ? "warning"
        : normalized.includes("cancel") ||
            normalized.includes("reject") ||
            normalized.includes("fail")
          ? "destructive"
          : "muted";

  return <Badge variant={variant}>{safeDisplay(value, "Unknown")}</Badge>;
}
