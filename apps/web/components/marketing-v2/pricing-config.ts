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
    tagline: "Experience the viral radar and AI drafting — no card required.",
    priceUSD: 0,
    priceINR: 0,
    features: [
      "1 tracked X account",
      "10 viral feed refreshes / month",
      "5 AI drafts saved",
      "5 hook generations / month",
      "Browser extension (read-only captures)",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Full Discover, Create, and Publish for active X operators.",
    priceUSD: 9.99,
    priceINR: 499,
    isFeatured: true,
    features: [
      "5 tracked accounts",
      "Unlimited drafts and viral refreshes",
      "Thread Builder + AI hooks and templates",
      "Scheduling — up to 50 posts / month",
      "Research Copilot, Variant Lab, and browser extension reply assist",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Maximum limits, Auto-DM, deep analytics, and developer tools.",
    priceUSD: 29.99,
    priceINR: 2199,
    features: [
      "15 tracked accounts",
      "Unlimited scheduling + Auto-DM automation",
      "WinnerLoop evergreen automation",
      "30-day analytics and AI Growth Planner",
      "Relationships CRM and API / webhooks",
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
    plus: "50 posts / month",
    pro: "Unlimited",
  },
  {
    feature: "Auto-DM automation",
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
    feature: "Analytics window",
    free: "Not included",
    plus: "7 days",
    pro: "30 days",
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
    feature: "Relationships CRM",
    free: "Not included",
    plus: "Basic",
    pro: "Full (follow / nurture / track)",
  },
  {
    feature: "Growth Planner AI",
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
];

export function getMonthlyPrice(plan: PricingPlan, currency: SupportedCurrency) {
  return currency === "USD" ? plan.priceUSD : plan.priceINR;
}
