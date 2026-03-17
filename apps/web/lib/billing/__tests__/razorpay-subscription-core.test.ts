jest.mock("@/lib/billing/razorpay", () => {
  class MockRazorpayApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "RazorpayApiError";
      this.status = status;
    }
  }

  return {
    __esModule: true,
    RazorpayApiError: MockRazorpayApiError,
    cancelRazorpaySubscription: jest.fn(),
    fetchRazorpaySubscription: jest.fn(),
    verifyRazorpayPaymentSignature: jest.fn(),
    verifyRazorpayWebhookSignature: jest.fn(),
  };
});

jest.mock("@/lib/billing/service", () => ({
  __esModule: true,
  buildBillingWebhookEventKey: jest.fn(() => "evt_generated"),
  extractSubscriptionIdFromWebhookPayload: jest.fn((payload: Record<string, unknown>) => {
    return (payload.payload as { payment?: { entity?: { subscription_id?: string } } })?.payment?.entity
      ?.subscription_id ?? null;
  }),
  getSubscriptionRecordForUser: jest.fn(),
  markSubscriptionCancelAtPeriodEnd: jest.fn(),
  recordProcessedBillingWebhook: jest.fn(),
  serializeSubscriptionForClient: jest.fn((subscription: { id: string; status: string }) => ({
    id: subscription.id,
    status: subscription.status,
  })),
  syncUserSubscriptionFromRazorpay: jest.fn(),
}));

jest.mock("@/lib/billing/webhook-idempotency", () => ({
  __esModule: true,
  markEventProcessed: jest.fn(),
}));

