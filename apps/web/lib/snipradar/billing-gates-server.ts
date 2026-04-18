import {
  checkTrackedAccountLimit,
  checkUsageLimit,
  getCurrentSubscriptionState,
} from "@/lib/billing";
import { getRequiredPlanForFeature } from "@/lib/billing/access";
import { snipradarErrorResponse } from "@/lib/snipradar/api-errors";
import {
  getAnalyticsWindowDaysFromState,
  getNextBillingPlan,
  type SnipRadarBillingGateDetails,
} from "@/lib/snipradar/billing-gates";
import type {
  BillingFeatureName,
  BillingSubscriptionState,
  BillingUsageAction,
  BillingUsageCheckResult,
} from "@/types/billing";

type GateSuccess = {
  ok: true;
  state: BillingSubscriptionState;
};

type GateFailure = {
  ok: false;
  state: BillingSubscriptionState;
  response: Response;
};

function buildUpgradeDetails(
  state: BillingSubscriptionState,
  feature: BillingFeatureName
): SnipRadarBillingGateDetails {
  return {
    kind: "upgrade_required",
    feature,
    currentPlan: state.plan.id,
    requiredPlan: getRequiredPlanForFeature(feature),
    upgradePlan: getNextBillingPlan(state.plan.id),
    analyticsWindowDays:
      feature === "analytics" ? getAnalyticsWindowDaysFromState(state) : undefined,
    suggestedPeriodDays:
      feature === "analytics" && getAnalyticsWindowDaysFromState(state) > 0
        ? (getAnalyticsWindowDaysFromState(state) as 7 | 30 | 90)
        : undefined,
  };
}

function buildUsageDetails(
  state: BillingSubscriptionState,
  action: BillingUsageAction,
  result: BillingUsageCheckResult,
  limit: number | "unlimited" | string | false | null,
  feature?: BillingFeatureName
): SnipRadarBillingGateDetails {
  return {
    kind: "usage_limit_reached",
    action,
    feature,
    currentPlan: state.plan.id,
    requiredPlan: getNextBillingPlan(state.plan.id),
    upgradePlan: getNextBillingPlan(state.plan.id),
    remaining: result.remaining,
    limit,
  };
}

function usageLimitValue(state: BillingSubscriptionState, action: BillingUsageAction) {
  switch (action) {
    case "viral_fetch":
      return state.limits.viralFeedFetches;
    case "hook_gen":
      return state.limits.hookGenerations;
    case "scheduled_post":
      return state.limits.scheduling === false ? false : state.limits.scheduling.monthlyPosts;
    case "engagement_opp":
      return state.limits.engagementFinder === false
        ? false
        : state.limits.engagementFinder.monthlyOpportunities;
    default:
      return null;
  }
}

export async function loadSnipRadarBillingState(userId: string) {
  return getCurrentSubscriptionState(userId);
}

export async function requireSnipRadarFeature(
  userId: string,
  feature: BillingFeatureName,
  message?: string
): Promise<GateSuccess | GateFailure> {
  const state = await loadSnipRadarBillingState(userId);
  const allowed = feature === "tracker"
    ? state.limits.trackedAccounts !== 0
    : feature === "viralFeed"
      ? state.limits.viralFeedFetches !== 0
      : feature === "hookGenerations"
        ? state.limits.hookGenerations !== 0
        : feature === "scheduling"
          ? state.limits.scheduling !== false
          : feature === "analytics"
            ? state.limits.analytics !== false
            : feature === "growthPlanAI"
              ? state.limits.growthPlanAI
              : feature === "variantLab"
                ? state.limits.variantLab
                : feature === "researchCopilot"
                  ? state.limits.researchCopilot
                  : feature === "engagementFinder"
                    ? state.limits.engagementFinder !== false
                    : true;

  if (allowed) {
    return { ok: true, state };
  }

  const details = buildUpgradeDetails(state, feature);
  return {
    ok: false,
    state,
    response: snipradarErrorResponse(
      message ?? "Your current plan does not include this feature.",
      403,
      {
        code: "UPGRADE_REQUIRED",
        retryable: false,
        details,
      }
    ),
  };
}

export async function requireSnipRadarUsage(
  userId: string,
  action: BillingUsageAction,
  options?: {
    amount?: number;
    feature?: BillingFeatureName;
    message?: string;
  }
): Promise<GateSuccess | GateFailure> {
  const state = await loadSnipRadarBillingState(userId);
  const result = await checkUsageLimit(userId, action, options?.amount ?? 1);
  if (result.allowed) {
    return { ok: true, state };
  }

  const details = buildUsageDetails(
    state,
    action,
    result,
    usageLimitValue(state, action),
    options?.feature
  );
  return {
    ok: false,
    state,
    response: snipradarErrorResponse(
      options?.message ?? "This plan limit has been reached.",
      403,
      {
        code: "USAGE_LIMIT_REACHED",
        retryable: false,
        details,
      }
    ),
  };
}

export async function requireSnipRadarTrackedAccountCapacity(
  userId: string,
  message?: string
): Promise<GateSuccess | GateFailure> {
  const state = await loadSnipRadarBillingState(userId);
  const result = await checkTrackedAccountLimit(userId);
  if (result.allowed) {
    return { ok: true, state };
  }

  const details: SnipRadarBillingGateDetails = {
    kind: "usage_limit_reached",
    feature: "tracker",
    currentPlan: state.plan.id,
    requiredPlan: getNextBillingPlan(state.plan.id),
    upgradePlan: getNextBillingPlan(state.plan.id),
    remaining: result.remaining,
    limit: state.limits.trackedAccounts,
  };
  return {
    ok: false,
    state,
    response: snipradarErrorResponse(
      message ?? "Tracked account limit reached for your current plan.",
      403,
      {
        code: "USAGE_LIMIT_REACHED",
        retryable: false,
        details,
      }
    ),
  };
}
