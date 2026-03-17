import {
  X_API_UNIT_ECONOMICS_MODEL,
  summarizeXApiUnitEconomics,
} from "../x-unit-economics";

describe("summarizeXApiUnitEconomics", () => {
  it("keeps low-volume accounts in the healthy zone", () => {
    const summary = summarizeXApiUnitEconomics({
      trackedAccounts: 4,
      hydrationCandidates: 2,
      scheduledDrafts: 1,
    });

    expect(summary.guardrailState).toBe("healthy");
    expect(summary.estimatedDailyReadCalls).toBe(
      4 * X_API_UNIT_ECONOMICS_MODEL.readCallsPerTrackedAccountPerDay +
        X_API_UNIT_ECONOMICS_MODEL.accountSummaryRefreshCallsPerDay +
        2
    );
  });

  it("moves into watch state at the tracked-account watch threshold", () => {
    const summary = summarizeXApiUnitEconomics({
      trackedAccounts: X_API_UNIT_ECONOMICS_MODEL.trackedAccountsWatchThreshold,
      hydrationCandidates: X_API_UNIT_ECONOMICS_MODEL.metricsHydrationBatchCap,
    });

    expect(summary.guardrailState).toBe("watch");
    expect(summary.reasons.length).toBeGreaterThan(0);
  });

  it("moves into high state at the high-cost threshold", () => {
    const summary = summarizeXApiUnitEconomics({
      trackedAccounts: X_API_UNIT_ECONOMICS_MODEL.trackedAccountsHighThreshold,
      hydrationCandidates: X_API_UNIT_ECONOMICS_MODEL.metricsHydrationBatchCap,
    });

    expect(summary.guardrailState).toBe("high");
  });
});
