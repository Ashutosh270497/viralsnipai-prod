export type DeliveryStatus =
  | "scaffolded"
  | "built"
  | "qa_complete"
  | "production_ready"
  | "deferred";

export interface DeliveryStatusDefinition {
  id: DeliveryStatus;
  label: string;
  definition: string;
  exitCriteria: string[];
}

export const DELIVERY_STATUS_DEFINITIONS: Record<DeliveryStatus, DeliveryStatusDefinition> = {
  scaffolded: {
    id: "scaffolded",
    label: "Scaffolded",
    definition: "The structure, route, or component shell exists, but the feature is not yet functionally complete.",
    exitCriteria: [
      "Primary entrypoints exist.",
      "Types, schema, or UI shell are in place.",
      "Core user workflow is not complete or not yet usable end to end.",
    ],
  },
  built: {
    id: "built",
    label: "Built",
    definition: "The intended behavior exists and is usable, but operational hardening, coverage, or edge-case handling is still incomplete.",
    exitCriteria: [
      "Core workflow functions end to end.",
      "Primary happy path is implemented.",
      "Known hardening, QA, or operations follow-up remains.",
    ],
  },
  qa_complete: {
    id: "qa_complete",
    label: "QA Complete",
    definition: "Acceptance criteria and validation checks have passed, with failure states and recovery paths handled.",
    exitCriteria: [
      "Acceptance criteria are satisfied.",
      "Tests or verification checks cover the critical paths.",
      "Empty, loading, and failure states are handled.",
      "Known launch-blocking defects are closed.",
    ],
  },
  production_ready: {
    id: "production_ready",
    label: "Production Ready",
    definition: "The feature is ready to rely on in production with operational safeguards, rollback awareness, and no unresolved launch-blocking edge cases.",
    exitCriteria: [
      "Acceptance criteria remain satisfied under real rollout assumptions.",
      "Rollback or kill-switch path is known.",
      "Observability requirement is identified and wired into the release plan.",
      "Operational safeguards and user recovery paths are in place.",
      "No unresolved launch-blocking issues remain.",
    ],
  },
  deferred: {
    id: "deferred",
    label: "Deferred",
    definition: "The work is intentionally out of active scope and should not be presented as part of the current delivery commitment.",
    exitCriteria: [
      "The work is explicitly removed from the active phase or launch scope.",
      "Any user-facing references describe it as future or deferred work.",
    ],
  },
};

export function getDeliveryStatusDefinition(status: DeliveryStatus) {
  return DELIVERY_STATUS_DEFINITIONS[status];
}

export function getDeliveryStatusDefinitions() {
  return Object.values(DELIVERY_STATUS_DEFINITIONS);
}
