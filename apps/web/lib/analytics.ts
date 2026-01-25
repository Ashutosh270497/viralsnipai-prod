type AnalyticsEvent = {
  name: string;
  payload?: Record<string, unknown>;
};

// Placeholder analytics hook. Replace with vendor-specific logic when ready.
export function trackEvent(event: AnalyticsEvent) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${event.name}`, event.payload ?? {});
  }
}
