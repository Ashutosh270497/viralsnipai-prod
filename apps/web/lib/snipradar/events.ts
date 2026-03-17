import { trackEvent } from "@/lib/analytics";

type SnipRadarEventName =
  | "snipradar_overview_view"
  | "snipradar_overview_drafts_pill_click"
  | "snipradar_growth_coach_generate_click"
  | "snipradar_growth_coach_refresh_click"
  | "snipradar_growth_plan_generate_click"
  | "snipradar_growth_plan_generated"
  | "snipradar_analytics_period_change"
  | "snipradar_create_live_predict"
  | "snipradar_create_variant_apply"
  | "snipradar_research_query_submit"
  | "snipradar_research_index_refresh"
  | "snipradar_research_seed_draft"
  | "snipradar_research_brief_seed_draft"
  | "snipradar_inbox_seed_draft"
  | "snipradar_variant_lab_generate"
  | "snipradar_variant_lab_apply"
  | "snipradar_winner_automation_execute"
  | "snipradar_discover_analyze_all"
  | "snipradar_discover_remix_click"
  | "snipradar_publish_process_queue_click";

export function trackSnipRadarEvent(
  name: SnipRadarEventName,
  payload?: Record<string, unknown>
) {
  trackEvent({
    name,
    payload,
  });
}
