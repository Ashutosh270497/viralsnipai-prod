"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Check } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  PRICING_PLANS,
  type SupportedCurrency,
  type BillingCycle,
  getMonthlyPrice,
  getYearlyPerMonth,
  getYearlyTotal,
  YEARLY_DISCOUNT
} from "./pricing-config";

const currencyFormatters: Record<SupportedCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
};

export interface PricingGridProps {
  currency: SupportedCurrency;
  billingCycle: BillingCycle;
  onSelectPlan?: (planId: string, cycle: BillingCycle) => void;
}

export function PricingGrid({ currency, billingCycle, onSelectPlan }: PricingGridProps) {
  const formattedPlans = useMemo(
    () =>
      PRICING_PLANS.map((plan) => {
        const monthly = getMonthlyPrice(plan, currency);
        const yearlyPerMonth = getYearlyPerMonth(plan, currency);
        const yearlyTotal = getYearlyTotal(plan, currency);
        const price = billingCycle === "monthly" ? monthly : yearlyPerMonth;
        const billedLabel = billingCycle === "monthly" ? null : `${formatPrice(yearlyTotal, currency)} billed yearly`;

        return {
          ...plan,
          price,
          billedLabel,
          monthly,
          yearlyPerMonth
        };
      }),
    [billingCycle, currency]
  );

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {formattedPlans.map((plan) => (
        <Card
          key={plan.id}
          className={cn(
            "relative flex h-full flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-xl shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900",
            plan.isFeatured && "border-brand-500/70 shadow-[#4C8EFF]/30"
          )}
        >
          {plan.isFeatured ? (
            <span className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full bg-gradient-to-r from-[#4C8EFF] to-[#9777FF] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">
              Popular
            </span>
          ) : null}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4C8EFF]">⚡ Save {Math.round(YEARLY_DISCOUNT * 100)}%</p>
            <div>
              <h3 className="text-2xl font-semibold text-[#0E172C] dark:text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{plan.tagline}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[#0E172C] dark:text-white">{formatPrice(plan.price, currency)}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                  /month{billingCycle === "yearly" ? " billed yearly" : ""}
                </span>
              </div>
              {plan.billedLabel ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">{plan.billedLabel}</p>
              ) : null}
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-[#4C8EFF]" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full rounded-full bg-gradient-to-r from-[#4C8EFF] to-[#9777FF] text-white shadow-lg"
            onClick={() => onSelectPlan?.(plan.id, billingCycle)}
            asChild
          >
            <Link href="/billing">
              Choose {plan.name}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
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
