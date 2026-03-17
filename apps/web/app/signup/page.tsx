"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { useToast } from "@/components/ui/use-toast";
import { signupSchema } from "@/lib/validations";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate input
      const validatedData = signupSchema.parse({ email, password, name });

      // Call signup API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          // Zod validation errors
          const fieldErrors: Record<string, string> = {};
          data.details.forEach((error: any) => {
            fieldErrors[error.path[0]] = error.message;
          });
          setErrors(fieldErrors);
        } else {
          toast({
            title: "Signup failed",
            description: data.error || "An error occurred during signup",
            variant: "destructive"
          });
        }
        setIsSubmitting(false);
        return;
      }

      // Success - sign in with credentials
      toast({
        title: "Account created!",
        description: "Signing you in..."
      });

      const signInResult = await signIn("credentials", {
        email: validatedData.email,
        password: validatedData.password,
        callbackUrl
      });

      if (signInResult?.error) {
        toast({
          title: "Sign in failed",
          description: "Account created but sign in failed. Please sign in manually.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      if (error.name === "ZodError") {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive"
        });
      }
    }

    setIsSubmitting(false);
  }

  async function handleGoogle() {
    setIsSubmitting(true);
    await signIn("google", {
      callbackUrl
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
            <span className="text-2xl font-bold text-gray-900 dark:text-white">ViralSnipAI</span>
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

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            <div className="space-y-2">
              <label htmlFor="name" className="text-base font-medium text-gray-700 dark:text-neutral-300">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              />
              {errors.name && <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

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
              {errors.email && <p className="text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-base font-medium text-gray-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Must contain at least 8 characters, one uppercase letter, and one number
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          {/* Additional Links */}
          <div className="text-sm">
            <span className="text-gray-600 dark:text-neutral-400">Already have an account? </span>
            <Link
              href={`/signin${callbackUrl !== "/snipradar-onboarding" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="font-semibold text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
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
        </div>
      </div>
    </div>
  );
}

function sanitizeCallbackUrl(input: string | null) {
  if (!input || !input.startsWith("/")) {
    return "/snipradar-onboarding";
  }
  return input;
}
