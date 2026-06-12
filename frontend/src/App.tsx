import { Lock, Settings, ShieldCheck } from "lucide-react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { Card, CardContent } from "./components/ui/card";
import { UserRole } from "./lib/api";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { ToastProvider } from "./lib/toast-context";
import { AccessManagementPage } from "./pages/AccessManagementPage";
import { CalculatorPage } from "./pages/CalculatorPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { EmailLogsPage } from "./pages/EmailLogsPage";
import { CostsPage, CurrenciesPage, ShippingRatesPage } from "./pages/FinancePages";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PendingApprovalPage } from "./pages/PendingApprovalPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RequestsPage } from "./pages/RequestsPage";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-5">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

function AccessDeniedPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-xl items-center justify-center">
      <Card className="w-full">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Access Restricted</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your current role cannot open this dashboard area.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RequireAuth({
  requireApproved = true,
  roles,
}: {
  requireApproved?: boolean;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (requireApproved && user.status !== "approved") {
    return <Navigate replace to="/pending" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth requireApproved={false} />}>
        <Route path="/pending" element={<PendingApprovalPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="calculator" element={<CalculatorPage />} />

          <Route element={<RequireAuth roles={["admin", "manager"]} />}>
            <Route path="costs" element={<CostsPage />} />
            <Route path="currencies" element={<CurrenciesPage />} />
            <Route path="shipping-rates" element={<ShippingRatesPage />} />
          </Route>

          <Route element={<RequireAuth roles={["admin"]} />}>
            <Route
              path="settings"
              element={
                <PlaceholderPage
                  accent="purple"
                  icon={Settings}
                  subtitle="Environment-backed dashboard settings shell."
                  title="Settings"
                />
              }
            />
            <Route path="access-management" element={<AccessManagementPage />} />
            <Route path="diagnostics" element={<DiagnosticsPage />} />
            <Route path="email-logs" element={<EmailLogsPage />} />
          </Route>

          <Route
            path="*"
            element={
              <PlaceholderPage
                accent="orange"
                icon={ShieldCheck}
                subtitle="That dashboard page does not exist."
                title="Not Found"
              />
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
