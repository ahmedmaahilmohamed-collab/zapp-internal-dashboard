import { ReactNode } from "react";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { cn } from "../lib/utils";

export function BulkActionBar({
  children,
  className,
  count,
  onClear,
  title,
}: {
  children: ReactNode;
  className?: string;
  count: number;
  onClear: () => void;
  title?: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{title ?? `${count} selected`}</p>
          <p className="mt-1 text-xs text-muted-foreground">Bulk actions apply only to visible selected rows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {children}
          <Button variant="outline" onClick={onClear}>
            Clear selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DeveloperDetails({
  fields,
}: {
  fields: Array<[string, ReactNode]>;
}) {
  return (
    <details className="rounded-md border bg-muted/20 p-3 sm:col-span-2">
      <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Developer details
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-background/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="mt-2 break-words text-xs">{value || "--"}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
