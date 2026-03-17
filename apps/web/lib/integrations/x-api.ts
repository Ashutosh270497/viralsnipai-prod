import crypto from "crypto";
import type { XUser, XTweet, XSearchResponse } from "@/lib/types/snipradar";
import { SNIPRADAR } from "@/lib/constants/snipradar";

const X_API_BASE = "https://api.x.com/2";
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

const X_API_TIMEOUT_MS = parsePositiveInt(process.env.X_API_TIMEOUT_MS, 10_000);
const X_API_MAX_RETRIES = Math.max(
  0,
  Math.min(5, parsePositiveInt(process.env.X_API_MAX_RETRIES, 2))
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryMethod(method: string, allowRetryOnNonIdempotent: boolean): boolean {
  if (allowRetryOnNonIdempotent) return true;
  return method === "GET" || method === "HEAD";
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }
  return null;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    allowRetryOnNonIdempotent?: boolean;
  }
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const maxRetries = options?.maxRetries ?? X_API_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? X_API_TIMEOUT_MS;
  const allowRetryOnNonIdempotent = options?.allowRetryOnNonIdempotent ?? false;

  const canRetry = shouldRetryMethod(method, allowRetryOnNonIdempotent);
  const retryCount = canRetry ? maxRetries : 0;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (!TRANSIENT_STATUSES.has(response.status) || attempt === retryCount) {
        return response;
      }

      const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
      const backoffMs =
        retryAfter ??
        Math.min(5000, 250 * 2 ** attempt) + Math.round(Math.random() * 150);
      await sleep(backoffMs);
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === retryCount) break;
      const backoffMs = Math.min(5000, 250 * 2 ** attempt) + Math.round(Math.random() * 150);
      await sleep(backoffMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("X API request failed");
}

// ============================================
// OAuth 2.0 PKCE Helpers
// ============================================

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set(
    "scope",
    "tweet.read tweet.write users.read dm.read dm.write offline.access"
  );
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ============================================
// Token Exchange
// ============================================

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const basicAuth = Buffer.from(
    `${params.clientId}:${params.clientSecret}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetchWithRetry(
    "https://api.x.com/2/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    },
    { maxRetries: 1, allowRetryOnNonIdempotent: true }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return res.json();
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const basicAuth = Buffer.from(
    `${params.clientId}:${params.clientSecret}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });

  const res = await fetchWithRetry(
    "https://api.x.com/2/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    },
    { maxRetries: 1, allowRetryOnNonIdempotent: true }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return res.json();
}

// ============================================
// API Client (App-level auth with Bearer Token)
// ============================================

async function xApiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = process.env.X_API_KEY;
  if (!apiKey) {
    throw new Error("X_API_KEY environment variable is not set");
  }

  return fetchWithRetry(`${X_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function xApiUserFetch(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(
    `${X_API_BASE}${endpoint}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
    { maxRetries: 1, allowRetryOnNonIdempotent: false }
  );
}

// ============================================
// User Lookup (with 10-minute cache)
// ============================================

const userCache = new Map<string, { data: XUser; expiresAt: number }>();
const USER_CACHE_TTL = SNIPRADAR.USER_CACHE_TTL_MS;

