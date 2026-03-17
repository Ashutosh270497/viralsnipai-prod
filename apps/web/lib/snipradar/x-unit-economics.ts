export type XApiGuardrailState = "healthy" | "watch" | "high";

export interface XApiUnitEconomicsSummary {
  estimatedDailyReadCalls: number;
  estimatedDailyWriteCalls: number;
  trackedAccounts: number;
  hydrationCandidates: number;
  guardrailState: XApiGuardrailState;
  reasons: string[];
  packagingRecommendation: string;
  model: {
    viralFetchRunsPerDay: number;
    accountSummaryRefreshCallsPerDay: number;
    metricsHydrationBatchCap: number;
    readCallsPerTrackedAccountPerDay: number;
    trackedAccountsWatchThreshold: number;
    trackedAccountsHighThreshold: number;
  };
}

export interface XApiUnitEconomicsInput {
  trackedAccounts: number;
  hydrationCandidates?: number;
  scheduledDrafts?: number;
  manualPublishesPerDay?: number;
}

export const X_API_UNIT_ECONOMICS_MODEL = {
  viralFetchRunsPerDay: 4,
  accountSummaryRefreshCallsPerDay: 4,
  metricsHydrationBatchCap: 15,
  readCallsPerTrackedAccountPerDay: 4,
  trackedAccountsWatchThreshold: 12,
  trackedAccountsHighThreshold: 25,
} as const;

export function summarizeXApiUnitEconomics(
  input: XApiUnitEconomicsInput
): XApiUnitEconomicsSummary {
  const trackedAccounts = Math.max(0, input.trackedAccounts);
  const hydrationCandidates = Math.max(
    0,
    Math.min(
      input.hydrationCandidates ?? 0,
      X_API_UNIT_ECONOMICS_MODEL.metricsHydrationBatchCap
    )
  );
  const scheduledDrafts = Math.max(0, input.scheduledDrafts ?? 0);
  const manualPublishesPerDay = Math.max(0, input.manualPublishesPerDay ?? 0);

  const estimatedDailyReadCalls =
    trackedAccounts * X_API_UNIT_ECONOMICS_MODEL.readCallsPerTrackedAccountPerDay +
    X_API_UNIT_ECONOMICS_MODEL.accountSummaryRefreshCallsPerDay +
    hydrationCandidates;
  const estimatedDailyWriteCalls = scheduledDrafts + manualPublishesPerDay;

  const reasons: string[] = [];
  let guardrailState: XApiGuardrailState = "healthy";

  if (
    trackedAccounts >= X_API_UNIT_ECONOMICS_MODEL.trackedAccountsHighThreshold
  ) {
    guardrailState = "high";
    reasons.push(
      `Tracked accounts exceed the high-cost threshold (${X_API_UNIT_ECONOMICS_MODEL.trackedAccountsHighThreshold}).`
    );
  } else if (
    trackedAccounts >= X_API_UNIT_ECONOMICS_MODEL.trackedAccountsWatchThreshold
  ) {
    guardrailState = "watch";
    reasons.push(
      `Tracked accounts exceed the watch threshold (${X_API_UNIT_ECONOMICS_MODEL.trackedAccountsWatchThreshold}).`
    );
  }

  if (hydrationCandidates >= X_API_UNIT_ECONOMICS_MODEL.metricsHydrationBatchCap) {
    guardrailState = guardrailState === "high" ? "high" : "watch";
    reasons.push(
      "Tweet metrics hydration is running at the current batch cap and should be monitored."
    );
  }

  if (estimatedDailyReadCalls >= 140) {
    guardrailState = "high";
    reasons.push("Estimated daily X read load is above the current efficient operating target.");
  } else if (estimatedDailyReadCalls >= 70 && guardrailState === "healthy") {
    guardrailState = "watch";
    reasons.push("Estimated daily X read load is trending toward the watch zone.");
  }

  const packagingRecommendation =
    guardrailState === "high"
      ? "Gate high-frequency refreshes, cap tracked accounts, and reserve heavier usage for higher tiers."
      : guardrailState === "watch"
      ? "Monitor active tracked-account counts and keep reply assist / research workflows prioritized over bulk refresh."
      : "Current tracked-account volume is within the efficient operating envelope for the existing SnipRadar fetch cadence.";

  return {
    estimatedDailyReadCalls,
    estimatedDailyWriteCalls,
    trackedAccounts,
    hydrationCandidates,
    guardrailState,
    reasons,
    packagingRecommendation,
    model: X_API_UNIT_ECONOMICS_MODEL,
  };
}
