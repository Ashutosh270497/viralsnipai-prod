export type SupportedCurrency = "USD" | "INR";
export type BillingCycle = "monthly" | "yearly";
export type PlanTier = "free" | "starter" | "creator" | "studio";
export type PaidPlanTier = Exclude<PlanTier, "free">;

export type CommercialLimitValue = number | "unlimited";
export type CoreUsageFeature = "ideas" | "scripts" | "titles" | "thumbnails" | "tts";
export type SecondaryUsageFeature =
  | "contentCalendarGenerations"
  | "nicheDiscoveryAnalyses"
  | "trackedCompetitors";

export interface CommercialPlanDefinition {
  id: PlanTier;
  name: string;
  tagline: string;
  monthly: Record<SupportedCurrency, number>;
  marketingFeatures: string[];
  coreUsage: Record<CoreUsageFeature, CommercialLimitValue>;
  secondaryUsage: Record<SecondaryUsageFeature, CommercialLimitValue>;
  workspace: {
    workspaces: CommercialLimitValue;
    brandKits: CommercialLimitValue;
    collaborationLabel: string;
    collaborationBoundary: string;
    adminControls: string[];
  };
  snipRadar: {
    scheduledPostsPerWeek: CommercialLimitValue;
    apiAccess: boolean;
    webhookAccess: boolean;
    analyticsLabel: string;
  };
  supportLevel: string;
}

export interface PricingPlan {
  id: PaidPlanTier;
  name: string;
  tagline: string;
  monthly: Record<SupportedCurrency, number>;
  features: string[];
  isFeatured?: boolean;
}

export interface PricingComparisonRow {
  feature: string;
  starter: string;
  creator: string;
  studio: string;
}

export const YEARLY_DISCOUNT = 0.3;

