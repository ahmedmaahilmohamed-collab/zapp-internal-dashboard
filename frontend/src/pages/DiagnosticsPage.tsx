import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileWarning,
  RefreshCcw,
  ShieldAlert,
  ShieldX,
  ServerCrash,
  WifiOff,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  DiagnosticStatus,
  ZappDiagnosticsResponse,
  ZappEndpointDiagnostic,
  fetchZappDiagnostics,
} from "../lib/api";
import { cn } from "../lib/utils";

const statusCopy: Record<
  DiagnosticStatus,
  {
    label: string;
    badge: "success" | "warning" | "destructive" | "muted";
    icon: typeof CheckCircle2;
    tone: string;
  }
> = {
  success: {
    label: "Success",
    badge: "success",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  unauthorized: {
    label: "Unauthorized",
    badge: "destructive",
    icon: ShieldX,
    tone: "text-red-600 dark:text-red-400",
  },
  forbidden: {
    label: "Forbidden",
    badge: "destructive",
    icon: ShieldAlert,
    tone: "text-red-600 dark:text-red-400",
  },
  not_found: {
    label: "Not found",
    badge: "warning",
    icon: FileWarning,
    tone: "text-orange-600 dark:text-orange-400",
  },
  timeout: {
    label: "Timeout",
    badge: "warning",
    icon: Clock3,
    tone: "text-orange-600 dark:text-orange-400",
  },
  server_error: {
    label: "Server error",
    badge: "destructive",
    icon: ServerCrash,
    tone: "text-red-600 dark:text-red-400",
  },
  invalid_response: {
    label: "Invalid response",
    badge: "warning",
    icon: AlertCircle,
    tone: "text-orange-600 dark:text-orange-400",
  },
  unknown_error: {
    label: "Unknown error",
    badge: "muted",
    icon: WifiOff,
    tone: "text-muted-foreground",
  },
};

function formatCheckedAt(value?: string) {
  if (!value) {
    return "Not checked";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function EndpointCard({ endpoint }: { endpoint: ZappEndpointDiagnostic }) {
  const status = statusCopy[endpoint.status] ?? statusCopy.unknown_error;
  const Icon = status.icon;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted", status.tone)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate">{endpoint.label}</CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{endpoint.path}</p>
            </div>
          </div>
          <Badge variant={status.badge}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">HTTP</p>
            <p className="mt-1 text-lg font-bold">{endpoint.upstreamStatus ?? "--"}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</p>
            <p className="mt-1 text-lg font-bold">
              {endpoint.elapsedMs === null ? "--" : `${endpoint.elapsedMs}ms`}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Items</p>
            <p className="mt-1 text-lg font-bold">{endpoint.itemCount ?? "--"}</p>
          </div>
        </div>

        <div className="min-h-12 rounded-md border bg-background p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Response keys</p>
          <p className="mt-2 break-words text-xs text-foreground">
            {endpoint.responseKeys.length > 0 ? endpoint.responseKeys.join(", ") : "None reported"}
          </p>
        </div>

        {endpoint.message ? (
          <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-3 text-xs text-orange-700 dark:text-orange-300">
            {endpoint.message}
          </div>
        ) : null}
      </CardContent>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-px bg-gradient-to-r",
          endpoint.status === "success"
            ? "from-emerald-500/70 to-emerald-500/10"
            : "from-orange-500/70 to-red-500/20",
        )}
      />
    </Card>
  );
}

export function DiagnosticsPage() {
  const [data, setData] = useState<ZappDiagnosticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextData = await fetchZappDiagnostics();
      setData(nextData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load diagnostics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  const summary = useMemo(() => {
    const results = data?.results ?? [];
    const successCount = results.filter((result) => result.status === "success").length;
    return {
      successCount,
      total: results.length,
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Diagnostics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ZAPP API endpoint checks from the backend proxy.
          </p>
        </div>
        <Button disabled={loading} onClick={loadDiagnostics}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.configured ? "Yes" : "No"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Backend environment only</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Healthy endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.successCount}/{summary.total || 3}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Orders, requests, email logs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Last checked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{formatCheckedAt(data?.checkedAt)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Local browser time</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <CardHeader>
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-16 animate-pulse rounded-md bg-muted" />
                <div className="h-12 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(data?.results ?? []).map((endpoint) => (
            <EndpointCard key={endpoint.path} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  );
}
