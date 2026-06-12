import { Navigate } from "react-router-dom";
import { Clock3, LogOut, RefreshCcw } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../lib/auth-context";

export function PendingApprovalPage() {
  const { user, loading, logout, refreshUser } = useAuth();

  if (!loading && !user) {
    return <Navigate replace to="/login" />;
  }

  if (!loading && user?.status === "approved") {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4 border-b p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Approval Pending</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              An admin needs to approve this dashboard account.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-sm font-medium">{user?.name || "Pending user"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="warning">{user?.status || "pending"}</Badge>
              <Badge variant="muted">{user?.role || "viewer"}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={refreshUser}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
