"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Check } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  PRICING_PLANS,
  type SupportedCurrency,
  getMonthlyPrice,
} from "./pricing-config";

const currencyFormatters: Record<SupportedCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
};

export interface PricingGridProps {
  currency: SupportedCurrency;
  onSelectPlan?: (planId: string) => void;
}

export function PricingGrid({ currency, onSelectPlan }: PricingGridProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const formattedPlans = useMemo(
    () =>
      PRICING_PLANS.map((plan) => {
        return {
          ...plan,
          price: getMonthlyPrice(plan, currency),
        };
      }),
    [currency]
  );

  function handlePlanSelect(planId: string) {
    onSelectPlan?.(planId);

    const href = `/billing?plan=${planId}&currency=${currency}`;
    if (status === "authenticated" && session?.user?.id) {
      router.push(href);
      return;
    }

    router.push(`/signin?callbackUrl=${encodeURIComponent(href)}`);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {formattedPlans.map((plan) => (
        <Card
          key={plan.id}
          className={cn(
            "relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-sm shadow-slate-950/5 transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-950/10 dark:border-white/10 dark:bg-[#0f1d1f]",
            plan.isFeatured && "border-emerald-400 shadow-2xl shadow-emerald-950/15 dark:border-emerald-300/50"
          )}
        >
          {plan.isFeatured ? (
            <span className="absolute right-6 top-6 inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
              Recommended
            </span>
          ) : null}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Monthly pricing</p>
            <div>
              <h3 className="text-2xl font-semibold text-slate-950 dark:text-white">{plan.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.tagline}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{formatPrice(plan.price, currency)}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-300">/mo</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Razorpay checkout. Cancel at period end.</p>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-500" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className={cn(
              "w-full rounded-full font-semibold shadow-lg",
              plan.isFeatured
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-emerald-900/20 hover:from-emerald-400 hover:to-cyan-400"
                : "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-50"
            )}
            onClick={() => handlePlanSelect(plan.id)}
          >
            {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </Card>
      ))}
    </div>
  );
}

function formatPrice(amount: number, currency: SupportedCurrency) {
  const formatter = currencyFormatters[currency];
  const formatted = formatter.format(amount);
  return formatted.replace(/\.00$/, "");
}
