export const DISCOVER_TABS = ["tracker", "viral", "engagement"] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number];

export const CREATE_TABS = ["drafts", "research", "predictor", "templates", "style", "threads", "hooks", "contents"] as const;
export type CreateTab = (typeof CREATE_TABS)[number];

export const PUBLISH_TABS = ["scheduler", "calendar", "best-times", "automations", "api", "diagnostics"] as const;
export type PublishTab = (typeof PUBLISH_TABS)[number];

export function isDiscoverTab(value: string | null | undefined): value is DiscoverTab {
  return typeof value === "string" && DISCOVER_TABS.includes(value as DiscoverTab);
}

export function isCreateTab(value: string | null | undefined): value is CreateTab {
  return typeof value === "string" && CREATE_TABS.includes(value as CreateTab);
}

export function isPublishTab(value: string | null | undefined): value is PublishTab {
  return typeof value === "string" && PUBLISH_TABS.includes(value as PublishTab);
}
