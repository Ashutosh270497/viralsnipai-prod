export type AccessibilityComplianceTarget = "wcag_2_1_aa";

export type AccessibilityRequirementId =
  | "semantic_landmarks_and_headings"
  | "keyboard_navigation"
  | "visible_focus_states"
  | "color_contrast"
  | "form_labels_and_errors"
  | "dialog_focus_management"
  | "non_text_alternatives"
  | "reduced_motion"
  | "touch_target_spacing";

export type AccessibilityVerificationMethod = "manual" | "automated" | "hybrid";

export interface AccessibilityRequirement {
  id: AccessibilityRequirementId;
  label: string;
  description: string;
  verification: AccessibilityVerificationMethod;
}

export interface AccessibilityBaseline {
  target: AccessibilityComplianceTarget;
  label: string;
  releaseRequirement: string;
  desktopOnlyExceptionPolicy: string;
  requiredChecks: AccessibilityRequirement[];
}

export const ACCESSIBILITY_BASELINE: AccessibilityBaseline = {
  target: "wcag_2_1_aa",
  label: "WCAG 2.1 AA minimum baseline",
  releaseRequirement:
    "Features should not be marked QA Complete or Production Ready unless keyboard, focus, contrast, form, dialog, and non-text alternatives are checked for the relevant surfaces.",
  desktopOnlyExceptionPolicy:
    "Desktop-only workflows are exempt from narrow-screen support, but not from keyboard access, focus visibility, readable contrast, dialog handling, or semantic labeling.",
  requiredChecks: [
    {
      id: "semantic_landmarks_and_headings",
      label: "Semantic landmarks and heading order",
      description:
        "Pages should expose a logical heading hierarchy and appropriate landmark roles so screen readers can navigate them predictably.",
      verification: "hybrid",
    },
    {
      id: "keyboard_navigation",
      label: "Keyboard navigation",
      description:
        "Primary flows must work without a mouse, including navigation, menus, tabs, dialogs, and action buttons.",
      verification: "manual",
    },
    {
      id: "visible_focus_states",
      label: "Visible focus states",
      description:
        "Focusable controls must retain a visible focus indicator that meets contrast expectations and is not removed by custom styling.",
      verification: "manual",
    },
    {
      id: "color_contrast",
      label: "Color contrast",
      description:
        "Normal text should meet 4.5:1 contrast, and UI state cues should not rely on color alone.",
      verification: "hybrid",
    },
    {
      id: "form_labels_and_errors",
      label: "Form labels and error messaging",
      description:
        "Inputs require programmatic labels, inline help where needed, and clear error states that can be announced to assistive tech.",
      verification: "hybrid",
    },
    {
      id: "dialog_focus_management",
      label: "Dialog and overlay focus management",
      description:
        "Dialogs, sheets, and overlays must trap focus, restore focus on close, and expose accessible titles or descriptions.",
      verification: "manual",
    },
    {
      id: "non_text_alternatives",
      label: "Non-text alternatives",
      description:
        "Meaningful images, icons, charts, and media controls require alt text, labels, or nearby textual equivalents.",
      verification: "hybrid",
    },
    {
      id: "reduced_motion",
      label: "Reduced-motion respect",
      description:
        "Animations should respect prefers-reduced-motion and avoid essential information being delivered only through motion.",
      verification: "manual",
    },
    {
      id: "touch_target_spacing",
      label: "Touch target sizing on supported mobile surfaces",
      description:
        "Mobile-supported or mobile-degraded surfaces should keep primary touch targets comfortably tappable and avoid overlapping controls.",
      verification: "manual",
    },
  ],
};

export function getAccessibilityBaseline() {
  return ACCESSIBILITY_BASELINE;
}

export function getAccessibilityRequirement(id: AccessibilityRequirementId) {
  return ACCESSIBILITY_BASELINE.requiredChecks.find((requirement) => requirement.id === id) ?? null;
}
