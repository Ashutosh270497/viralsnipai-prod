import {
  ACCESSIBILITY_BASELINE,
  getAccessibilityBaseline,
  getAccessibilityRequirement,
} from "@/lib/platform/accessibility-standards";

describe("accessibility baseline", () => {
  it("targets WCAG 2.1 AA as the minimum compliance baseline", () => {
    expect(getAccessibilityBaseline().target).toBe("wcag_2_1_aa");
    expect(ACCESSIBILITY_BASELINE.label).toContain("WCAG 2.1 AA");
  });

  it("defines the required core checks for release readiness", () => {
    expect(ACCESSIBILITY_BASELINE.requiredChecks.map((item) => item.id).sort()).toEqual(
      [
        "color_contrast",
        "dialog_focus_management",
        "form_labels_and_errors",
        "keyboard_navigation",
        "non_text_alternatives",
        "reduced_motion",
        "semantic_landmarks_and_headings",
        "touch_target_spacing",
        "visible_focus_states",
      ].sort(),
    );
  });

  it("documents that desktop-only surfaces are still bound by accessibility rules", () => {
    expect(ACCESSIBILITY_BASELINE.desktopOnlyExceptionPolicy).toContain("not from keyboard");
    expect(getAccessibilityRequirement("keyboard_navigation")?.label).toBe("Keyboard navigation");
  });
});
