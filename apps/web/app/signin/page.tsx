"use client";

import { FormEvent, Suspense, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

import { Logo } from "@/components/marketing/logo";
import { useToast } from "@/components/ui/use-toast";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start sign in. Please try again.",
  OAuthCallback: "Sign in failed during authorization. Your Google account may not be allowed — check Google Cloud Console OAuth consent screen.",
  OAuthCreateAccount: "Could not create account. Please try again.",
  EmailCreateAccount: "Could not create account with that email.",
  Callback: "Sign in callback failed. Please try again.",
  OAuthAccountNotLinked: "This email is already linked to another sign-in method. Use that method instead.",
  default: "An error occurred during sign in. Please try again.",
};

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const errorType = searchParams.get("error");
  const authError = errorType
    ? ERROR_MESSAGES[errorType] ?? ERROR_MESSAGES.default
    : null;

  const demoAvailable = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
  const devBypass = demoAvailable && searchParams.get("dev-bypass") === "true";
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  // Dev bypass: auto-trigger demo login (only when demo provider is available)
  useEffect(() => {
    if (devBypass && status === "unauthenticated" && !isSubmitting) {
      setIsSubmitting(true);
      signIn("demo", { demo: "true", redirect: false }).then((result) => {
        if (result?.ok) {
          router.push(callbackUrl);
        } else {
          setIsSubmitting(false);
        }
      });
    }
  }, [callbackUrl, devBypass, status, isSubmitting, router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.push(callbackUrl);
    }
  }, [callbackUrl, status, session, router]);

  // Show loading while checking auth status
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render form if authenticated (will redirect)
  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      toast({
        title: "Sign in failed",
        description: "Invalid email or password",
        variant: "destructive"
      });
      setIsSubmitting(false);
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  }

  async function handleGoogle() {
    setIsSubmitting(true);
    await signIn("google", {
      callbackUrl
    });
  }

  async function handleDemo() {
    setIsSubmitting(true);
    const result = await signIn("demo", {
      demo: "true",
      redirect: false
    });

    if (result?.ok) {
      router.push(callbackUrl);
    } else {
      setIsSubmitting(false);
      toast({
        title: "Demo login failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">ViralSnipAI</span>
          </Link>
        </div>

        <div className="space-y-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome back</h1>

          {authError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-900 dark:bg-red-950">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{authError}</p>
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isSubmitting ? "Signing in..." : "Sign in with Google"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-neutral-800"/></div>
            <div className="relative flex justify-center text-sm"><span className="bg-gray-50 px-4 text-gray-500 dark:bg-black dark:text-neutral-500">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            <div className="space-y-2">
              <label htmlFor="email" className="text-base font-medium text-gray-700 dark:text-neutral-300">Email address</label>
              <input id="email" type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"/>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-base font-medium text-gray-700 dark:text-neutral-300">Password</label>
                <Link href="/reset-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Forgot password?</Link>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                  {showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="space-y-3 text-sm">
            {demoAvailable ? (
              <button
                onClick={handleDemo}
                disabled={isSubmitting}
                className="font-semibold text-gray-600 underline transition hover:text-gray-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Try the demo workspace
              </button>
            ) : null}
            <div>
              <span className="text-gray-600 dark:text-neutral-400">Don&apos;t have an account? </span>
              <Link
                href={`/signup${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
                className="font-semibold text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-center text-sm text-gray-600 dark:text-neutral-400">
          <p>By continuing, I agree to the <Link href="/terms" className="underline hover:text-gray-900 dark:hover:text-neutral-200">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-gray-900 dark:hover:text-neutral-200">Privacy Policy</Link></p>
        </div>
      </div>
    </div>
  );
}

function sanitizeCallbackUrl(input: string | null) {
  if (!input || !input.startsWith("/")) {
    return "/dashboard";
  }
  return input;
}