export const COMMERCIAL_PLAN_CATALOG: Record<PlanTier, CommercialPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "For exploring the workspace before committing to a recurring plan",
    monthly: { USD: 0, INR: 0 },
    marketingFeatures: [
      "5 content ideas per month",
      "3 scripts, 5 title generations, and 3 thumbnail generations",
      "2 content calendar generations and 3 niche discovery analyses",
      "1 workspace, 1 brand kit, and solo creator workflow"
    ],
    coreUsage: {
      ideas: 5,
      scripts: 3,
      titles: 5,
      thumbnails: 3,
      tts: 0,
    },
    secondaryUsage: {
      contentCalendarGenerations: 2,
      nicheDiscoveryAnalyses: 3,
      trackedCompetitors: 3,
    },
    workspace: {
      workspaces: 1,
      brandKits: 1,
      collaborationLabel: "Solo owner",
      collaborationBoundary: "Single-user workspace with no API, webhook, or shared-ops support.",
      adminControls: ["Self-serve profile and billing only"],
    },
    snipRadar: {
      scheduledPostsPerWeek: 0,
      apiAccess: false,
      webhookAccess: false,
      analyticsLabel: "Discovery only",
    },
    supportLevel: "Self-serve docs",
  },
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For solo creators starting to systemize output",
    monthly: { USD: 9, INR: 699 },
    marketingFeatures: [
      "50 content ideas per month",
      "30 scripts, 100 title generations, and 15 thumbnail generations",
      "10 TTS generations per month",
      "1 workspace, 1 brand kit, and core SnipRadar drafting"
    ],
    coreUsage: {
      ideas: 50,
      scripts: 30,
      titles: 100,
      thumbnails: 15,
      tts: 10,
    },
    secondaryUsage: {
      contentCalendarGenerations: "unlimited",
      nicheDiscoveryAnalyses: "unlimited",
      trackedCompetitors: 5,
    },
    workspace: {
      workspaces: 1,
      brandKits: 1,
      collaborationLabel: "Solo owner",
      collaborationBoundary: "Single-user workspace intended for solo creator operations.",
      adminControls: ["Billing self-serve", "Single-brand workspace settings"],
    },
    snipRadar: {
      scheduledPostsPerWeek: 0,
      apiAccess: false,
      webhookAccess: false,
      analyticsLabel: "Core drafting and basic scheduling setup",
    },
    supportLevel: "Email support",
  },
  creator: {
    id: "creator",
    name: "Creator",
    tagline: "For active creators shipping every week",
    monthly: { USD: 18, INR: 1499 },
    marketingFeatures: [
      "Unlimited ideas, scripts, titles, thumbnails, and TTS",
      "10 scheduled posts per week in SnipRadar",
      "3 brand kits and advanced SnipRadar research",
      "Priority email support for always-on publishing workflows"
    ],
    coreUsage: {
      ideas: "unlimited",
      scripts: "unlimited",
      titles: "unlimited",
      thumbnails: "unlimited",
      tts: "unlimited",
    },
    secondaryUsage: {
      contentCalendarGenerations: "unlimited",
      nicheDiscoveryAnalyses: "unlimited",
      trackedCompetitors: 10,
    },
    workspace: {
      workspaces: 1,
      brandKits: 3,
      collaborationLabel: "Solo workflow",
      collaborationBoundary:
        "Built for a single creator/operator. Shared role controls and approvals are intentionally reserved for Studio positioning.",
      adminControls: ["Billing self-serve", "Multi-brand asset management"],
    },
    snipRadar: {
      scheduledPostsPerWeek: 10,
      apiAccess: false,
      webhookAccess: false,
      analyticsLabel: "Advanced research and analytics",
    },
    supportLevel: "Priority email support",
  },
  studio: {
    id: "studio",
    name: "Studio",
    tagline: "For teams, agencies, and high-volume workflows",
    monthly: { USD: 45, INR: 3599 },
    marketingFeatures: [
      "Everything in Creator plus unlimited scheduled posts",
      "Admin-managed team workspace operations and unlimited brand kits",
      "Public API and webhook access included",
      "Priority support with workspace implementation guidance"
    ],
    coreUsage: {
      ideas: "unlimited",
      scripts: "unlimited",
      titles: "unlimited",
      thumbnails: "unlimited",
      tts: "unlimited",
    },
    secondaryUsage: {
      contentCalendarGenerations: "unlimited",
      nicheDiscoveryAnalyses: "unlimited",
      trackedCompetitors: 25,
    },
    workspace: {
      workspaces: "unlimited",
      brandKits: "unlimited",
      collaborationLabel: "Admin-managed team seats",
      collaborationBoundary:
        "Studio covers multi-operator workspace operations, shared brand assets, billing ownership, and developer entitlements. Fine-grained RBAC and approval workflows remain a separate roadmap item.",
      adminControls: [
        "Billing owner controls",
        "Shared workspace operations",
        "API key management",
        "Webhook subscription management",
      ],
    },
    snipRadar: {
      scheduledPostsPerWeek: "unlimited",
      apiAccess: true,
      webhookAccess: true,
      analyticsLabel: "Workspace operations + developer integrations",
    },
    supportLevel: "Priority support + implementation handoff",
  },
};

export const PRICING_PLANS: PricingPlan[] = (["starter", "creator", "studio"] as PaidPlanTier[]).map((tier) => {
  const plan = COMMERCIAL_PLAN_CATALOG[tier];
  return {
    id: tier,
    name: plan.name,
    tagline: plan.tagline,
    monthly: plan.monthly,
    features: plan.marketingFeatures,
    isFeatured: tier === "creator",
  };
});

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    feature: "Core AI generation",
    starter: "50 ideas, 30 scripts, 100 titles, 15 thumbnails",
    creator: "Unlimited",
    studio: "Unlimited",
  },
  {
    feature: "Script TTS",
    starter: "10 generations/mo",
    creator: "Unlimited",
    studio: "Unlimited",
  },
  {
    feature: "Brand kit operations",
    starter: "1 brand kit",
    creator: "3 brand kits",
    studio: "Unlimited brand kits",
  },
  {
    feature: "SnipRadar scheduling",
    starter: "Drafting only",
    creator: "10 posts/week",
    studio: "Unlimited scheduled posts",
  },
  {
    feature: "Collaboration",
    starter: "Solo owner",
    creator: "Solo workflow",
    studio: "Admin-managed team operations",
  },
  {
    feature: "Developer access",
    starter: "—",
    creator: "—",
    studio: "API + webhooks included",
  },
  {
    feature: "Support",
    starter: "Email",
    creator: "Priority email",
    studio: "Priority support + implementation help",
  },
];

