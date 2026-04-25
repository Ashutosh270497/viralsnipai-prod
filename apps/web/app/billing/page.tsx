import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentDbUser } from "@/lib/auth";
import { getCurrentSubscriptionState } from "@/lib/billing";
import type { BillingRegion } from "@/types/billing";

export const metadata: Metadata = {
  title: "Billing | ViralSnipAI",
  description: "Manage your ViralSnipAI Razorpay subscription, billing region, usage, and plan access.",
};

type BillingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await getCurrentDbUser();
  const queryString = searchParams ? new URLSearchParams(normalizeSearchParams(searchParams)).toString() : "";
  const callbackUrl = queryString ? `/billing?${queryString}` : "/billing";

  if (!user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const requestHeaders = await headers();
  const state = await getCurrentSubscriptionState(user.id, {
    host: requestHeaders.get("host"),
    country: requestHeaders.get("x-vercel-ip-country"),
    locale: requestHeaders.get("accept-language"),
  });

  const initialRegion = resolveRegion(searchParams?.region, state.billingRegion, state.recommendedRegion);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-6 py-8 lg:px-8">
        <header className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-9 w-9 rounded-xl border border-border bg-card text-foreground hover:border-primary/35"
              >
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Billing</h1>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-300">
                  Razorpay Only
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                asChild
                className="h-[34px] rounded-lg border border-border px-3.5 text-[13px] font-medium text-muted-foreground hover:border-primary/35 hover:text-foreground"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button
                variant="ghost"
                asChild
                className="h-[34px] rounded-lg border border-border px-3.5 text-[13px] font-medium text-muted-foreground hover:border-primary/35 hover:text-foreground"
              >
                <Link href="/dashboard">Back to workspace</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              Manage billing and plan access
            </h2>
            <p className="max-w-[560px] text-sm leading-6 text-muted-foreground">
              Billing is now standardized on Razorpay with one canonical plan model: free, plus,
              and pro. Monthly subscriptions are available for India and global pricing.
            </p>
          </div>
        </header>

        <BillingWorkspace initialState={state} initialRegion={initialRegion} />
      </div>
    </div>
  );
}

function normalizeSearchParams(input: Record<string, string | string[] | undefined>) {
  const entries = Object.entries(input).flatMap(([key, value]) => {
    if (typeof value === "string") return [[key, value] as const];
    if (Array.isArray(value) && value[0]) return [[key, value[0]] as const];
    return [];
  });
  return Object.fromEntries(entries);
}

function resolveRegion(
  value: string | string[] | undefined,
  currentRegion: BillingRegion,
  recommendedRegion: BillingRegion,
): BillingRegion {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "IN" || candidate === "GLOBAL") {
    return candidate;
  }

  if (currentRegion === "IN" || currentRegion === "GLOBAL") {
    return currentRegion;
  }

  return recommendedRegion;
}
