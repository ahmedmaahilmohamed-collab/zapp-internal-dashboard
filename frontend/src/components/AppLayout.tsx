import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Coins,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  X,
} from "lucide-react";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { DashboardNotification, UserRole, fetchNotifications } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { cn } from "../lib/utils";

const navItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard, roles: ["admin", "manager", "viewer"] },
  { title: "Orders", href: "/orders", icon: ShoppingCart, roles: ["admin", "manager", "viewer"] },
  { title: "Requests", href: "/requests", icon: FileText, roles: ["admin", "manager", "viewer"] },
  { title: "Costs", href: "/costs", icon: CircleDollarSign, roles: ["admin", "manager"] },
  { title: "Listed Product Pricing", href: "/listed-product-pricing", icon: HandCoins, roles: ["admin", "manager"] },
  { title: "Cost Templates", href: "/cost-templates", icon: ClipboardList, roles: ["admin", "manager"] },
  { title: "Reports", href: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "Currencies", href: "/currencies", icon: Coins, roles: ["admin", "manager"] },
  { title: "Shipping Rates", href: "/shipping-rates", icon: Truck, roles: ["admin", "manager"] },
  { title: "Calculator", href: "/calculator", icon: Calculator, roles: ["admin", "manager", "viewer"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  { title: "Access Management", href: "/access-management", icon: ShieldCheck, roles: ["admin"] },
  { title: "Email Logs", href: "/email-logs", icon: MailCheck, roles: ["admin"] },
  { title: "Diagnostics", href: "/diagnostics", icon: BarChart3, roles: ["admin"] },
];

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };
}

function initials(name: string | undefined, email: string | undefined) {
  const source = (name || email || "ZA").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const visibleNavItems = useMemo(() => {
    const role = user?.role as UserRole | undefined;
    return navItems.filter((item) => role && item.roles.includes(role));
  }, [user?.role]);

  const pageTitle = useMemo(() => {
    const item = navItems.find((navItem) => navItem.href === location.pathname);
    return item?.title ?? "Overview";
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;

    async function loadNotifications() {
      try {
        const response = await fetchNotifications();
        if (!ignore) {
          setNotifications(response.items);
          setNotificationCount(response.unreadCount);
        }
      } catch {
        if (!ignore) {
          setNotifications([]);
          setNotificationCount(0);
        }
      }
    }

    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex justify-end px-3 pt-3 lg:hidden">
          <Button
            aria-label="Close navigation"
            size="icon"
            variant="ghost"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 lg:pt-4">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                cn(
                  "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive && "bg-primary/10 text-sidebar-primary",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-3 rounded-md border border-sidebar-border bg-background/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                {initials(user?.name, user?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name || "ZAPP user"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Badge variant={user?.role === "admin" ? "default" : user?.role === "manager" ? "success" : "muted"}>
                {user?.role || "viewer"}
              </Badge>
              <Button aria-label="Sign out" size="sm" variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
          <Button className="w-full justify-start" variant="ghost" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </Button>
          <p className="px-3 pt-2 text-[10px] font-mono text-muted-foreground">v0.1.0</p>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              size="icon"
              variant="ghost"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="hidden text-sm font-semibold lg:block">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                aria-label="Notifications"
                size="icon"
                variant="ghost"
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                ) : null}
              </Button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-card shadow-2xl">
                  <div className="flex items-center justify-between gap-3 border-b p-3">
                    <p className="text-sm font-semibold">Notifications</p>
                    <Badge variant={notificationCount ? "warning" : "muted"}>{notificationCount}</Badge>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No active alerts.</div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto p-2">
                      {notifications.map((item) => (
                        <Link
                          key={item.id}
                          className="block rounded-md p-3 transition hover:bg-muted/50"
                          to={item.href}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">{item.title}</p>
                            <Badge
                              className="shrink-0"
                              variant={
                                item.severity === "warning"
                                  ? "warning"
                                  : item.severity === "error"
                                    ? "destructive"
                                    : "muted"
                              }
                            >
                              {item.type}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="hidden min-w-0 items-center gap-2 rounded-md border bg-card px-2 py-1.5 sm:flex">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                {initials(user?.name, user?.email)}
              </div>
              <div className="min-w-0">
                <p className="max-w-40 truncate text-xs font-medium">{user?.name || "ZAPP user"}</p>
                <p className="max-w-40 truncate text-[10px] text-muted-foreground">{user?.role}</p>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold sm:hidden">
              {initials(user?.name, user?.email)}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