import {
  BillingCoreError,
  cancelRazorpaySubscriptionForUser,
  processRazorpayWebhook,
  refreshPendingRazorpaySubscriptionForUser,
  verifyRazorpayPaymentForUser,
} from "@/lib/billing/razorpay-subscription-core";
import {
  RazorpayApiError,
  cancelRazorpaySubscription,
  fetchRazorpaySubscription,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/billing/razorpay";
import {
  buildBillingWebhookEventKey,
  getSubscriptionRecordForUser,
  markSubscriptionCancelAtPeriodEnd,
  recordProcessedBillingWebhook,
  syncUserSubscriptionFromRazorpay,
} from "@/lib/billing/service";
import { markEventProcessed } from "@/lib/billing/webhook-idempotency";

describe("razorpay subscription core", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies payment ownership and syncs the user subscription", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (getSubscriptionRecordForUser as jest.Mock).mockResolvedValue({
      userId: "user_1",
      razorpaySubscriptionId: "sub_123",
    });
    (fetchRazorpaySubscription as jest.Mock).mockResolvedValue({
      id: "sub_123",
      status: "active",
      notes: {
        userId: "user_1",
        planId: "plus",
        billingRegion: "GLOBAL",
      },
    });
    (syncUserSubscriptionFromRazorpay as jest.Mock).mockResolvedValue({
      id: "user_1",
      plan: "creator",
      subscriptionTier: "creator",
      subscriptionStatus: "active",
    });

    const result = await verifyRazorpayPaymentForUser({
      userId: "user_1",
      paymentId: "pay_123",
      subscriptionId: "sub_123",
      signature: "sig_123",
    });

    expect(result.user).toEqual({
      plan: "creator",
      subscriptionTier: "creator",
      subscriptionStatus: "active",
    });
    expect(result.subscription).toEqual({
      id: "sub_123",
      status: "active",
    });
  });

  it("rejects invalid payment signatures", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(false);

    await expect(
      verifyRazorpayPaymentForUser({
        userId: "user_1",
        paymentId: "pay_123",
        subscriptionId: "sub_123",
        signature: "bad_sig",
      }),
    ).rejects.toMatchObject({
      message: "Invalid payment signature.",
      status: 403,
    } satisfies Partial<BillingCoreError>);
  });

  it("cancels the Razorpay subscription at period end and syncs local state", async () => {
    (getSubscriptionRecordForUser as jest.Mock).mockResolvedValue({
      userId: "user_1",
      razorpaySubscriptionId: "sub_123",
      status: "active",
    });
    (fetchRazorpaySubscription as jest.Mock).mockResolvedValue({
      id: "sub_123",
      status: "active",
      notes: {
        planId: "pro",
        billingRegion: "IN",
      },
    });

    const result = await cancelRazorpaySubscriptionForUser({
      userId: "user_1",
    });

    expect(cancelRazorpaySubscription).toHaveBeenCalledWith("sub_123", true);
    expect(syncUserSubscriptionFromRazorpay).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub_123" }),
      "user_1",
    );
    expect(markSubscriptionCancelAtPeriodEnd).toHaveBeenCalledWith("user_1", true);
    expect(result.subscription).toEqual({
      id: "sub_123",
      status: "active",
    });
  });

  it("refreshes pending subscriptions from Razorpay and ignores active ones", async () => {
    (getSubscriptionRecordForUser as jest.Mock)
      .mockResolvedValueOnce({
        userId: "user_1",
        razorpaySubscriptionId: "sub_pending",
        status: "pending",
      })
      .mockResolvedValueOnce({
        userId: "user_1",
        razorpaySubscriptionId: "sub_active",
        status: "active",
      });
    (fetchRazorpaySubscription as jest.Mock).mockResolvedValue({
      id: "sub_pending",
      status: "active",
      notes: {
        userId: "user_1",
        planId: "plus",
        billingRegion: "GLOBAL",
      },
    });

    await refreshPendingRazorpaySubscriptionForUser("user_1");
    await refreshPendingRazorpaySubscriptionForUser("user_1");

    expect(fetchRazorpaySubscription).toHaveBeenCalledTimes(1);
    expect(syncUserSubscriptionFromRazorpay).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub_pending" }),
      "user_1",
    );
  });

  it("treats replayed webhook events as duplicates before touching the database", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (markEventProcessed as jest.Mock).mockReturnValue(false);

    const result = await processRazorpayWebhook({
      rawBody: JSON.stringify({ event: "subscription.activated" }),
      signature: "sig_123",
      providerEventId: "evt_123",
    });

    expect(result).toEqual({ duplicate: true });
    expect(recordProcessedBillingWebhook).not.toHaveBeenCalled();
  });

  it("reconciles webhook payloads that only include a payment subscription id", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (markEventProcessed as jest.Mock).mockReturnValue(true);
    (fetchRazorpaySubscription as jest.Mock).mockResolvedValue({
      id: "sub_123",
      status: "active",
      notes: {
        userId: "user_1",
        planId: "plus",
        billingRegion: "GLOBAL",
      },
    });
    (syncUserSubscriptionFromRazorpay as jest.Mock).mockResolvedValue({
      id: "user_1",
    });

    const result = await processRazorpayWebhook({
      rawBody: JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              subscription_id: "sub_123",
            },
          },
        },
      }),
      signature: "sig_123",
      providerEventId: null,
    });

    expect(buildBillingWebhookEventKey).toHaveBeenCalled();
    expect(fetchRazorpaySubscription).toHaveBeenCalledWith("sub_123");
    expect(recordProcessedBillingWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: "evt_generated",
        subscriptionId: "sub_123",
        userId: "user_1",
      }),
    );
    expect(result).toEqual({ duplicate: false });
  });

  it("keeps pending refresh resilient when Razorpay lookup fails", async () => {
    (getSubscriptionRecordForUser as jest.Mock).mockResolvedValue({
      userId: "user_1",
      razorpaySubscriptionId: "sub_pending",
      status: "pending",
    });
    (fetchRazorpaySubscription as jest.Mock).mockRejectedValue(
      new RazorpayApiError("Not found", 404),
    );

    await expect(refreshPendingRazorpaySubscriptionForUser("user_1")).resolves.toBeNull();
  });
});
