import { buildActivationSummary } from "../activation";

describe("buildActivationSummary", () => {
  it("marks creator activation complete once the first script is generated", () => {
    const summary = buildActivationSummary("creator", {
      creator_onboarding_started: {
        completed: true,
        completedAt: new Date("2026-03-01T10:00:00.000Z"),
        source: "derived",
      },
      creator_onboarding_completed: {
        completed: true,
        completedAt: new Date("2026-03-01T10:05:00.000Z"),
        source: "usage_log",
      },
      creator_first_content_idea_created: {
        completed: true,
        completedAt: new Date("2026-03-01T10:10:00.000Z"),
        source: "usage_log",
      },
      creator_first_script_generated: {
        completed: true,
        completedAt: new Date("2026-03-01T10:20:00.000Z"),
        source: "usage_log",
      },
    });

    expect(summary.activated).toBe(true);
    expect(summary.activationEventId).toBe("creator_first_script_generated");
    expect(summary.progressPct).toBeGreaterThanOrEqual(60);
    expect(summary.activationCompletedAt).toBe("2026-03-01T10:20:00.000Z");
  });

  it("surfaces the next SnipRadar step when only the X account is connected", () => {
    const summary = buildActivationSummary("snipradar", {
      snipradar_x_account_connected: {
        completed: true,
        completedAt: new Date("2026-03-01T09:00:00.000Z"),
        source: "usage_log",
      },
    });

    expect(summary.activated).toBe(false);
    expect(summary.nextStep?.id).toBe("snipradar_first_tracked_account_added");
    expect(summary.steps.find((step) => step.id === "snipradar_x_account_connected")?.completed).toBe(
      true
    );
  });
});
