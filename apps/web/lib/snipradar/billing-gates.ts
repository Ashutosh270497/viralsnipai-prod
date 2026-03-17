import type {
  BillingAnalyticsAccess,
  BillingFeatureName,
  BillingPlanId,
  BillingSubscriptionState,
  BillingUsageAction,
} from "@/types/billing";
import { SnipRadarApiError } from "@/lib/snipradar/client-errors";

export type SnipRadarBillingGateKind = "upgrade_required" | "usage_limit_reached";

export type SnipRadarBillingGateDetails = {
  kind: SnipRadarBillingGateKind;
  feature?: BillingFeatureName;
  action?: BillingUsageAction;
  currentPlan: BillingPlanId;
  requiredPlan: BillingPlanId | null;
  upgradePlan: BillingPlanId | null;
  remaining?: number | "unlimited";
  limit?: number | "unlimited" | string | false | null;
  analyticsWindowDays?: 0 | 7 | 30;
  suggestedPeriodDays?: 7 | 30;
};

const FEATURE_LABELS: Partial<Record<BillingFeatureName, string>> = {
  tracker: "tracked accounts",
  viralFeed: "viral feed refresh",
  hookGenerations: "hook generation",
  scheduling: "smart scheduling",
  analytics: "analytics",
  growthPlanAI: "Growth Planner",
  variantLab: "Variant Lab",
  researchCopilot: "Research Copilot",
  engagementFinder: "Engagement Finder",
};

const ACTION_LABELS: Record<BillingUsageAction, string> = {
  viral_fetch: "viral feed refreshes",
  hook_gen: "hook generations",
  scheduled_post: "scheduled posts",
  engagement_opp: "engagement opportunities",
};

export function getNextBillingPlan(planId: BillingPlanId): BillingPlanId | null {
  if (planId === "free") return "plus";
  if (planId === "plus") return "pro";
  return null;
}

export function getBillingPlanLabel(planId: BillingPlanId | null | undefined): string | null {
  if (!planId) return null;
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

export function getAnalyticsWindowDays(access: BillingAnalyticsAccess): 0 | 7 | 30 {
  if (access === false) return 0;
  if (access === "7d") return 7;
  return 30;
}

export function getAnalyticsWindowDaysFromState(state: BillingSubscriptionState): 0 | 7 | 30 {
  return getAnalyticsWindowDays(state.limits.analytics);
}

export function formatBillingLimitValue(
  value: number | "unlimited" | string | false | null | undefined
): string | null {
  if (value === undefined || value === null || value === false) return null;
  if (value === "unlimited") return "unlimited";
  return String(value);
}

export function getSnipRadarBillingGateTitle(details: SnipRadarBillingGateDetails): string {
  if (details.kind === "upgrade_required") {
    const featureLabel =
      (details.feature ? FEATURE_LABELS[details.feature] : null) ??
      (details.action ? ACTION_LABELS[details.action] : null) ??
      "this feature";
    return `Unlock ${featureLabel}`;
  }

  const actionLabel =
    (details.action ? ACTION_LABELS[details.action] : null) ??
    (details.feature ? FEATURE_LABELS[details.feature] : null) ??
    "this limit";
  return `${capitalize(actionLabel)} limit reached`;
}

export function getSnipRadarBillingGateDescription(details: SnipRadarBillingGateDetails): string {
  const currentPlanLabel = getBillingPlanLabel(details.currentPlan) ?? "your current";
  const upgradePlanLabel = getBillingPlanLabel(details.upgradePlan);
  const usageSubject =
    (details.action ? ACTION_LABELS[details.action] : null) ??
    (details.feature ? FEATURE_LABELS[details.feature] : null) ??
    "usage";

  if (details.feature === "analytics" && typeof details.analyticsWindowDays === "number") {
    if (details.analyticsWindowDays === 0) {
      return upgradePlanLabel
        ? `Analytics is not included on ${currentPlanLabel}. Upgrade to ${upgradePlanLabel} to unlock performance reporting.`
        : `Analytics is not included on ${currentPlanLabel}.`;
    }

    return upgradePlanLabel
      ? `${currentPlanLabel} includes ${details.analyticsWindowDays}-day analytics. Upgrade to ${upgradePlanLabel} for a wider analytics window.`
      : `${currentPlanLabel} includes ${details.analyticsWindowDays}-day analytics.`;
  }

  if (details.kind === "upgrade_required") {
    const upgradeTarget = upgradePlanLabel ? ` Upgrade to ${upgradePlanLabel} to continue.` : "";
    return `${currentPlanLabel} does not include this workflow.${upgradeTarget}`;
  }

  const limitLabel = formatBillingLimitValue(details.limit);
  if (limitLabel) {
    return upgradePlanLabel
      ? `You have reached the ${limitLabel} ${usageSubject} included in ${currentPlanLabel}. Upgrade to ${upgradePlanLabel} for more capacity.`
      : `You have reached the ${limitLabel} ${usageSubject} included in ${currentPlanLabel}.`;
  }

  return upgradePlanLabel
    ? `This workflow has reached the limit for ${currentPlanLabel}. Upgrade to ${upgradePlanLabel} for more capacity.`
    : `This workflow has reached the limit for ${currentPlanLabel}.`;
}

export function getSnipRadarBillingGateCtaLabel(details: SnipRadarBillingGateDetails): string {
  const planLabel = getBillingPlanLabel(details.upgradePlan);
  return planLabel ? `Upgrade to ${planLabel}` : "View Plans";
}

export function getSnipRadarBillingGateDetails(value: unknown): SnipRadarBillingGateDetails | null {
  const details =
    value instanceof SnipRadarApiError
      ? (value as SnipRadarApiError).details
      : value instanceof Error && "details" in value
        ? (value as { details?: unknown }).details
        : value;

  if (!details || typeof details !== "object") return null;
  const candidate = details as Partial<SnipRadarBillingGateDetails>;
  if (candidate.kind !== "upgrade_required" && candidate.kind !== "usage_limit_reached") {
    return null;
  }
  if (
    candidate.currentPlan !== "free" &&
    candidate.currentPlan !== "plus" &&
    candidate.currentPlan !== "pro"
  ) {
    return null;
  }

  return {
    kind: candidate.kind,
    feature: candidate.feature,
    action: candidate.action,
    currentPlan: candidate.currentPlan,
    requiredPlan: candidate.requiredPlan ?? null,
    upgradePlan: candidate.upgradePlan ?? null,
    remaining: candidate.remaining,
    limit: candidate.limit,
    analyticsWindowDays: candidate.analyticsWindowDays,
    suggestedPeriodDays: candidate.suggestedPeriodDays,
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
