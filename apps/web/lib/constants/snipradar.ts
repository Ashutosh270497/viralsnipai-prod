export const SNIPRADAR = {
  /** Max characters per tweet */
  TWEET_MAX_LENGTH: 280,
  /** How far back to look when fetching viral tweets (hours) */
  VIRAL_FETCH_WINDOW_HOURS: 7 * 24,
  /** How far back to show viral tweets in the feed (days) */
  VIRAL_DISPLAY_WINDOW_DAYS: 7,
  /** Max tweets to fetch per tracked account */
  MAX_TWEETS_PER_FETCH: 50,
  /** Max viral tweets to show in feed/dashboard */
  MAX_VIRAL_DISPLAY: 20,
  /** Max drafts to show */
  MAX_DRAFTS_DISPLAY: 20,
  /** Max variants to compare in Variant Lab */
  VARIANT_LAB_MAX_VARIANTS: 4,
  /** Min minutes in the future for scheduling */
  SCHEDULE_MIN_FUTURE_MINUTES: 5,
  /** Default poll interval for scheduled drafts (ms) */
  POLL_INTERVAL_MS: 60_000,
  /** Faster poll interval when drafts are due (ms) */
  POLL_INTERVAL_DUE_MS: 30_000,
  /** AI endpoint cooldown per user (ms) */
  AI_RATE_LIMIT_COOLDOWN_MS: 2 * 60 * 1000,
  /** AI endpoint burst window per user (ms) */
  AI_RATE_LIMIT_BURST_WINDOW_MS: 60 * 1000,
  /** Max AI calls per burst window */
  AI_RATE_LIMIT_BURST_MAX_REQUESTS: 6,
  /** Publish endpoint burst window per user (ms) */
  POST_RATE_LIMIT_WINDOW_MS: 30 * 1000,
  /** Max publish actions per burst window */
  POST_RATE_LIMIT_MAX_REQUESTS: 3,
  /** Lookup/mutation window for external-account discovery (ms) */
  LOOKUP_RATE_LIMIT_WINDOW_MS: 60 * 1000,
  /** Max lookup actions per burst window */
  LOOKUP_RATE_LIMIT_MAX_REQUESTS: 8,
  /** lookupUser cache TTL (ms) */
  USER_CACHE_TTL_MS: 10 * 60 * 1000,
} as const;
