import {
  getDesktopOnlySurfaces,
  getResponsiveSupportMatrix,
  RESPONSIVE_SUPPORT_LEVEL_LABELS,
  RESPONSIVE_SUPPORT_MATRIX,
} from "@/lib/platform/responsive-support-matrix";

describe("responsive support matrix", () => {
  it("covers the highest-traffic experience surfaces called out in the Phase 4 plan", () => {
    expect(Object.keys(RESPONSIVE_SUPPORT_MATRIX).sort()).toEqual(
      [
        "creator_content_calendar",
        "creator_dashboard_home",
        "creator_script_generator",
        "creator_thumbnail_generator",
        "marketing_pricing",
        "repurpose_editor",
        "repurpose_export",
        "repurpose_ingest",
        "snipradar_create",
        "snipradar_inbox",
        "snipradar_overview",
      ].sort(),
    );
  });

  it("only uses supported responsive support labels", () => {
    for (const surface of getResponsiveSupportMatrix()) {
      expect(RESPONSIVE_SUPPORT_LEVEL_LABELS[surface.supportLevel]).toBeTruthy();
      expect(surface.rationale.length).toBeGreaterThan(0);
    }
  });

  it("keeps explicit desktop-only exceptions for the heavy repurpose surfaces", () => {
    const desktopOnlyIds = getDesktopOnlySurfaces().map((surface) => surface.id).sort();
    expect(desktopOnlyIds).toEqual(["repurpose_editor", "repurpose_export"]);
  });
});
