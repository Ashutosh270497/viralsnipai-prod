"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Logo } from "@/components/marketing/logo";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await signIn("email", {
      email,
      callbackUrl: "/dashboard"
    });
    setIsSubmitting(false);
  }

  async function handleGoogle() {
    setIsSubmitting(true);
    await signIn("google", {
      callbackUrl: "/dashboard"
    });
    setIsSubmitting(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Clippers</span>
          </Link>
        </div>

        {/* Main Content */}
        <div className="space-y-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Create an account</h1>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign up with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-4 text-gray-500 dark:bg-black dark:text-neutral-500">or</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            <div className="space-y-2">
              <label htmlFor="email" className="text-base font-medium text-gray-700 dark:text-neutral-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating account..." : "Sign up"}
            </button>
          </form>

          {/* Additional Links */}
          <div className="text-sm">
            <span className="text-gray-600 dark:text-neutral-400">Already have an account? </span>
            <Link href="/signin" className="font-semibold text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-4 text-center text-sm text-gray-600 dark:text-neutral-400">
          <p>
            By continuing, I agree to the{" "}
            <Link href="/terms" className="underline hover:text-gray-900 dark:hover:text-neutral-200">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-900 dark:hover:text-neutral-200">
              Privacy Policy
            </Link>
          </p>
          <p>
            Having trouble logging in?{" "}
            <Link href="/support" className="underline hover:text-gray-900 dark:hover:text-neutral-200">
              Click Here
            </Link>{" "}
            and try again.
          </p>
        </div>
      </div>
    </div>
  );
}
