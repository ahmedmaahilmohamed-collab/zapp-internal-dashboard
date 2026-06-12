import { LucideIcon } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "blue" | "green" | "orange" | "purple" | "pink";
}

const accentClass = {
  blue: "from-primary/70 to-primary/10",
  green: "from-emerald-500/70 to-emerald-500/10",
  orange: "from-orange-500/70 to-orange-500/10",
  purple: "from-purple-500/70 to-purple-500/10",
  pink: "from-pink-500/70 to-pink-500/10",
};

export function PlaceholderPage({ title, subtitle, icon: Icon, accent }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="muted">Foundation</Badge>
      </div>

      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Phase 1 shell ready</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">State</p>
              <p className="mt-2 text-lg font-bold">Prepared</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</p>
              <p className="mt-2 text-lg font-bold">Backend API</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Access</p>
              <p className="mt-2 text-lg font-bold">Auth-ready</p>
            </div>
          </div>
        </CardContent>
        <div className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r ${accentClass[accent]}`} />
      </Card>
    </div>
  );
}
