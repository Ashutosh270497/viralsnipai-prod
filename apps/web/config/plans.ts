import type { BillingPlanDefinition, BillingPlanId, PublicBillingPlanDefinition } from "@/types/billing";

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceINR: 0,
    priceUSD: 0,
    razorpayPlanIds: {
      IN: "",
      GLOBAL: "",
    },
    legacyAliases: ["free"],
    features: [
      "Track 1 account",
      "10 Viral Feed fetches per month",
      "3 saved drafts",
      "10 unlocked templates",
      "5 hook generations per month",
    ],
    limits: {
      trackedAccounts: 1,
      connectedXAccounts: 1,
      seats: 1,
      viralFeedFetches: 10,
      drafts: 3,
      templates: 10,
      hookGenerations: 5,
      scheduling: false,
      analytics: false,
      growthPlanAI: false,
      variantLab: false,
      researchCopilot: false,
      engagementFinder: false,
      relationships: false,
      activityCenterPriority: false,
      whitelabelExports: false,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceINR: 499,
    priceUSD: 9.99,
    razorpayPlanIds: {
      IN: process.env.RAZORPAY_PLAN_ID_PLUS_INR ?? "",
      GLOBAL: process.env.RAZORPAY_PLAN_ID_PLUS_USD ?? "",
    },
    legacyAliases: ["starter", "creator", "plus"],
    features: [
      "Full Discover + Create access",
      "5 tracked accounts",
      "Unlimited drafts and hook generations",
      "25 scheduled posts per month",
      "7-day analytics and 50 engagement opportunities per month",
    ],
    limits: {
      trackedAccounts: 5,
      connectedXAccounts: 1,
      seats: 1,
      viralFeedFetches: "unlimited",
      drafts: "unlimited",
      templates: 96,
      hookGenerations: "unlimited",
      scheduling: { monthlyPosts: 25 },
      analytics: "7d",
      growthPlanAI: false,
      variantLab: true,
      researchCopilot: true,
      engagementFinder: { monthlyOpportunities: 50 },
      relationships: false,
      activityCenterPriority: false,
      whitelabelExports: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceINR: 2199,
    priceUSD: 29.99,
    razorpayPlanIds: {
      IN: process.env.RAZORPAY_PLAN_ID_PRO_INR ?? "",
      GLOBAL: process.env.RAZORPAY_PLAN_ID_PRO_USD ?? "",
    },
    legacyAliases: ["pro", "studio", "agency"],
    features: [
      "Everything in Plus",
      "15 tracked accounts",
      "Unlimited scheduling and engagement opportunities",
      "30-day analytics with export",
      "Growth Plan AI, Relationships, and priority activity center",
    ],
    limits: {
      trackedAccounts: 15,
      connectedXAccounts: 1,
      seats: 1,
      viralFeedFetches: "unlimited",
      drafts: "unlimited",
      templates: 96,
      hookGenerations: "unlimited",
      scheduling: { monthlyPosts: "unlimited" },
      analytics: "30d + export",
      growthPlanAI: true,
      variantLab: true,
      researchCopilot: true,
      engagementFinder: { monthlyOpportunities: "unlimited" },
      relationships: true,
      activityCenterPriority: true,
      whitelabelExports: false,
    },
  },
};

export const PUBLIC_BILLING_PLANS: PublicBillingPlanDefinition[] = Object.values(BILLING_PLANS).map((plan) => ({
  id: plan.id,
  name: plan.name,
  priceINR: plan.priceINR,
  priceUSD: plan.priceUSD,
  features: plan.features,
  limits: plan.limits,
}));

export function getBillingPlan(planId: BillingPlanId) {
  return BILLING_PLANS[planId];
}

export function getPublicBillingPlan(planId: BillingPlanId) {
  return PUBLIC_BILLING_PLANS.find((plan) => plan.id === planId) ?? PUBLIC_BILLING_PLANS[0];
}

export function isPaidBillingPlan(planId: BillingPlanId) {
  return planId !== "free";
}

export function resolveBillingPlanId(value?: string | null): BillingPlanId {
  if (value === "plus" || value === "pro") return value;
  if (value === "starter" || value === "creator") return "plus";
  if (value === "studio" || value === "agency") return "pro";
  return "free";
}

export function getBillingPlanRazorpayPlanId(planId: BillingPlanId, billingRegion: "IN" | "GLOBAL") {
  return getBillingPlan(planId).razorpayPlanIds[billingRegion] ?? "";
}

export function serializePublicPlanCatalog() {
  return PUBLIC_BILLING_PLANS;
}
