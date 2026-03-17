export type ApiLatencyBudgetId =
  | "marketing_read"
  | "workspace_summary_read"
  | "keyword_search_read"
  | "snipradar_summary_read"
  | "interactive_generation_mutation"
  | "job_status_refresh";

export interface ApiLatencyBudget {
  id: ApiLatencyBudgetId;
  label: string;
  p50Ms: number;
  p95Ms: number;
  notes: string;
}

export type JobRuntimeBudgetId =
  | "profile_audit"
  | "research_copilot_query"
  | "script_generation"
  | "thumbnail_generation"
  | "research_index_refresh"
  | "export_render"
  | "voice_translation";

export interface JobRuntimeBudget {
  id: JobRuntimeBudgetId;
  label: string;
  interactionMode: "sync" | "async";
  acknowledgeWithinMs: number | null;
  targetCompletionMs: number;
  maxCompletionMs: number;
  notes: string;
}

export interface PerformanceStandards {
  apiBudgets: ApiLatencyBudget[];
  jobBudgets: JobRuntimeBudget[];
  longRunningPromotionThresholdMs: number;
  releaseRequirement: string;
}

export const PERFORMANCE_STANDARDS: PerformanceStandards = {
  apiBudgets: [
    {
      id: "marketing_read",
      label: "Marketing / pricing read",
      p50Ms: 300,
      p95Ms: 1000,
      notes: "Cold landing pages and pricing reads should feel immediate on normal broadband and mobile.",
    },
    {
      id: "workspace_summary_read",
      label: "Workspace summary read",
      p50Ms: 800,
      p95Ms: 2000,
      notes:
        "Dashboard-style reads may aggregate multiple data sources, but should stay comfortably under two seconds at p95.",
    },
    {
      id: "keyword_search_read",
      label: "Keyword search read",
      p50Ms: 1000,
      p95Ms: 2500,
      notes:
        "Matches the current keyword runtime SLO and covers fresh search plus fallback paths under expected creator usage.",
    },
    {
      id: "snipradar_summary_read",
      label: "SnipRadar summary read",
      p50Ms: 700,
      p95Ms: 1500,
      notes:
        "Overview, inbox refresh, and analytics summary reads should stay fast enough for iterative creator workflows.",
    },
    {
      id: "interactive_generation_mutation",
      label: "Interactive generation mutation",
      p50Ms: 1500,
      p95Ms: 5000,
      notes:
        "If a user-facing generation request cannot acknowledge inside this budget, it should move to a job/status flow instead of blocking silently.",
    },
    {
      id: "job_status_refresh",
      label: "Job status refresh",
      p50Ms: 500,
      p95Ms: 1500,
      notes:
        "Activity, export status, and queue refresh endpoints should remain cheap even while background work is active.",
    },
  ],
  jobBudgets: [
    {
      id: "profile_audit",
      label: "SnipRadar profile audit",
      interactionMode: "sync",
      acknowledgeWithinMs: null,
      targetCompletionMs: 15000,
      maxCompletionMs: 30000,
      notes:
        "Live X reads plus AI analysis can exceed normal page reads, but should either finish within 30s or fall back cleanly.",
    },
    {
      id: "research_copilot_query",
      label: "Research Copilot query + brief",
      interactionMode: "sync",
      acknowledgeWithinMs: null,
      targetCompletionMs: 8000,
      maxCompletionMs: 15000,
      notes:
        "Hybrid search plus brief generation should stay interactive enough for drafting sessions without turning into a background job.",
    },
    {
      id: "script_generation",
      label: "Script generation",
      interactionMode: "sync",
      acknowledgeWithinMs: null,
      targetCompletionMs: 20000,
      maxCompletionMs: 45000,
      notes:
        "Long-form LLM generation may take tens of seconds, but it should still resolve with clear loading and failure handling.",
    },
    {
      id: "thumbnail_generation",
      label: "Thumbnail generation",
      interactionMode: "sync",
      acknowledgeWithinMs: null,
      targetCompletionMs: 30000,
      maxCompletionMs: 90000,
      notes:
        "Image generation is provider-bound and should surface progress; sustained waits beyond 90s should be treated as failure or retriable fallback.",
    },
    {
      id: "research_index_refresh",
      label: "SnipRadar research index refresh",
      interactionMode: "async",
      acknowledgeWithinMs: 5000,
      targetCompletionMs: 90000,
      maxCompletionMs: 300000,
      notes:
        "Index rebuilds should acknowledge quickly and finish in the background with visible status.",
    },
    {
      id: "export_render",
      label: "Repurpose export render",
      interactionMode: "async",
      acknowledgeWithinMs: 5000,
      targetCompletionMs: 600000,
      maxCompletionMs: 1800000,
      notes:
        "Exports are expected to run asynchronously; queueing should acknowledge fast, with ten minutes as the target and thirty as the outer bound.",
    },
    {
      id: "voice_translation",
      label: "Voice translation",
      interactionMode: "async",
      acknowledgeWithinMs: 5000,
      targetCompletionMs: 900000,
      maxCompletionMs: 2400000,
      notes:
        "Voice translation is an FFmpeg + TTS pipeline and should always move through explicit job status rather than blocking a page request.",
    },
  ],
  longRunningPromotionThresholdMs: 5000,
  releaseRequirement:
    "User-facing routes should stay within their p95 budget or move to an acknowledged background-job flow with explicit status and recovery messaging.",
};

export function getPerformanceStandards() {
  return PERFORMANCE_STANDARDS;
}

export function getApiLatencyBudgets() {
  return PERFORMANCE_STANDARDS.apiBudgets;
}

export function getJobRuntimeBudgets() {
  return PERFORMANCE_STANDARDS.jobBudgets;
}
