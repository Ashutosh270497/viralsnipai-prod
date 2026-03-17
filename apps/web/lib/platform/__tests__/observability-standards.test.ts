import {
  ALERT_OWNERSHIP,
  getAlertOwnershipDefinitions,
  getObservabilitySignalDefinitions,
  OBSERVABILITY_SIGNAL_DEFINITIONS,
} from "@/lib/platform/observability-standards";

describe("observability standards", () => {
  it("defines the required observability signals", () => {
    expect(Object.keys(OBSERVABILITY_SIGNAL_DEFINITIONS).sort()).toEqual(
      ["alerting", "error_tracking", "performance_monitoring", "product_analytics"].sort(),
    );
  });

  it("includes implementation notes and production requirements for every signal", () => {
    for (const definition of getObservabilitySignalDefinitions()) {
      expect(definition.currentImplementation.length).toBeGreaterThan(0);
      expect(definition.productionRequirement.length).toBeGreaterThan(0);
    }
  });

  it("assigns alert ownership across the major operating domains", () => {
    expect(Object.keys(ALERT_OWNERSHIP).sort()).toEqual(
      ["billing", "creator", "growth", "media_processing", "platform"].sort(),
    );
    expect(getAlertOwnershipDefinitions().every((item) => item.escalationPath.length > 0)).toBe(
      true,
    );
  });
});
