import { getBillingPlan } from "@/config/plans";
import type {
  BillingFeatureName,
  BillingPlanId,
  BillingPlanLimits,
  BillingUsageAction,
  BillingUsageCheckResult,
  BillingUsageSnapshot,
} from "@/types/billing";

export function canAccessFeatureByPlan(planId: BillingPlanId, featureName: BillingFeatureName) {
  const limits = getBillingPlan(planId).limits;
  switch (featureName) {
    case "tracker":
      return limits.trackedAccounts !== 0;
    case "viralFeed":
      return limits.viralFeedFetches !== 0;
    case "drafts":
      return limits.drafts !== 0;
    case "templates":
      return limits.templates !== 0;
    case "hookGenerations":
      return limits.hookGenerations !== 0;
    case "scheduling":
      return limits.scheduling !== false;
    case "analytics":
      return limits.analytics !== false;
    case "growthPlanAI":
      return limits.growthPlanAI;
    case "variantLab":
      return limits.variantLab;
    case "researchCopilot":
      return limits.researchCopilot;
    case "engagementFinder":
      return limits.engagementFinder !== false;
    case "relationships":
      return limits.relationships;
    case "activityCenterPriority":
      return limits.activityCenterPriority;
    case "whitelabelExports":
      return limits.whitelabelExports;
    default:
      return false;
  }
}

export function getRequiredPlanForFeature(featureName: BillingFeatureName): BillingPlanId {
  switch (featureName) {
    case "tracker":
    case "viralFeed":
    case "templates":
    case "hookGenerations":
    case "scheduling":
    case "variantLab":
    case "researchCopilot":
    case "engagementFinder":
      return "plus";
    case "analytics":
    case "growthPlanAI":
    case "relationships":
    case "activityCenterPriority":
      return "pro";
    case "whitelabelExports":
      return "pro";
    case "drafts":
    default:
      return "free";
  }
}

export function evaluateUsageLimit(
  limits: BillingPlanLimits,
  usage: BillingUsageSnapshot,
  action: BillingUsageAction,
  amount = 1,
): BillingUsageCheckResult {
  const evaluate = (limitValue: number | "unlimited", used: number) => {
    if (limitValue === "unlimited") {
      return { allowed: true, remaining: "unlimited" as const };
    }
    const remaining = Math.max(0, limitValue - used);
    return {
      allowed: remaining >= amount,
      remaining,
    };
  };

  switch (action) {
    case "viral_fetch":
      return evaluate(limits.viralFeedFetches, usage.viralFeedFetches);
    case "hook_gen":
      return evaluate(limits.hookGenerations, usage.hookGenerations);
    case "scheduled_post":
      if (limits.scheduling === false) return { allowed: false, remaining: 0 };
      return evaluate(limits.scheduling.monthlyPosts, usage.scheduledPosts);
    case "engagement_opp":
      if (limits.engagementFinder === false) return { allowed: false, remaining: 0 };
      return evaluate(limits.engagementFinder.monthlyOpportunities, usage.engagementOpps);
    default:
      return { allowed: true, remaining: "unlimited" };
  }
}
