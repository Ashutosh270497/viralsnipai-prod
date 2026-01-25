"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PricingGrid } from "@/components/marketing-v2/pricing-grid";
import {
  PRICING_PLANS,
  type SupportedCurrency,
  type BillingCycle,
  getYearlyPerMonth
} from "@/components/marketing-v2/pricing-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

const featureComparisons = [
  {
    feature: "AI hook generation",
    starter: "Included",
    growth: "Included",
    pro: "Included"
  },
  {
    feature: "1080p exports without watermark",
    starter: "—",
    growth: "Included",
    pro: "Included"
  },
  {
    feature: "Brand kit & watermark control",
    starter: "Single brand",
    growth: "3 brands",
    pro: "Unlimited"
  },
  {
    feature: "Scheduling & batch queue",
    starter: "—",
    growth: "10 posts/week",
    pro: "Unlimited"
  },
  {
    feature: "Team seats",
    starter: "1",
    growth: "3",
    pro: "Unlimited"
  },
  {
    feature: "Priority support",
    starter: "Email",
    growth: "Priority email",
    pro: "Priority + API"
  }
];

export function PricingPageV2() {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <main className="flex flex-1 flex-col bg-background text-foreground">
      <section className="border-b border-border/60 bg-background py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center sm:px-10">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-500">Pricing</span>
          <h1 className="text-4xl font-semibold sm:text-5xl">Choose the plan that matches your pipeline.</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Start with Starter, scale collaboration on Growth, or unlock agency-grade outputs on Pro. Switch between
            monthly or yearly billing for a 30% discount.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 p-1 text-xs shadow-sm">
              {(["USD", "INR"] as SupportedCurrency[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCurrency(value)}
                  className={cn(
                    "rounded-full px-4 py-2 font-medium transition",
                    currency === value ? "bg-brand-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={currency === value}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 p-1 text-xs shadow-sm">
              {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={cn(
                    "rounded-full px-4 py-2 capitalize transition",
                    billingCycle === cycle ? "bg-brand-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={billingCycle === cycle}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Yearly pricing from {formatSummary(currency)}</p>
        </div>
      </section>

      <section className="border-b border-border/60 bg-background py-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
          <PricingGrid
            currency={currency}
            billingCycle={billingCycle}
            onSelectPlan={(planId, cycle) =>
              trackEvent({ name: "pricing_select", payload: { plan: planId, cycle, currency } })
            }
          />
        </div>
      </section>

      <section className="border-b border-border/60 bg-secondary/40 py-16">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border/70 bg-background px-6 py-8 sm:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Plan comparison</h2>
              <p className="text-sm text-muted-foreground">See what’s included in each tier.</p>
            </div>
            <Button variant="outline" asChild size="sm">
              <Link href="/billing">Manage plan</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="min-w-[200px] px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Starter</th>
                  <th className="px-4 py-3 font-medium">Growth</th>
                  <th className="px-4 py-3 font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {featureComparisons.map((row) => (
                  <tr key={row.feature} className="rounded-xl border border-border/60 bg-card/70">
                    <td className="px-4 py-3 font-medium text-foreground">{row.feature}</td>
                    <td className="px-4 py-3 text-center">{row.starter}</td>
                    <td className="px-4 py-3 text-center">{row.growth}</td>
                    <td className="px-4 py-3 text-center">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatSummary(currency: SupportedCurrency) {
  const starter = getYearlyPerMonth(PRICING_PLANS[0], currency);
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0
  });
  return formatter.format(starter);
}
