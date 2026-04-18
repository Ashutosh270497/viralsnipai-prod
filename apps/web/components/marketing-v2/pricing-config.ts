export type SupportedCurrency = "USD" | "INR";
export type MarketingPlanId = "free" | "plus" | "pro";

export interface PricingPlan {
  id: MarketingPlanId;
  name: string;
  tagline: string;
  features: string[];
  isFeatured?: boolean;
  priceUSD: number;
  priceINR: number;
}

export type PricingComparisonRow = {
  feature: string;
  free: string;
  plus: string;
  pro: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Taste the radar. Get hooked.",
    priceUSD: 0,
    priceINR: 0,
    features: [
      "1 tracked X account",
      "10 viral feed refreshes / month",
      "5 AI drafts saved",
      "5 hook generations / month",
      "Browser extension (read-only captures)",
      "Basic analytics — 7-day view only",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Everything you need to grow consistently on X.",
    priceUSD: 9,
    priceINR: 799,
    isFeatured: true,
    features: [
      "5 tracked X accounts",
      "Unlimited viral feed refreshes and AI drafts",
      "Thread Builder with AI hooks and templates",
      "Scheduling — up to 100 posts / month",
      "Research Copilot, Variant Lab, and browser extension reply assist",
      "30-day analytics",
      "AI Growth Plan — weekly report",
      "Inbox management",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Unfair advantage. Maximum output. Zero limits.",
    priceUSD: 19,
    priceINR: 1799,
    features: [
      "15 tracked X accounts",
      "Everything in Plus, unlimited",
      "Unlimited scheduling + auto-queue",
      "90-day deep analytics",
      "Relationships CRM",
      "API access and webhooks",
      "WinnerLoop evergreen automation",
    ],
  },
];

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    feature: "Tracked accounts",
    free: "1",
    plus: "5",
    pro: "15",
  },
  {
    feature: "Viral Radar refreshes",
    free: "10 / month",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    feature: "AI drafts saved",
    free: "5",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    feature: "Hook generations",
    free: "5 / month",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    feature: "Thread Builder",
    free: "Not included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Browser Extension",
    free: "Read-only captures",
    plus: "Reply assist + remix",
    pro: "Reply assist + remix",
  },
  {
    feature: "Scheduling",
    free: "Not included",
    plus: "100 posts / month",
    pro: "Unlimited",
  },
  {
    feature: "Analytics window",
    free: "7 days",
    plus: "30 days",
    pro: "90 days",
  },
  {
    feature: "AI Growth Plan",
    free: "Not included",
    plus: "Weekly report",
    pro: "Weekly report",
  },
  {
    feature: "Research Copilot",
    free: "Not included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Variant Lab",
    free: "Not included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Inbox management",
    free: "Not included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Relationships CRM",
    free: "Not included",
    plus: "Not included",
    pro: "Included",
  },
  {
    feature: "WinnerLoop evergreen",
    free: "Not included",
    plus: "Not included",
    pro: "Included",
  },
  {
    feature: "API + Webhooks",
    free: "Not included",
    plus: "Not included",
    pro: "Included",
  },
  {
    feature: "AI model tier",
    free: "Standard",
    plus: "Enhanced",
    pro: "Priority (Claude Sonnet)",
  },
];

export function getMonthlyPrice(plan: PricingPlan, currency: SupportedCurrency) {
  return currency === "USD" ? plan.priceUSD : plan.priceINR;
}
