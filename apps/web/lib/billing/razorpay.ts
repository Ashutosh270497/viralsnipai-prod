import "server-only";

import crypto from "crypto";

import { getBillingPlanRazorpayPlanId, resolveBillingPlanId } from "@/config/plans";
import type { BillingPlanId, BillingRegion } from "@/types/billing";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

type SupportedCurrency = "USD" | "INR";
type BillingCycle = "monthly" | "yearly";
type ManagedBillingPlanId = Exclude<BillingPlanId, "free">;
type RazorpayPublicAvailability = Record<ManagedBillingPlanId, Record<BillingRegion, boolean>>;

type RazorpayConfig = {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  planIds: Record<ManagedBillingPlanId, Record<BillingRegion, string>>;
};

export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

export type RazorpaySubscriptionEntity = {
  id: string;
  status: RazorpaySubscriptionStatus | string;
  plan_id?: string | null;
  customer_id?: string | null;
  short_url?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, unknown> | null;
};

export type RazorpayCustomerEntity = {
  id: string;
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, unknown> | null;
};

export class RazorpayApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RazorpayApiError";
    this.status = status;
  }
}

function readRazorpayConfig(): RazorpayConfig {
  return {
    keyId: process.env.RAZORPAY_KEY_ID ?? null,
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? null,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
    planIds: {
      plus: {
        IN: process.env.RAZORPAY_PLAN_ID_PLUS_INR ?? "",
        GLOBAL: process.env.RAZORPAY_PLAN_ID_PLUS_USD ?? "",
      },
      pro: {
        IN: process.env.RAZORPAY_PLAN_ID_PRO_INR ?? "",
        GLOBAL: process.env.RAZORPAY_PLAN_ID_PRO_USD ?? "",
      },
    },
  };
}

function buildAvailability(config: RazorpayConfig): RazorpayPublicAvailability {
  return {
    plus: {
      IN: Boolean(config.planIds.plus.IN),
      GLOBAL: Boolean(config.planIds.plus.GLOBAL),
    },
    pro: {
      IN: Boolean(config.planIds.pro.IN),
      GLOBAL: Boolean(config.planIds.pro.GLOBAL),
    },
  };
}

export function getRazorpayPublicConfig() {
  const config = readRazorpayConfig();
  const availability = buildAvailability(config);
  const missingEnvKeys = getMissingRazorpayEnvKeys(config);

  return {
    provider: "razorpay" as const,
    configured: Boolean(config.keyId && config.keySecret && hasAnyConfiguredPlan(availability)),
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? config.keyId,
    missingEnvKeys,
    availability,
  };
}

export function getMissingRazorpayEnvKeys(config = readRazorpayConfig()) {
  const missing = [] as string[];
  if (!config.keyId) missing.push("RAZORPAY_KEY_ID");
  if (!config.keySecret) missing.push("RAZORPAY_KEY_SECRET");
  if (!config.webhookSecret) missing.push("RAZORPAY_WEBHOOK_SECRET");
  if (!config.planIds.plus.IN) missing.push("RAZORPAY_PLAN_ID_PLUS_INR");
  if (!config.planIds.plus.GLOBAL) missing.push("RAZORPAY_PLAN_ID_PLUS_USD");
  if (!config.planIds.pro.IN) missing.push("RAZORPAY_PLAN_ID_PRO_INR");
  if (!config.planIds.pro.GLOBAL) missing.push("RAZORPAY_PLAN_ID_PRO_USD");

  return missing;
}

function hasAnyConfiguredPlan(availability: RazorpayPublicAvailability) {
  return Object.values(availability).some((regions) =>
    Object.values(regions).some(Boolean)
  );
}

function getRazorpayCredentials() {
  const config = readRazorpayConfig();
  if (!config.keyId || !config.keySecret) {
    throw new RazorpayApiError("Razorpay credentials are not configured.", 503);
  }
  return { keyId: config.keyId, keySecret: config.keySecret };
}

function createAuthorizationHeader() {
  const { keyId, keySecret } = getRazorpayCredentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayRequest<T>(path: string, init?: RequestInit & { bodyJson?: Record<string, unknown> }) {
  const body = init?.bodyJson ? JSON.stringify(init.bodyJson) : init?.body;
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: createAuthorizationHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: { description?: string } }).error?.description === "string" &&
        (payload as { error?: { description?: string } }).error?.description) ||
      `Razorpay API request failed with status ${response.status}.`;
    throw new RazorpayApiError(message, response.status);
  }

  return payload as T;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function createRazorpayCustomer(params: {
  email: string;
  name?: string | null;
  contact?: string | null;
  userId: string;
}) {
  return razorpayRequest<RazorpayCustomerEntity>("/customers", {
    method: "POST",
    bodyJson: {
      email: params.email,
      name: params.name ?? undefined,
      contact: params.contact ?? undefined,
      fail_existing: 0,
      notes: {
        userId: params.userId,
      },
    },
  });
}

export async function createRazorpaySubscriptionRecord(params: {
  planId: string;
  billingRegion: "IN" | "GLOBAL";
  customerId: string;
  userId: string;
  email: string;
  name?: string | null;
  totalCount?: number;
  offerId?: string | null;
}) {
  const resolvedPlanId = resolveBillingPlanId(params.planId);
  if (resolvedPlanId === "free") {
    throw new RazorpayApiError("Free plan does not require a Razorpay subscription.", 400);
  }
  const razorpayPlanId = getBillingPlanRazorpayPlanId(resolvedPlanId, params.billingRegion);
  if (!razorpayPlanId) {
    throw new RazorpayApiError(
      `Missing Razorpay plan id for ${resolvedPlanId} in ${params.billingRegion}.`,
      503,
    );
  }

  return razorpayRequest<RazorpaySubscriptionEntity>("/subscriptions", {
    method: "POST",
    bodyJson: {
      plan_id: razorpayPlanId,
      customer_id: params.customerId,
      total_count: params.totalCount ?? 120,
      quantity: 1,
      customer_notify: 1,
      ...(params.offerId ? { offer_id: params.offerId } : {}),
      notes: {
        userId: params.userId,
        email: params.email,
        name: params.name ?? "",
        planId: resolvedPlanId,
        billingRegion: params.billingRegion,
      },
    },
  });
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  return razorpayRequest<RazorpaySubscriptionEntity>(`/subscriptions/${subscriptionId}`);
}

export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  return razorpayRequest<RazorpaySubscriptionEntity>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    bodyJson: {
      cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
    },
  });
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  const secret = readRazorpayConfig().webhookSecret;
  if (!secret || !signature) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyRazorpayPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  const secret = readRazorpayConfig().keySecret;
  if (!secret || !paymentId || !subscriptionId || !signature) {
    return false;
  }

  const payload = `${paymentId}|${subscriptionId}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function unixToIso(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

export function derivePlanSelectionFromSubscription(subscription: RazorpaySubscriptionEntity) {
  const notes = subscription.notes ?? {};
  const planId = typeof notes.planId === "string" ? resolveBillingPlanId(notes.planId) : null;
  const billingCycle =
    notes.billingCycle === "monthly" || notes.billingCycle === "yearly" ? notes.billingCycle : null;
  const currency = notes.billingCurrency === "USD" || notes.billingCurrency === "INR"
    ? notes.billingCurrency
    : notes.billingRegion === "GLOBAL"
      ? "USD"
      : notes.billingRegion === "IN"
        ? "INR"
        : null;

  return { planId, billingCycle, currency };
}
