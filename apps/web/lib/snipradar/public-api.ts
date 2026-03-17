import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  buildSnipRadarRateLimitHeaders,
  consumeSnipRadarRateLimit,
} from "@/lib/snipradar/request-guards";

export const SNIPRADAR_API_SCOPES = [
  "all",
  "drafts:read",
  "drafts:write",
  "publish:write",
  "metrics:read",
  "scheduler:read",
  "research:write",
  "winners:read",
  "audit:read",
] as const;

export type SnipRadarApiScope = (typeof SNIPRADAR_API_SCOPES)[number];

export const DEFAULT_SNIPRADAR_API_SCOPES: SnipRadarApiScope[] = [
  "drafts:read",
  "drafts:write",
  "publish:write",
  "metrics:read",
  "scheduler:read",
  "research:write",
  "winners:read",
  "audit:read",
];

export const SNIPRADAR_WEBHOOK_EVENT_TYPES = [
  "draft.posted",
  "draft.publish_failed",
  "winner.detected",
  "research.ingested",
  "profile_audit.score_updated",
] as const;

export type SnipRadarWebhookEventType = (typeof SNIPRADAR_WEBHOOK_EVENT_TYPES)[number];

export const SNIPRADAR_API_SCOPE_LABELS: Record<SnipRadarApiScope, string> = {
  all: "Full access",
  "drafts:read": "Read drafts",
  "drafts:write": "Create or edit drafts",
  "publish:write": "Publish drafts",
  "metrics:read": "Read analytics metrics",
  "scheduler:read": "Read scheduler runs",
  "research:write": "Ingest research inbox items",
  "winners:read": "Read winner detections",
  "audit:read": "Read profile audit history",
};

export const SNIPRADAR_WEBHOOK_EVENT_LABELS: Record<SnipRadarWebhookEventType, string> = {
  "draft.posted": "Draft published",
  "draft.publish_failed": "Draft publish failed",
  "winner.detected": "Winner detected",
  "research.ingested": "Research item ingested",
  "profile_audit.score_updated": "Profile audit score updated",
};

const API_KEY_PREFIX = "sr_live_";
const WEBHOOK_SECRET_PREFIX = "swhsec_";
const ENCRYPTION_VERSION = "v1";
const PUBLIC_API_VERSION = "2026-03-07";

function deriveEncryptionKey() {
  const secret =
    process.env.SNIPRADAR_PLATFORM_ENCRYPTION_SECRET?.trim() ??
    process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "Missing SNIPRADAR_PLATFORM_ENCRYPTION_SECRET or NEXTAUTH_SECRET for SnipRadar platform secrets."
    );
  }

  return createHash("sha256").update(secret).digest();
}

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function isSnipRadarApiScope(value: string): value is SnipRadarApiScope {
  return SNIPRADAR_API_SCOPES.includes(value as SnipRadarApiScope);
}

export function isSnipRadarWebhookEventType(value: string): value is SnipRadarWebhookEventType {
  return SNIPRADAR_WEBHOOK_EVENT_TYPES.includes(value as SnipRadarWebhookEventType);
}

export function normalizeSnipRadarApiScopes(scopes: string[] | null | undefined): SnipRadarApiScope[] {
  const normalized = Array.from(new Set((scopes ?? []).filter(isSnipRadarApiScope)));
  if (normalized.includes("all")) return ["all"];
  return normalized.length > 0 ? normalized : DEFAULT_SNIPRADAR_API_SCOPES.slice();
}

export function normalizeSnipRadarWebhookEvents(
  eventTypes: string[] | null | undefined
): SnipRadarWebhookEventType[] {
  const normalized = Array.from(new Set((eventTypes ?? []).filter(isSnipRadarWebhookEventType)));
  return normalized.length > 0 ? normalized : SNIPRADAR_WEBHOOK_EVENT_TYPES.slice();
}

export function hashSnipRadarApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSnipRadarApiKey() {
  const token = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return {
    token,
    prefix: token.slice(0, 16),
    lastFour: token.slice(-4),
    keyHash: hashSnipRadarApiKey(token),
  };
}

