/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentDbUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: {
    subscription: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/billing", () => ({
  __esModule: true,
  createRazorpayCustomer: jest.fn(),
  createRazorpaySubscriptionRecord: jest.fn(),
  detectBillingRegion: jest.fn(),
  ensureSubscriptionBootstrap: jest.fn(),
  fetchRazorpaySubscription: jest.fn(),
  getProviderPromoConfig: jest.fn(),
  getRazorpayPublicConfig: jest.fn(),
  updateSubscriptionRecord: jest.fn(),
  validatePromoCode: jest.fn(),
}));

import { getCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createRazorpayCustomer,
  createRazorpaySubscriptionRecord,
  detectBillingRegion,
  ensureSubscriptionBootstrap,
  getProviderPromoConfig,
  getRazorpayPublicConfig,
  updateSubscriptionRecord,
  validatePromoCode,
} from "@/lib/billing";

process.env.RAZORPAY_PLAN_ID_PLUS_INR = "plan_plus_in";
process.env.RAZORPAY_PLAN_ID_PLUS_USD = "plan_plus_us";
process.env.RAZORPAY_PLAN_ID_PRO_INR = "plan_pro_in";
process.env.RAZORPAY_PLAN_ID_PRO_USD = "plan_pro_us";

const { POST } = require("@/app/api/billing/create-subscription/route");

describe("POST /api/billing/create-subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentDbUser as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "billing@example.com",
      name: "Billing User",
    });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
    (getRazorpayPublicConfig as jest.Mock).mockReturnValue({
      provider: "razorpay",
      configured: true,
      publicKey: "rzp_test_123",
    });
    (ensureSubscriptionBootstrap as jest.Mock).mockResolvedValue({});
    (validatePromoCode as jest.Mock).mockResolvedValue(null);
    (getProviderPromoConfig as jest.Mock).mockReturnValue(null);
    (createRazorpayCustomer as jest.Mock).mockResolvedValue({ id: "cust_123" });
    (createRazorpaySubscriptionRecord as jest.Mock).mockResolvedValue({
      id: "sub_123",
      short_url: "https://rzp.io/i/sub_123",
      current_start: 1_700_000_000,
      current_end: 1_700_259_200,
    });
    (updateSubscriptionRecord as jest.Mock).mockResolvedValue({});
  });

  it("creates an India checkout when billing region resolves to IN", async () => {
    (detectBillingRegion as jest.Mock).mockReturnValue("IN");

    const response = await POST(
      new Request("http://localhost/api/billing/create-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vercel-ip-country": "IN",
          "accept-language": "en-IN",
          host: "viralsnip.ai",
        },
        body: JSON.stringify({ planId: "plus" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(detectBillingRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "IN",
      }),
    );
    expect(createRazorpaySubscriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plus",
        billingRegion: "IN",
      }),
    );
    expect(data.subscriptionId).toBe("sub_123");
  });

  it("creates a global checkout when billing region resolves to GLOBAL", async () => {
    (detectBillingRegion as jest.Mock).mockReturnValue("GLOBAL");

    const response = await POST(
      new Request("http://localhost/api/billing/create-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vercel-ip-country": "US",
          "accept-language": "en-US",
          host: "viralsnip.ai",
        },
        body: JSON.stringify({ planId: "pro" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createRazorpaySubscriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "pro",
        billingRegion: "GLOBAL",
      }),
    );
    expect(data.razorpayKeyId).toBe("rzp_test_123");
  });
});
