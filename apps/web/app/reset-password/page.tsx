"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { KeyboardSafeFormShell } from "@/components/ui/mobile-safe";
import { getSupportEmail, getSupportMailto } from "@/lib/support";

function ResetPasswordInner() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We could not process that request. Please try again.");
        return;
      }
      setMessage(data.message || "If an account exists, we sent reset instructions.");
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardSafeFormShell>
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">ViralSnipAI</span>
          </Link>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-6 space-y-2 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">
              Reset your password
            </h1>
            <p className="text-sm leading-6 text-gray-600 dark:text-neutral-400">
              Enter your email and we&apos;ll send a secure reset link if an account exists.
            </p>
          </div>

          {message ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{message}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  placeholder="you@example.com"
                />
              </div>

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Send reset link
              </button>
            </form>
          )}

          <div className="mt-6 space-y-3 text-center text-sm">
            <Link href="/signin" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Back to sign in
            </Link>
            <p className="text-gray-500 dark:text-neutral-500">
              Need help?{" "}
              <a href={getSupportMailto("Password reset help")} className="underline hover:text-gray-900 dark:hover:text-neutral-200">
                {getSupportEmail()}
              </a>
            </p>
          </div>
        </section>
      </div>
    </KeyboardSafeFormShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<KeyboardSafeFormShell><Loader2 className="h-6 w-6 animate-spin" /></KeyboardSafeFormShell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