export function generateSnipRadarWebhookSecret() {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function encryptSnipRadarSecret(value: string) {
  const key = deriveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSnipRadarSecret(value: string) {
  const [version, ivEncoded, authTagEncoded, bodyEncoded] = value.split(":");
  if (version !== ENCRYPTION_VERSION || !ivEncoded || !authTagEncoded || !bodyEncoded) {
    throw new Error("Invalid secret payload format");
  }

  const key = deriveEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivEncoded, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(bodyEncoded, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function signSnipRadarWebhookPayload(params: {
  signingSecret: string;
  timestamp: string;
  body: string;
}) {
  return `v1=${createHmac("sha256", params.signingSecret)
    .update(`${params.timestamp}.${params.body}`)
    .digest("hex")}`;
}

export function buildSnipRadarPlatformHeaders(headers?: HeadersInit) {
  return {
    "X-SnipRadar-API-Version": PUBLIC_API_VERSION,
    ...(headers ?? {}),
  };
}

export function truncatePreview(value: string | null | undefined, maxLength = 500) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function extractSnipRadarApiKey(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = request.headers.get("x-api-key")?.trim();
  return bearer || header || null;
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    {
      success: false,
      error: message,
      code:
        status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : status === 429
              ? "RATE_LIMITED"
              : "INTERNAL_ERROR",
      retryable: status >= 500 || status === 429,
    },
    {
      status,
      headers: buildSnipRadarPlatformHeaders(headers),
    }
  );
}

export function serializeSnipRadarApiKey(record: {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    name: record.name,
    keyPreview: `${record.prefix}••••${record.lastFour}`,
    scopes: normalizeSnipRadarApiScopes(record.scopes),
    isActive: record.isActive,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function serializeSnipRadarWebhookSubscription(record: {
  id: string;
  name: string;
  url: string;
  signingSecretPreview: string;
  events: string[];
  isActive: boolean;
  lastDeliveredAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureReason: string | null;
  createdAt: Date;
  deliveries?: Array<{
    id: string;
    status: string;
    responseStatus: number | null;
    errorMessage: string | null;
    createdAt: Date;
    deliveredAt: Date | null;
  }>;
}) {
  return {
    id: record.id,
    name: record.name,
    url: record.url,
    signingSecretPreview: record.signingSecretPreview,
    events: normalizeSnipRadarWebhookEvents(record.events),
    isActive: record.isActive,
    lastDeliveredAt: record.lastDeliveredAt?.toISOString() ?? null,
    lastFailureAt: record.lastFailureAt?.toISOString() ?? null,
    lastFailureReason: record.lastFailureReason,
    createdAt: record.createdAt.toISOString(),
    recentDeliveries: (record.deliveries ?? []).map((delivery) => ({
      id: delivery.id,
      status: delivery.status,
      responseStatus: delivery.responseStatus,
      errorMessage: delivery.errorMessage,
      createdAt: delivery.createdAt.toISOString(),
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    })),
  };
}

export function serializePublicDraft(draft: {
  id: string;
  text: string;
  hookType: string | null;
  format: string | null;
  emotionalTrigger: string | null;
  aiReasoning: string | null;
  viralPrediction: number | null;
  status: string;
  scheduledFor: Date | null;
  postedAt: Date | null;
  postedTweetId: string | null;
  actualLikes: number | null;
  actualRetweets: number | null;
  actualReplies: number | null;
  actualImpressions: number | null;
  createdAt: Date;
  updatedAt?: Date;
}) {
  return {
    id: draft.id,
    text: draft.text,
    hookType: draft.hookType,
    format: draft.format,
    emotionalTrigger: draft.emotionalTrigger,
    aiReasoning: draft.aiReasoning,
    viralPrediction: draft.viralPrediction,
    status: draft.status,
    scheduledFor: draft.scheduledFor?.toISOString() ?? null,
    postedAt: draft.postedAt?.toISOString() ?? null,
    postedTweetId: draft.postedTweetId,
    actualLikes: draft.actualLikes,
    actualRetweets: draft.actualRetweets,
    actualReplies: draft.actualReplies,
    actualImpressions: draft.actualImpressions,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt?.toISOString() ?? null,
  };
}

export function serializeWebhookEventPayload(payload: unknown) {
  if (typeof payload === "string") {
    return safeJsonParse(payload) ?? payload;
  }
  return payload;
}

export async function authenticateSnipRadarApiRequest(
  request: NextRequest,
  requiredScopes: SnipRadarApiScope[]
): Promise<
  | {
      ok: true;
      context: {
        userId: string;
        apiKeyId: string;
        apiKeyName: string;
        scopes: SnipRadarApiScope[];
        headers: HeadersInit;
      };
    }
  | { ok: false; response: Response }
> {
  const token = extractSnipRadarApiKey(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError("Provide a SnipRadar API key in Authorization: Bearer.", 401),
    };
  }

  const keyHash = hashSnipRadarApiKey(token);
  const apiKey = await prisma.snipRadarApiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      name: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return {
      ok: false,
      response: jsonError("Invalid or inactive SnipRadar API key.", 401),
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      response: jsonError("This SnipRadar API key has expired.", 401),
    };
  }

  const scopes = normalizeSnipRadarApiScopes(apiKey.scopes);
  const hasAll = scopes.includes("all");
  const missingScope = requiredScopes.find((scope) => !hasAll && !scopes.includes(scope));
  if (missingScope) {
    return {
      ok: false,
      response: jsonError(
        `This API key does not include the required scope: ${missingScope}.`,
        403
      ),
    };
  }

  const rateLimit = consumeSnipRadarRateLimit("snipradar:public-api", apiKey.id, [
    { name: "burst", windowMs: 60_000, maxHits: 120 },
    { name: "sustained", windowMs: 15 * 60_000, maxHits: 900 },
  ]);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          error: "SnipRadar public API rate limit exceeded.",
          code: "RATE_LIMITED",
          retryable: true,
        },
        {
          status: 429,
          headers: buildSnipRadarPlatformHeaders(buildSnipRadarRateLimitHeaders(rateLimit)),
        }
      ),
    };
  }

  if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.snipRadarApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return {
    ok: true,
    context: {
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      scopes,
      headers: buildSnipRadarPlatformHeaders(buildSnipRadarRateLimitHeaders(rateLimit)),
    },
  };
}
