import {
  COMMERCIAL_PLAN_CATALOG,
  PRICING_COMPARISON_ROWS,
  getCoreUsageLimit,
  getRuntimeSecondaryUsageLimit,
  planHasUnlimitedCoreUsage,
} from "@/lib/billing/plans";

describe("commercial model", () => {
  it("defines the reconciled free and starter creator quotas", () => {
    expect(getCoreUsageLimit("free", "scripts")).toBe(3);
    expect(getCoreUsageLimit("free", "thumbnails")).toBe(3);
    expect(getCoreUsageLimit("starter", "titles")).toBe(100);
    expect(getCoreUsageLimit("starter", "tts")).toBe(10);
  });

  it("marks creator and studio as unlimited for core creation workflows", () => {
    expect(planHasUnlimitedCoreUsage("creator")).toBe(true);
    expect(planHasUnlimitedCoreUsage("studio")).toBe(true);
    expect(planHasUnlimitedCoreUsage("starter")).toBe(false);
  });

  it("defines the studio commercial package without overstating self-serve RBAC", () => {
    expect(COMMERCIAL_PLAN_CATALOG.studio.snipRadar.apiAccess).toBe(true);
    expect(COMMERCIAL_PLAN_CATALOG.studio.snipRadar.webhookAccess).toBe(true);
    expect(COMMERCIAL_PLAN_CATALOG.studio.workspace.collaborationLabel).toBe(
      "Admin-managed team seats",
    );
    expect(getRuntimeSecondaryUsageLimit("studio", "trackedCompetitors")).toBe(25);
  });

  it("keeps the plan comparison rows aligned with the commercial packaging", () => {
    expect(PRICING_COMPARISON_ROWS.some((row) => row.feature === "Developer access")).toBe(true);
    expect(PRICING_COMPARISON_ROWS.some((row) => row.feature === "Collaboration")).toBe(true);
  });
});
