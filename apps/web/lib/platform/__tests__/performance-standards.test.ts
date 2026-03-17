import {
  getApiLatencyBudgets,
  getJobRuntimeBudgets,
  getPerformanceStandards,
} from "@/lib/platform/performance-standards";

describe("performance standards", () => {
  it("defines API budgets with p50 and p95 targets", () => {
    for (const budget of getApiLatencyBudgets()) {
      expect(budget.p50Ms).toBeGreaterThan(0);
      expect(budget.p95Ms).toBeGreaterThanOrEqual(budget.p50Ms);
      expect(budget.notes.length).toBeGreaterThan(0);
    }
  });

  it("defines job expectations for synchronous and asynchronous workloads", () => {
    const standards = getPerformanceStandards();
    expect(standards.longRunningPromotionThresholdMs).toBe(5000);
    for (const budget of getJobRuntimeBudgets()) {
      expect(budget.targetCompletionMs).toBeGreaterThan(0);
      expect(budget.maxCompletionMs).toBeGreaterThanOrEqual(budget.targetCompletionMs);
    }
  });

  it("keeps export render and voice translation as acknowledged async jobs", () => {
    const exportRender = getJobRuntimeBudgets().find((budget) => budget.id === "export_render");
    const voiceTranslation = getJobRuntimeBudgets().find(
      (budget) => budget.id === "voice_translation",
    );

    expect(exportRender?.interactionMode).toBe("async");
    expect(exportRender?.acknowledgeWithinMs).toBe(5000);
    expect(voiceTranslation?.interactionMode).toBe("async");
    expect(voiceTranslation?.acknowledgeWithinMs).toBe(5000);
  });
});
