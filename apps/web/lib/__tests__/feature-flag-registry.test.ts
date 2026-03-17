import { FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { FEATURE_FLAG_REGISTRY, getFeatureFlagDefinitions } from "@/lib/feature-flag-registry";

describe("feature flag registry", () => {
  it("defines exactly one registry entry per known feature flag", () => {
    expect(Object.keys(FEATURE_FLAG_REGISTRY).sort()).toEqual([...FEATURE_FLAG_KEYS].sort());
  });

  it("includes env wiring and kill-switch guidance for every flag", () => {
    for (const definition of getFeatureFlagDefinitions()) {
      expect(definition.envVar.length).toBeGreaterThan(0);
      expect(typeof definition.defaultValue).toBe("boolean");
      expect(definition.killSwitchBehavior.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps the Veo flag documented as a kill switch", () => {
    expect(FEATURE_FLAG_REGISTRY.veoEnabled.stage).toBe("kill_switch");
    expect(FEATURE_FLAG_REGISTRY.veoEnabled.killSwitchBehavior).toContain("FORCE_VEO_ENABLED");
  });
});
