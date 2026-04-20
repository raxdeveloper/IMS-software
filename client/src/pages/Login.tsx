import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-ims-base dark:to-black px-4">
        <div className="w-full max-w-md space-y-3 p-6">
          <div className="h-10 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-32 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-10 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse w-2/3 mx-auto" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-ims-base dark:to-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-accent/20 bg-white dark:bg-ims-surface dark:backdrop-blur-md shadow-xl dark:shadow-[0_0_48px_-12px_rgba(0,255,157,0.12)] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-50 tracking-tight">
            Ophthalmic IMS
          </h1>
          <p className="text-sm text-slate-500 dark:text-ims-muted mt-1">
            Sign in to continue
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-slate-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-slate-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent text-accent-foreground hover:brightness-95 disabled:opacity-60 font-medium py-2.5 transition-colors shadow-[0_0_24px_-6px_rgba(0,255,157,0.45)]"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-xs text-slate-500 dark:text-zinc-500">
        Default admin (after seed): admin@clinic.local
      </p>
    </div>
  );
}
