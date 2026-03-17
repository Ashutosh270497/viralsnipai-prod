import {
  BILLING_PLANS,
  getBillingPlanRazorpayPlanId,
  resolveBillingPlanId,
} from "@/config/plans";

describe("canonical billing plans", () => {
  it("resolves legacy billing plan ids into canonical ids", () => {
    expect(resolveBillingPlanId("free")).toBe("free");
    expect(resolveBillingPlanId("plus")).toBe("plus");
    expect(resolveBillingPlanId("pro")).toBe("pro");
    expect(resolveBillingPlanId("starter")).toBe("plus");
    expect(resolveBillingPlanId("creator")).toBe("plus");
    expect(resolveBillingPlanId("studio")).toBe("pro");
    expect(resolveBillingPlanId("agency")).toBe("pro");
  });

  it("defines the canonical public billing catalog", () => {
    expect(Object.keys(BILLING_PLANS)).toEqual(["free", "plus", "pro"]);
    expect(BILLING_PLANS.plus.priceINR).toBe(499);
    expect(BILLING_PLANS.plus.priceUSD).toBe(9.99);
    expect(BILLING_PLANS.pro.priceINR).toBe(2199);
    expect(BILLING_PLANS.pro.priceUSD).toBe(29.99);
  });

  it("reads region-specific razorpay plan ids", () => {
    expect(getBillingPlanRazorpayPlanId("free", "IN")).toBe("");
    expect(getBillingPlanRazorpayPlanId("free", "GLOBAL")).toBe("");
  });
});
