export type SupportedCurrency = "USD" | "INR";
export type BillingCycle = "monthly" | "yearly";

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthly: Record<SupportedCurrency, number>;
  features: string[];
  isFeatured?: boolean;
}

export const YEARLY_DISCOUNT = 0.3; // 30% off

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Solo creators",
    monthly: { USD: 9, INR: 699 },
    features: ["Auto clipping up to 30 minutes", "Smart captions & hook highlights", "1 workspace & brand kit"]
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Popular choice",
    monthly: { USD: 18, INR: 1499 },
    features: [
      "Everything in Starter",
      "Schedule 10 posts per week",
      "3 collaborators with approvals"
    ],
    isFeatured: true
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Studios & agencies",
    monthly: { USD: 45, INR: 3599 },
    features: [
      "Everything in Growth",
      "Unlimited brand kits & exports",
      "Priority support & API access"
    ]
  }
];

export function getMonthlyPrice(plan: PricingPlan, currency: SupportedCurrency) {
  return plan.monthly[currency];
}

export function getYearlyPerMonth(plan: PricingPlan, currency: SupportedCurrency) {
  const monthly = getMonthlyPrice(plan, currency);
  const discounted = monthly * (1 - YEARLY_DISCOUNT);
  const precision = currency === "USD" ? 2 : 0;
  return Number.parseFloat(discounted.toFixed(precision));
}

export function getYearlyTotal(plan: PricingPlan, currency: SupportedCurrency) {
  const perMonth = getYearlyPerMonth(plan, currency);
  const total = perMonth * 12;
  const precision = currency === "USD" ? 2 : 0;
  return Number.parseFloat(total.toFixed(precision));
}
