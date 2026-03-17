export type BillingPlanId = "free" | "plus" | "pro";
export type BillingRegion = "IN" | "GLOBAL";
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "pending" | "trialing";
export type BillingUsageAction = "viral_fetch" | "hook_gen" | "scheduled_post" | "engagement_opp";
export type BillingLimitValue = number | "unlimited";
export type BillingFeatureName =
  | "tracker"
  | "viralFeed"
  | "drafts"
  | "templates"
  | "hookGenerations"
  | "scheduling"
  | "analytics"
  | "growthPlanAI"
  | "variantLab"
  | "researchCopilot"
  | "engagementFinder"
  | "relationships"
  | "activityCenterPriority"
  | "whitelabelExports";

export type BillingAnalyticsAccess = false | "7d" | "30d + export" | "30d + export + client reports";

export type BillingSchedulingAccess = false | { monthlyPosts: BillingLimitValue };

export type BillingEngagementFinderAccess = false | { monthlyOpportunities: BillingLimitValue };

export interface BillingPlanLimits {
  trackedAccounts: BillingLimitValue;
  connectedXAccounts: BillingLimitValue;
  seats: BillingLimitValue;
  viralFeedFetches: BillingLimitValue;
  drafts: BillingLimitValue;
  templates: BillingLimitValue;
  hookGenerations: BillingLimitValue;
  scheduling: BillingSchedulingAccess;
  analytics: BillingAnalyticsAccess;
  growthPlanAI: boolean;
  variantLab: boolean;
  researchCopilot: boolean;
  engagementFinder: BillingEngagementFinderAccess;
  relationships: boolean;
  activityCenterPriority: boolean;
  whitelabelExports: boolean;
}

export interface BillingPlanDefinition {
  id: BillingPlanId;
  name: string;
  priceINR: number;
  priceUSD: number;
  razorpayPlanIds: Record<BillingRegion, string>;
  legacyAliases: string[];
  features: string[];
  limits: BillingPlanLimits;
}

export interface PublicBillingPlanDefinition
  extends Omit<BillingPlanDefinition, "razorpayPlanIds" | "legacyAliases"> {}

export interface BillingSubscriptionRecord {
  id: string;
  userId: string;
  planId: BillingPlanId;
  status: SubscriptionStatus;
  billingRegion: BillingRegion;
  razorpaySubscriptionId: string | null;
  razorpayCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  promoCode: string | null;
  freeMonthsCredit: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingUsageTrackingRecord {
  id: string;
  userId: string;
  month: string;
  viralFetches: number;
  hookGenerations: number;
  scheduledPosts: number;
  engagementOpps: number;
  updatedAt: string;
}

export interface BillingUsageSnapshot {
  trackedAccounts: number;
  connectedXAccounts: number;
  drafts: number;
  viralFeedFetches: number;
  hookGenerations: number;
  scheduledPosts: number;
  engagementOpps: number;
  templatesUnlocked: number;
}

export interface BillingSubscriptionState {
  plan: PublicBillingPlanDefinition;
  status: SubscriptionStatus;
  billingRegion: BillingRegion;
  limits: BillingPlanLimits;
  usage: BillingUsageSnapshot;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  recommendedRegion: BillingRegion;
  freeMonthsCredit: number;
  promoCode: string | null;
  referralCode: string | null;
  referredBy: string | null;
  currentProvider: "razorpay" | "free";
  plans: PublicBillingPlanDefinition[];
}

export interface BillingUsageCheckResult {
  allowed: boolean;
  remaining: number | "unlimited";
}

export interface BillingPromoDefinition {
  code: string;
  description: string;
  planIds: BillingPlanId[];
  type: "percent_forever" | "percent_months";
  percentOff: number;
  months?: number;
  maxRedemptions?: number;
}