const PLAN_LOOKUP = new Map(
  Object.values(COMMERCIAL_PLAN_CATALOG).map((plan) => [plan.id, plan]),
);

export const PLAN_LIMITS = Object.fromEntries(
  Object.values(COMMERCIAL_PLAN_CATALOG).map((plan) => [
    plan.id,
    {
      ideas: toRuntimeLimit(plan.coreUsage.ideas),
      scripts: toRuntimeLimit(plan.coreUsage.scripts),
      titles: toRuntimeLimit(plan.coreUsage.titles),
      thumbnails: toRuntimeLimit(plan.coreUsage.thumbnails),
    },
  ]),
) as Record<PlanTier, Record<Extract<CoreUsageFeature, "ideas" | "scripts" | "titles" | "thumbnails">, number>>;

export const THUMBNAIL_GENERATION_LIMITS = Object.fromEntries(
  Object.values(COMMERCIAL_PLAN_CATALOG).map((plan) => [plan.id, toRuntimeLimit(plan.coreUsage.thumbnails)]),
) as Record<PlanTier, number>;

export function getCommercialPlan(planId: PlanTier) {
  return PLAN_LOOKUP.get(planId) ?? COMMERCIAL_PLAN_CATALOG.free;
}

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

export function getPlanById(planId: PaidPlanTier) {
  return PRICING_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function resolvePlanTier(value?: string | null): PlanTier {
  if (value === "starter" || value === "creator" || value === "studio") {
    return value;
  }
  return "free";
}

export function isPaidPlanTier(planId: string): planId is PaidPlanTier {
  return planId === "starter" || planId === "creator" || planId === "studio";
}

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency === "USD" || currency === "INR";
}

export function isBillingCycle(value: string): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}

export function isUnlimitedLimit(limit: CommercialLimitValue) {
  return limit === "unlimited";
}

export function toRuntimeLimit(limit: CommercialLimitValue) {
  return limit === "unlimited" ? Infinity : limit;
}

export function formatCommercialLimit(limit: CommercialLimitValue) {
  return isUnlimitedLimit(limit) ? "Unlimited" : String(limit);
}

export function serializeCommercialLimit(limit: CommercialLimitValue) {
  return isUnlimitedLimit(limit) ? -1 : limit;
}

export function getCoreUsageLimit(planId: PlanTier, feature: CoreUsageFeature) {
  return getCommercialPlan(planId).coreUsage[feature];
}

export function getRuntimeCoreUsageLimit(planId: PlanTier, feature: CoreUsageFeature) {
  return toRuntimeLimit(getCoreUsageLimit(planId, feature));
}

export function getSecondaryUsageLimit(planId: PlanTier, feature: SecondaryUsageFeature) {
  return getCommercialPlan(planId).secondaryUsage[feature];
}

export function getRuntimeSecondaryUsageLimit(planId: PlanTier, feature: SecondaryUsageFeature) {
  return toRuntimeLimit(getSecondaryUsageLimit(planId, feature));
}

export function planHasUnlimitedCoreUsage(planId: PlanTier) {
  const plan = getCommercialPlan(planId);
  return (["ideas", "scripts", "titles", "thumbnails"] as const).every((feature) =>
    isUnlimitedLimit(plan.coreUsage[feature]),
  );
}

export function formatPlanName(planId: PlanTier) {
  return getCommercialPlan(planId).name;
}

export function getTotalMonthlyCoreAllowance(planId: PlanTier) {
  const limits = getCommercialPlan(planId).coreUsage;
  const numericValues = Object.values(limits)
    .filter((limit) => !isUnlimitedLimit(limit))
    .map((limit) => limit as number);

  return numericValues.reduce((sum, limit) => sum + limit, 0);
}
