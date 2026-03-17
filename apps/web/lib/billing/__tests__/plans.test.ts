import { derivePlanSelectionFromSubscription } from "@/lib/billing/razorpay";
import { getYearlyPerMonth, getYearlyTotal, isPaidPlanTier, PRICING_PLANS } from "@/lib/billing/plans";

describe("billing plan helpers", () => {
  it("computes yearly pricing from the shared discount model", () => {
    const creatorPlan = PRICING_PLANS.find((plan) => plan.id === "creator");
    expect(creatorPlan).toBeTruthy();
    expect(getYearlyPerMonth(creatorPlan!, "INR")).toBe(1049);
    expect(getYearlyTotal(creatorPlan!, "INR")).toBe(12588);
  });

  it("accepts only paid tiers supported by the app", () => {
    expect(isPaidPlanTier("starter")).toBe(true);
    expect(isPaidPlanTier("creator")).toBe(true);
    expect(isPaidPlanTier("studio")).toBe(true);
    expect(isPaidPlanTier("growth")).toBe(false);
    expect(isPaidPlanTier("pro")).toBe(false);
  });

  it("derives app plan metadata from Razorpay subscription notes", () => {
    const selection = derivePlanSelectionFromSubscription({
      id: "sub_123",
      status: "active",
      notes: {
        planId: "plus",
        billingRegion: "GLOBAL",
      },
    });

    expect(selection).toEqual({
      planId: "plus",
      billingCycle: null,
      currency: "USD",
    });
  });
});
