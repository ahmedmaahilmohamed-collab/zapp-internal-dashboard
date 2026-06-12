import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, UserPlus } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../lib/auth-context";

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";

export function RegisterPage() {
  const { user, register, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  if (!loading && user?.status === "approved") {
    return <Navigate replace to="/" />;
  }

  if (!loading && user?.status === "pending") {
    return <Navigate replace to="/pending" />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const nextUser = await register({ email, name, password });
      navigate(nextUser.status === "approved" ? "/" : "/pending", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request access.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 border-b p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Request Access</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Create a dashboard account</p>
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
                Name
              </span>
              <input
                required
                autoComplete="name"
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
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
                autoComplete="new-password"
                className={inputClass}
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <Button className="w-full" disabled={submitting} type="submit">
              <UserPlus className="h-4 w-4" />
              {submitting ? "Submitting..." : "Request access"}
            </Button>
          </form>
          <div className="mt-5 rounded-md bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Already approved?</span>{" "}
            <Link className="font-medium text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
