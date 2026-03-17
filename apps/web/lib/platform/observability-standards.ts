export type ObservabilitySignalId =
  | "error_tracking"
  | "performance_monitoring"
  | "product_analytics"
  | "alerting";

export type AlertOwner = "platform" | "creator" | "growth" | "media_processing" | "billing";

export interface ObservabilitySignalDefinition {
  id: ObservabilitySignalId;
  label: string;
  owner: AlertOwner;
  currentImplementation: string[];
  productionRequirement: string;
}

export interface AlertOwnershipDefinition {
  owner: AlertOwner;
  scope: string;
  escalationPath: string;
}

export const OBSERVABILITY_SIGNAL_DEFINITIONS: Record<
  ObservabilitySignalId,
  ObservabilitySignalDefinition
> = {
  error_tracking: {
    id: "error_tracking",
    label: "Error tracking",
    owner: "platform",
    currentImplementation: [
      "Structured server logs via apps/web/lib/logger.ts",
      "Route-level error handling and logger.error calls across API surfaces",
      "Queue/job terminal failure persistence for media and scheduler flows",
    ],
    productionRequirement:
      "Unhandled route, queue, and integration failures must emit structured context-rich logs and be routable to an external collector or alert path before claiming Production Ready.",
  },
  performance_monitoring: {
    id: "performance_monitoring",
    label: "Performance monitoring",
    owner: "platform",
    currentImplementation: [
      "Server-Timing headers on selected routes",
      "Keyword runtime SLO collector in apps/web/lib/keywords/runtime-metrics.ts",
      "SnipRadar API telemetry sampling in apps/web/lib/snipradar/api-telemetry.ts",
      "Load-test scripts under apps/web/scripts/load/",
    ],
    productionRequirement:
      "Critical user-facing reads and long-running jobs should expose measurable latency or runtime signals so p50/p95 tracking and regressions are visible before release.",
  },
  product_analytics: {
    id: "product_analytics",
    label: "Product analytics",
    owner: "creator",
    currentImplementation: [
      "Client-side trackEvent hook in apps/web/lib/analytics.ts",
      "UsageLog-backed activation checkpoints in apps/web/lib/analytics/activation.ts",
      "Domain-specific event wrappers such as apps/web/lib/snipradar/events.ts",
    ],
    productionRequirement:
      "Activation-critical workflows should emit enough analytics to explain onboarding progress, conversion drop-off, and feature adoption without relying on ad hoc console inspection.",
  },
  alerting: {
    id: "alerting",
    label: "Alerting",
    owner: "growth",
    currentImplementation: [
      "SnipRadar telemetry and alert webhooks via SNIPRADAR_TELEMETRY_WEBHOOK_URL and SNIPRADAR_ALERT_WEBHOOK_URL",
      "Keyword runtime SLO thresholds via env-configured limits",
      "Feature-flag kill switches and rollback paths documented in the registry and PRD",
    ],
    productionRequirement:
      "Every production-critical domain should have an explicit alert owner and escalation path for failed billing, queue stalls, provider outages, or sustained latency regressions.",
  },
};

export const ALERT_OWNERSHIP: Record<AlertOwner, AlertOwnershipDefinition> = {
  platform: {
    owner: "platform",
    scope: "Authentication, workspace shell, route protection, and cross-product infrastructure.",
    escalationPath: "Primary owner responds first, then applies rollback or feature-flag mitigation if a platform path is unstable.",
  },
  creator: {
    owner: "creator",
    scope: "Dashboard, content calendar, script/title/thumbnail generation, and creator-specific analytics.",
    escalationPath: "Creator domain owner triages feature regression, then coordinates with platform if the issue is provider or infra related.",
  },
  growth: {
    owner: "growth",
    scope: "SnipRadar APIs, scheduler, extension, analytics, inbox, and X provider integrations.",
    escalationPath: "Growth owner investigates telemetry and webhook alerts, then disables affected SnipRadar surfaces via kill switch if required.",
  },
  media_processing: {
    owner: "media_processing",
    scope: "FFmpeg-backed export, ingest, voice translation, and other queue-driven media workloads.",
    escalationPath: "Media-processing owner investigates queue stalls, missing binaries, storage failures, and job retries before broader platform escalation.",
  },
  billing: {
    owner: "billing",
    scope: "Razorpay checkout, subscription sync, cancellation, and webhook reconciliation.",
    escalationPath: "Billing owner validates webhook health, customer/subscription state, and finance-impacting failures before platform rollback decisions.",
  },
};

export function getObservabilitySignalDefinitions() {
  return Object.values(OBSERVABILITY_SIGNAL_DEFINITIONS);
}

export function getObservabilitySignalDefinition(id: ObservabilitySignalId) {
  return OBSERVABILITY_SIGNAL_DEFINITIONS[id];
}

export function getAlertOwnershipDefinitions() {
  return Object.values(ALERT_OWNERSHIP);
}
