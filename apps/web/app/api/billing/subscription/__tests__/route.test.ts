/** @jest-environment node */

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  getCurrentDbUser: jest.fn(),
}));

jest.mock("@/lib/billing", () => ({
  __esModule: true,
  getCurrentSubscriptionState: jest.fn(),
}));

jest.mock("@/lib/billing/razorpay-subscription-core", () => ({
  __esModule: true,
  refreshPendingRazorpaySubscriptionForUser: jest.fn(),
}));

import { getCurrentDbUser } from "@/lib/auth";
import { getCurrentSubscriptionState } from "@/lib/billing";
import { refreshPendingRazorpaySubscriptionForUser } from "@/lib/billing/razorpay-subscription-core";

const { GET } = require("@/app/api/billing/subscription/route");

describe("GET /api/billing/subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refreshes pending Razorpay subscriptions before returning state", async () => {
    (getCurrentDbUser as jest.Mock).mockResolvedValue({
      id: "user_1",
    });
    (refreshPendingRazorpaySubscriptionForUser as jest.Mock).mockResolvedValue(null);
    (getCurrentSubscriptionState as jest.Mock).mockResolvedValue({
      plan: { id: "plus" },
      status: "active",
    });

    const response = await GET(
      new Request("http://localhost/api/billing/subscription", {
        headers: {
          host: "viralsnip.ai",
          "x-vercel-ip-country": "IN",
          "accept-language": "en-IN",
        },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(refreshPendingRazorpaySubscriptionForUser).toHaveBeenCalledWith("user_1");
    expect(getCurrentSubscriptionState).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        host: "viralsnip.ai",
        country: "IN",
      }),
    );
    expect(data.status).toBe("active");
  });
});
