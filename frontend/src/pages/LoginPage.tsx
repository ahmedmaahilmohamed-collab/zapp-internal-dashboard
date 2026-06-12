import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, LockKeyhole, LogIn } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../lib/auth-context";

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  if (!loading && user?.status === "approved") {
    return <Navigate replace to={from} />;
  }

  if (!loading && user?.status === "pending") {
    return <Navigate replace to="/pending" />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const nextUser = await login({ email, password });
      navigate(nextUser.status === "approved" ? from : "/pending", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 border-b p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Sign in to ZAPP</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Internal dashboard access</p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {error ? (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={submit}>
            <label className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <input
                required
                autoComplete="email"
                className={inputClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <input
                required
                autoComplete="current-password"
                className={inputClass}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <Button className="w-full" disabled={submitting} type="submit">
              <LogIn className="h-4 w-4" />
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 rounded-md bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Need access?</span>{" "}
            <Link className="font-medium text-primary hover:underline" to="/register">
              Request an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
