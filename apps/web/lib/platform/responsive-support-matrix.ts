export type ResponsiveSupportLevel =
  | "mobile_supported"
  | "mobile_degraded"
  | "desktop_only";

export type ExperienceSurfaceId =
  | "marketing_pricing"
  | "creator_dashboard_home"
  | "creator_content_calendar"
  | "creator_script_generator"
  | "creator_thumbnail_generator"
  | "snipradar_overview"
  | "snipradar_create"
  | "snipradar_inbox"
  | "repurpose_ingest"
  | "repurpose_editor"
  | "repurpose_export";

export type ExperienceSurfaceArea = "platform" | "creator" | "snipradar" | "repurpose";

export interface ResponsiveSurfaceDefinition {
  id: ExperienceSurfaceId;
  label: string;
  area: ExperienceSurfaceArea;
  primaryPath: string;
  supportLevel: ResponsiveSupportLevel;
  rationale: string;
  highestTraffic: boolean;
  remediationPriority: "p0" | "p1" | "p2";
}

export const RESPONSIVE_SUPPORT_LEVEL_LABELS: Record<ResponsiveSupportLevel, string> = {
  mobile_supported: "Mobile Supported",
  mobile_degraded: "Mobile Degraded",
  desktop_only: "Desktop Only",
};

export const RESPONSIVE_SUPPORT_MATRIX: Record<ExperienceSurfaceId, ResponsiveSurfaceDefinition> = {
  marketing_pricing: {
    id: "marketing_pricing",
    label: "Marketing + Pricing",
    area: "platform",
    primaryPath: "/",
    supportLevel: "mobile_supported",
    rationale:
      "The landing and pricing surfaces are expected to convert cold traffic on mobile and already use stacked marketing navigation patterns.",
    highestTraffic: true,
    remediationPriority: "p0",
  },
  creator_dashboard_home: {
    id: "creator_dashboard_home",
    label: "Creator Dashboard",
    area: "creator",
    primaryPath: "/dashboard",
    supportLevel: "mobile_supported",
    rationale:
      "The main dashboard cards already collapse from multi-column to stacked layouts and should remain usable on phones and tablets.",
    highestTraffic: true,
    remediationPriority: "p0",
  },
  creator_content_calendar: {
    id: "creator_content_calendar",
    label: "Content Calendar",
    area: "creator",
    primaryPath: "/dashboard/content-calendar",
    supportLevel: "mobile_degraded",
    rationale:
      "The calendar and side panels collapse, but dense planning controls and multi-pane review remain easier on desktop.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  creator_script_generator: {
    id: "creator_script_generator",
    label: "Script Generator",
    area: "creator",
    primaryPath: "/dashboard/script-generator",
    supportLevel: "mobile_degraded",
    rationale:
      "Script generation works on smaller screens, but the editor, revision flows, and multi-panel review experience are still optimized for desktop.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  creator_thumbnail_generator: {
    id: "creator_thumbnail_generator",
    label: "Thumbnail Generator",
    area: "creator",
    primaryPath: "/dashboard/thumbnail-generator",
    supportLevel: "mobile_supported",
    rationale:
      "The input/results split already collapses cleanly and the surface is expected to support quick review on smaller screens.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  snipradar_overview: {
    id: "snipradar_overview",
    label: "SnipRadar Overview",
    area: "snipradar",
    primaryPath: "/snipradar/overview",
    supportLevel: "mobile_supported",
    rationale:
      "Overview cards and activation guidance stack vertically and should stay readable on mobile for lightweight monitoring.",
    highestTraffic: true,
    remediationPriority: "p0",
  },
  snipradar_create: {
    id: "snipradar_create",
    label: "SnipRadar Create",
    area: "snipradar",
    primaryPath: "/snipradar/create/drafts",
    supportLevel: "mobile_degraded",
    rationale:
      "The tabbed create workspace is available on mobile, but dense drafting, predictor, and variant workflows remain better suited to desktop widths.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  snipradar_inbox: {
    id: "snipradar_inbox",
    label: "SnipRadar Inbox",
    area: "snipradar",
    primaryPath: "/snipradar/inbox",
    supportLevel: "mobile_degraded",
    rationale:
      "Inbox review works on narrow layouts, but multi-action triage and long capture review still need more compact mobile affordances.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  repurpose_ingest: {
    id: "repurpose_ingest",
    label: "RepurposeOS Ingest",
    area: "repurpose",
    primaryPath: "/repurpose",
    supportLevel: "mobile_degraded",
    rationale:
      "Basic ingest entry and empty states render on smaller screens, but media upload, project selection, and highlight-detection workflows are still desktop-leaning.",
    highestTraffic: true,
    remediationPriority: "p1",
  },
  repurpose_editor: {
    id: "repurpose_editor",
    label: "RepurposeOS Editor",
    area: "repurpose",
    primaryPath: "/repurpose/editor",
    supportLevel: "desktop_only",
    rationale:
      "The transcript editor, clip sidebar, preview region, and selection workflow require desktop-style space and precision interactions.",
    highestTraffic: true,
    remediationPriority: "p0",
  },
  repurpose_export: {
    id: "repurpose_export",
    label: "RepurposeOS Export + Translate",
    area: "repurpose",
    primaryPath: "/repurpose/export",
    supportLevel: "desktop_only",
    rationale:
      "Export configuration, translation controls, and preview-heavy review flows are operationally desktop-first even though the page renders responsively.",
    highestTraffic: true,
    remediationPriority: "p0",
  },
};

export function getResponsiveSupportMatrix() {
  return Object.values(RESPONSIVE_SUPPORT_MATRIX);
}

export function getResponsiveSurfaceDefinition(id: ExperienceSurfaceId) {
  return RESPONSIVE_SUPPORT_MATRIX[id];
}

export function getResponsiveSupportSummary() {
  return getResponsiveSupportMatrix().reduce(
    (summary, surface) => {
      summary[surface.supportLevel] += 1;
      return summary;
    },
    {
      mobile_supported: 0,
      mobile_degraded: 0,
      desktop_only: 0,
    } satisfies Record<ResponsiveSupportLevel, number>,
  );
}

export function getDesktopOnlySurfaces() {
  return getResponsiveSupportMatrix().filter((surface) => surface.supportLevel === "desktop_only");
}
