import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCcw, ShieldCheck, UserX } from "lucide-react";

import { Badge, BadgeProps } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AuthUser, UserRole, UserStatus, fetchAccessUsers, updateAccessUser } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { cn, formatDate } from "../lib/utils";

const selectClass =
  "h-9 rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";

const roleOptions: UserRole[] = ["admin", "manager", "viewer"];
const statusOptions: UserStatus[] = ["pending", "approved", "rejected", "disabled"];

function statusVariant(status: UserStatus): BadgeProps["variant"] {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "disabled") return "destructive";
  return "muted";
}

function roleVariant(role: UserRole): BadgeProps["variant"] {
  if (role === "admin") return "default";
  if (role === "manager") return "success";
  return "muted";
}

export function AccessManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await fetchAccessUsers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => user.status === "pending").length,
      approved: users.filter((user) => user.status === "approved").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users],
  );

  async function updateUser(id: number, payload: { role?: UserRole; status?: UserStatus }) {
    setUpdatingId(id);
    setError("");
    try {
      const updated = await updateAccessUser(id, payload);
      setUsers((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update user.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve accounts, assign roles, and disable dashboard access.
          </p>
        </div>
        <Button disabled={loading} variant="outline" onClick={load}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} tone="warning" />
        <StatCard label="Approved" value={stats.approved} tone="success" />
        <StatCard label="Admins" value={stats.admins} />
      </div>

      {error ? (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-orange-700 dark:text-orange-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>Internal Users</CardTitle>
          </div>
        </CardHeader>

        {loading ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </CardContent>
        ) : users.length === 0 ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <UserX className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No users found</p>
              <p className="mt-1 text-sm text-muted-foreground">Register the first admin account.</p>
            </div>
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((account) => (
                    <UserRow
                      key={account.id}
                      account={account}
                      currentUserId={currentUser?.id}
                      updating={updatingId === account.id}
                      onUpdate={updateUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {users.map((account) => (
                <UserCard
                  key={account.id}
                  account={account}
                  currentUserId={currentUser?.id}
                  updating={updatingId === account.id}
                  onUpdate={updateUser}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-bold",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "text-orange-600 dark:text-orange-400",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function UserIdentity({ account }: { account: AuthUser }) {
  return (
    <div>
      <p className="font-medium">{account.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{account.email}</p>
      <div className="mt-2 flex gap-2">
        <Badge variant={roleVariant(account.role)}>{account.role}</Badge>
        <Badge variant={statusVariant(account.status)}>{account.status}</Badge>
      </div>
    </div>
  );
}

function RoleSelect({
  account,
  disabled,
  onUpdate,
}: {
  account: AuthUser;
  disabled: boolean;
  onUpdate: (id: number, payload: { role?: UserRole; status?: UserStatus }) => Promise<void>;
}) {
  return (
    <select
      className={selectClass}
      disabled={disabled}
      value={account.role}
      onChange={(event) => onUpdate(account.id, { role: event.target.value as UserRole })}
    >
      {roleOptions.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

function StatusSelect({
  account,
  disabled,
  onUpdate,
}: {
  account: AuthUser;
  disabled: boolean;
  onUpdate: (id: number, payload: { role?: UserRole; status?: UserStatus }) => Promise<void>;
}) {
  return (
    <select
      className={selectClass}
      disabled={disabled}
      value={account.status}
      onChange={(event) => onUpdate(account.id, { status: event.target.value as UserStatus })}
    >
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function QuickActions({
  account,
  disabled,
  onUpdate,
}: {
  account: AuthUser;
  disabled: boolean;
  onUpdate: (id: number, payload: { role?: UserRole; status?: UserStatus }) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {account.status !== "approved" ? (
        <Button
          disabled={disabled}
          size="sm"
          variant="outline"
          onClick={() => onUpdate(account.id, { status: "approved" })}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </Button>
      ) : null}
      {account.status !== "rejected" ? (
        <Button
          disabled={disabled}
          size="sm"
          variant="outline"
          onClick={() => {
            if (window.confirm("Reject this user account?")) {
              void onUpdate(account.id, { status: "rejected" });
            }
          }}
        >
          Reject
        </Button>
      ) : null}
      {account.status !== "disabled" ? (
        <Button
          disabled={disabled}
          size="sm"
          variant="outline"
          onClick={() => {
            if (window.confirm("Disable this user account?")) {
              void onUpdate(account.id, { status: "disabled" });
            }
          }}
        >
          Disable
        </Button>
      ) : null}
    </div>
  );
}

function UserRow({
  account,
  currentUserId,
  updating,
  onUpdate,
}: {
  account: AuthUser;
  currentUserId?: number;
  updating: boolean;
  onUpdate: (id: number, payload: { role?: UserRole; status?: UserStatus }) => Promise<void>;
}) {
  const isSelf = account.id === currentUserId;
  const controlsDisabled = updating || isSelf;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <UserIdentity account={account} />
      </td>
      <td className="px-4 py-3">
        <RoleSelect account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
      </td>
      <td className="px-4 py-3">
        <StatusSelect account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
      </td>
      <td className="px-4 py-3">{formatDate(account.last_login_at)}</td>
      <td className="px-4 py-3">
        <QuickActions account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
      </td>
    </tr>
  );
}

function UserCard({
  account,
  currentUserId,
  updating,
  onUpdate,
}: {
  account: AuthUser;
  currentUserId?: number;
  updating: boolean;
  onUpdate: (id: number, payload: { role?: UserRole; status?: UserStatus }) => Promise<void>;
}) {
  const isSelf = account.id === currentUserId;
  const controlsDisabled = updating || isSelf;

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity account={account} />
        {isSelf ? <Badge variant="muted">You</Badge> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RoleSelect account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
        <StatusSelect account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
      </div>
      <p className="text-xs text-muted-foreground">Last login: {formatDate(account.last_login_at)}</p>
      <QuickActions account={account} disabled={controlsDisabled} onUpdate={onUpdate} />
    </div>
  );
}
