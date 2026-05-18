"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { KeyboardSafeFormShell } from "@/components/ui/mobile-safe";
import { getSupportEmail, getSupportMailto } from "@/lib/support";

function NewPasswordInner() {
  const token = useSearchParams()?.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing a token.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We could not update your password. Request a new reset link.");
        return;
      }
      setMessage(data.message || "Your password has been updated. Sign in with your new password.");
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
              <LockKeyhole className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">
              Choose a new password
            </h1>
            <p className="text-sm leading-6 text-gray-600 dark:text-neutral-400">
              Use at least 8 characters, one uppercase letter, and one number.
            </p>
          </div>

          {message ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{message}</p>
                </div>
              </div>
              <Link
                href="/signin"
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Update password
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-neutral-500">
            Need help?{" "}
            <a href={getSupportMailto("Password reset help")} className="underline hover:text-gray-900 dark:hover:text-neutral-200">
              {getSupportEmail()}
            </a>
          </div>
        </section>
      </div>
    </KeyboardSafeFormShell>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={<KeyboardSafeFormShell><Loader2 className="h-6 w-6 animate-spin" /></KeyboardSafeFormShell>}>
      <NewPasswordInner />
    </Suspense>
  );
}
