jest.mock("nanoid", () => ({
  __esModule: true,
  nanoid: jest.fn(() => "REFCODE1"),
}));

import { buildBillingWebhookEventKey } from "@/lib/billing/service";

describe("billing service helpers", () => {
  it("builds stable webhook keys for replayed payloads without created_at", () => {
    const payload = {
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: "sub_123",
          },
        },
      },
    };

    expect(buildBillingWebhookEventKey("subscription.activated", payload)).toBe(
      buildBillingWebhookEventKey("subscription.activated", payload),
    );
  });
});
