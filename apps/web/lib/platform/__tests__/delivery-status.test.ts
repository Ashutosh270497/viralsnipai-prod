import {
  DELIVERY_STATUS_DEFINITIONS,
  getDeliveryStatusDefinition,
  getDeliveryStatusDefinitions,
} from "@/lib/platform/delivery-status";

describe("delivery status definitions", () => {
  it("covers every allowed delivery status", () => {
    expect(Object.keys(DELIVERY_STATUS_DEFINITIONS).sort()).toEqual([
      "built",
      "deferred",
      "production_ready",
      "qa_complete",
      "scaffolded",
    ]);
  });

  it("provides exit criteria for each delivery status", () => {
    for (const definition of getDeliveryStatusDefinitions()) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.definition.length).toBeGreaterThan(0);
      expect(definition.exitCriteria.length).toBeGreaterThan(0);
    }
  });

  it("returns a specific definition by key", () => {
    expect(getDeliveryStatusDefinition("production_ready").label).toBe("Production Ready");
  });
});