export async function lookupUser(username: string): Promise<XUser | null> {
  const cleanUsername = username.replace("@", "").toLowerCase();

  // Check cache
  const cached = userCache.get(cleanUsername);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const res = await xApiFetch(
    `/users/by/username/${cleanUsername}?user.fields=public_metrics,profile_image_url,description,location,pinned_tweet_id,url,verified`
  );

  if (!res.ok) {
    console.error(`[X API] lookupUser failed: ${res.status} ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  const user = data.data ?? null;

  if (user) {
    userCache.set(cleanUsername, { data: user, expiresAt: Date.now() + USER_CACHE_TTL });
  }

  return user;
}

export async function lookupUserById(
  userId: string,
  accessToken?: string
): Promise<XUser | null> {
  const endpoint =
    "/users/" +
    `${userId}?user.fields=public_metrics,profile_image_url,description,location,pinned_tweet_id,url,verified`;

  const res = accessToken
    ? await xApiUserFetch(endpoint, accessToken)
    : await xApiFetch(endpoint);

  if (!res.ok) {
    console.error(`[X API] lookupUserById failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.data ?? null;
}

// ============================================
// Get Authenticated User (via OAuth token)
// ============================================

export async function getAuthenticatedUser(
  accessToken: string
): Promise<XUser | null> {
  const res = await xApiUserFetch(
    "/users/me?user.fields=public_metrics,profile_image_url,description,location,pinned_tweet_id,url,verified",
    accessToken
  );

  if (!res.ok) {
    console.error(`[X API] getAuthenticatedUser failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.data ?? null;
}

// ============================================
// Search Viral Tweets
// ============================================

export async function searchViralTweets(params: {
  query?: string;
  minLikes?: number;
  maxResults?: number;
  nextToken?: string;
}): Promise<XSearchResponse> {
  const {
    query = "",
    minLikes = 1000,
    maxResults = 10,
    nextToken,
  } = params;

  const searchQuery = query
    ? `${query} min_faves:${minLikes} -is:retweet lang:en`
    : `min_faves:${minLikes} -is:retweet lang:en`;

  const urlParams = new URLSearchParams({
    query: searchQuery,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "public_metrics,created_at,attachments,author_id",
    "user.fields": "public_metrics,profile_image_url",
    expansions: "author_id,attachments.media_keys",
    "media.fields": "type",
  });

  if (nextToken) {
    urlParams.set("next_token", nextToken);
  }

  const res = await xApiFetch(`/tweets/search/recent?${urlParams.toString()}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[X API] searchViralTweets failed: ${res.status} ${error}`);
    return { data: [], meta: { result_count: 0 } };
  }

  return res.json();
}

// ============================================
// Search Trending Conversations
// ============================================

export async function searchTrendingConversations(params: {
  query: string;
  minLikes?: number;
  minReplies?: number;
  maxResults?: number;
  nextToken?: string;
}): Promise<XSearchResponse> {
  const { query, minLikes = 100, minReplies = 5, maxResults = 10, nextToken } = params;

  const searchQuery = `${query} min_faves:${minLikes} min_replies:${minReplies} -is:retweet lang:en`;

  const urlParams = new URLSearchParams({
    query: searchQuery,
    max_results: String(Math.min(maxResults, 20)),
    "tweet.fields": "public_metrics,created_at,author_id",
    "user.fields": "public_metrics,profile_image_url,username,name",
    expansions: "author_id",
    sort_order: "relevancy",
  });
  if (nextToken) {
    urlParams.set("next_token", nextToken);
  }

  const res = await xApiFetch(`/tweets/search/recent?${urlParams.toString()}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[X API] searchTrendingConversations failed: ${res.status} ${error}`);
    return { data: [], meta: { result_count: 0 } };
  }

  return res.json();
}

export async function searchRepliesToTweet(params: {
  tweetId: string;
  ownerUsername: string;
  maxResults?: number;
  nextToken?: string;
}): Promise<XSearchResponse> {
  const { tweetId, ownerUsername, maxResults = 50, nextToken } = params;

  const searchQuery = `conversation_id:${tweetId} -from:${ownerUsername.replace("@", "")} -is:retweet`;

  const urlParams = new URLSearchParams({
    query: searchQuery,
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "author_id,created_at,referenced_tweets",
    "user.fields": "profile_image_url,username,name",
    expansions: "author_id",
    sort_order: "recency",
  });

  if (nextToken) {
    urlParams.set("next_token", nextToken);
  }

  const res = await xApiFetch(`/tweets/search/recent?${urlParams.toString()}`);

  if (!res.ok) {
    const error = await res.text();
    console.error(`[X API] searchRepliesToTweet failed: ${res.status} ${error}`);
    return { data: [], meta: { result_count: 0 } };
  }

  return res.json();
}

// ============================================
// Get User Tweets
// ============================================

export async function getUserTweets(params: {
  userId: string;
  accessToken?: string;
  maxResults?: number;
  sinceId?: string;
  startTime?: Date; // ISO 8601 timestamp for filtering tweets
  includeReplies?: boolean;
  suppressAuthErrorLogging?: boolean;
}): Promise<XSearchResponse> {
  const {
    userId,
    accessToken,
    maxResults = 10,
    sinceId,
    startTime,
    includeReplies = false,
    suppressAuthErrorLogging = false,
  } = params;

  const urlParams = new URLSearchParams({
    max_results: String(Math.min(maxResults, 100)),
    "tweet.fields": "public_metrics,created_at,attachments,referenced_tweets",
  });

  if (includeReplies) {
    urlParams.set("exclude", "retweets");
  } else {
    urlParams.set("exclude", "retweets,replies");
  }

  if (sinceId) {
    urlParams.set("since_id", sinceId);
  }

  // Add time filter (must be ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ)
  if (startTime) {
    urlParams.set("start_time", startTime.toISOString());
  }

  const endpoint = `/users/${userId}/tweets?${urlParams.toString()}`;
  const res = accessToken
    ? await xApiUserFetch(endpoint, accessToken)
    : await xApiFetch(endpoint);

  if (!res.ok) {
    const errorText = await res.text();
    let parsedError: { title?: string; detail?: string; type?: string; status?: number } | null =
      null;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = null;
    }
    const shouldLog =
      !(suppressAuthErrorLogging && res.status === 401);
    if (shouldLog) {
      console.error(`[X API] getUserTweets failed for user ${userId}: ${res.status} ${res.statusText}`);
      console.error(`[X API] Error body:`, errorText);
    }
    return {
      data: [],
      meta: { result_count: 0 },
      error: {
        status: res.status,
        title: parsedError?.title,
        detail: parsedError?.detail ?? errorText,
        type: parsedError?.type,
      },
    };
  }

  return res.json();
}

// ============================================
// Post a Tweet (requires user OAuth token)
// ============================================

export async function postTweet(params: {
  text: string;
  accessToken: string;
  replyToTweetId?: string;
}): Promise<{ tweetId: string } | null> {
  const result = await postTweetWithResult(params);
  if (result.ok) {
    return { tweetId: result.tweetId };
  }
  return null;
}

export async function postTweetWithResult(params: {
  text: string;
  accessToken: string;
  replyToTweetId?: string;
}): Promise<
  | { ok: true; tweetId: string }
  | {
      ok: false;
      error: { status: number; title?: string; detail?: string; type?: string };
    }
> {
  if (params.text.length > SNIPRADAR.TWEET_MAX_LENGTH) {
    throw new Error(`Tweet exceeds ${SNIPRADAR.TWEET_MAX_LENGTH}-character limit (${params.text.length} chars)`);
  }

  const body: Record<string, unknown> = { text: params.text };
  if (params.replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: params.replyToTweetId };
  }

  const res = await xApiUserFetch("/tweets", params.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    let parsedError: { title?: string; detail?: string; type?: string; status?: number } | null =
      null;
    try {
      parsedError = JSON.parse(error);
    } catch {
      parsedError = null;
    }
    console.error(`[X API] postTweet failed: ${res.status} ${error}`);
    return {
      ok: false,
      error: {
        status: res.status,
        title: parsedError?.title,
        detail: parsedError?.detail ?? error,
        type: parsedError?.type,
      },
    };
  }

  const data = await res.json();
  return { ok: true, tweetId: data.data.id };
}

export async function sendDirectMessageWithResult(params: {
  participantId: string;
  text: string;
  accessToken: string;
}): Promise<
  | { ok: true; dmEventId: string | null }
  | {
      ok: false;
      error: { status: number; title?: string; detail?: string; type?: string };
    }
> {
  const res = await xApiUserFetch(
    `/dm_conversations/with/${params.participantId}/messages`,
    params.accessToken,
    {
      method: "POST",
      body: JSON.stringify({ text: params.text }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    let parsedError: { title?: string; detail?: string; type?: string; status?: number } | null =
      null;
    try {
      parsedError = JSON.parse(error);
    } catch {
      parsedError = null;
    }
    console.error(`[X API] sendDirectMessage failed: ${res.status} ${error}`);
    return {
      ok: false,
      error: {
        status: res.status,
        title: parsedError?.title,
        detail: parsedError?.detail ?? error,
        type: parsedError?.type,
      },
    };
  }

  const data = await res.json().catch(() => null as unknown);
  const eventId =
    typeof data === "object" && data !== null
      ? ((data as { data?: { dm_event_id?: string; event_id?: string } }).data?.dm_event_id ??
          (data as { data?: { dm_event_id?: string; event_id?: string } }).data?.event_id ??
          null)
      : null;

  return { ok: true, dmEventId: eventId };
}

// ============================================
// Get Tweet Metrics
// ============================================

export async function getTweetMetrics(tweetId: string): Promise<{
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
} | null> {
  const res = await xApiFetch(
    `/tweets/${tweetId}?tweet.fields=public_metrics`
  );

  if (!res.ok) {
    console.error(`[X API] getTweetMetrics failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const metrics = data.data?.public_metrics;

  if (!metrics) return null;

  return {
    likes: metrics.like_count ?? 0,
    retweets: metrics.retweet_count ?? 0,
    replies: metrics.reply_count ?? 0,
    impressions: metrics.impression_count ?? 0,
  };
}

export async function getTweetById(tweetId: string): Promise<XTweet | null> {
  const res = await xApiFetch(
    `/tweets/${tweetId}?tweet.fields=public_metrics,created_at,attachments,referenced_tweets,author_id`
  );

  if (!res.ok) {
    console.error(`[X API] getTweetById failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.data ?? null;
}

// ============================================
// Helpers
// ============================================

export function getMediaType(
  tweet: XTweet,
  media?: Array<{ media_key: string; type: string }>
): string | null {
  if (!tweet.attachments?.media_keys?.length || !media?.length) return null;

  const tweetMedia = media.find((m) =>
    tweet.attachments!.media_keys!.includes(m.media_key)
  );

  return tweetMedia?.type ?? null;
}
