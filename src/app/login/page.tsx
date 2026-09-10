"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // replace(), not push(), so Back does not return to the login screen.
        router.replace(next);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not sign in");
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-spenza-charcoal flex items-center justify-center px-5">
      <div className="w-full max-w-[380px]">
        <div className="flex items-baseline gap-2.5 mb-8 justify-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            spenza
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-spenza-orange-bright ml-0.5 align-middle -translate-y-1" />
          </span>
          <span
            className="text-[10px] font-semibold uppercase text-spenza-orange-bright"
            style={{ letterSpacing: "0.16em" }}
          >
            Console
          </span>
        </div>

        <form
          onSubmit={submit}
          className="bg-spenza-surface rounded-card shadow-lift p-6 flex flex-col gap-4"
        >
          <div>
            <h1 className="text-[17px] font-semibold text-spenza-ink leading-tight">Sign in</h1>
            <p className="text-[13px] text-spenza-slate mt-1">
              This console is restricted to the operations team.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-[10px] font-semibold uppercase text-spenza-mute"
              style={{ letterSpacing: "0.14em" }}
            >
              Password
            </span>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-spenza-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                className="w-full h-11 pl-9 pr-3 rounded-input border border-spenza-border bg-white text-[14px] text-spenza-ink outline-none transition-shadow focus:border-spenza-orange focus:shadow-focus"
              />
            </div>
          </label>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 bg-spenza-danger-soft border border-[#FCA5A5] rounded-input px-3 py-2.5"
            >
              <AlertTriangle
                className="w-4 h-4 text-spenza-danger shrink-0 mt-[1px]"
                strokeWidth={2}
              />
              <span className="text-[13px] text-spenza-danger">{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="h-11 rounded-btn bg-spenza-orange text-white text-[14px] font-semibold transition-shadow hover:shadow-orange-hover disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : null}
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static generation.
  return (
    <Suspense fallback={<main className="min-h-screen bg-spenza-charcoal" />}>
      <LoginForm />
    </Suspense>
  );
}
