"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Compass,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  CreditCard,
  Gem,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingPlanId, BillingRegion, BillingSubscriptionState } from "@/types/billing";

type BillingWorkspaceProps = {
  initialState: BillingSubscriptionState;
  initialRegion: BillingRegion;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type CreateSubscriptionResponse = {
  provider: "razorpay";
  subscriptionId: string;
  razorpayKeyId: string;
  shortUrl: string | null;
  reusedPending?: boolean;
};

type UsageRow = {
  label: string;
  used: number;
  limit: number | "unlimited" | "locked";
  value: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, callback: (payload: unknown) => void) => void;
    };
  }
}

const PLAN_ORDER: Record<BillingPlanId, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

const REGION_LABELS: Record<BillingRegion, string> = {
  IN: "India",
  GLOBAL: "Global",
};

const currencyFormatters = {
  INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

export function BillingWorkspace({ initialState, initialRegion }: BillingWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [selectedRegion, setSelectedRegion] = useState<BillingRegion>(initialRegion);
  const [checkoutPlanId, setCheckoutPlanId] = useState<BillingPlanId | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showPlanCatalog, setShowPlanCatalog] = useState(initialState.plan.id === "free");

  const currentPlanId = state.plan.id;
  const currentPlanRank = PLAN_ORDER[currentPlanId];
  const periodEndLabel = formatDate(state.periodEnd);
  const currentPlanPrice = currentPlanId === "free" ? "Free" : formatPlanPrice(state.plan.id, state.billingRegion);
  const isPaidSubscriber = currentPlanId !== "free";

  useEffect(() => {
    if (currentPlanId !== "free") {
      setShowPlanCatalog(false);
      return;
    }
    setShowPlanCatalog(true);
  }, [currentPlanId]);

  const featureCatalog = useMemo(() => {
    const seen = new Set<string>();
    const orderedPlans = [...state.plans].sort((a, b) => PLAN_ORDER[b.id] - PLAN_ORDER[a.id]);
    const features: string[] = [];

    for (const plan of orderedPlans) {
      for (const feature of plan.features) {
        if (seen.has(feature)) continue;
        seen.add(feature);
        features.push(feature);
      }
    }

    return features;
  }, [state.plans]);

  const usageRows = useMemo<UsageRow[]>(
    () => [
      {
        label: "Tracked accounts",
        used: state.usage.trackedAccounts,
        limit: state.limits.trackedAccounts,
        value: formatUsageValue(state.usage.trackedAccounts, state.limits.trackedAccounts),
      },
      {
        label: "Drafts",
        used: state.usage.drafts,
        limit: state.limits.drafts,
        value: formatUsageValue(state.usage.drafts, state.limits.drafts),
      },
      {
        label: "Viral fetches",
        used: state.usage.viralFeedFetches,
        limit: state.limits.viralFeedFetches,
        value: formatUsageValue(state.usage.viralFeedFetches, state.limits.viralFeedFetches),
      },
      {
        label: "Hook generations",
        used: state.usage.hookGenerations,
        limit: state.limits.hookGenerations,
        value: formatUsageValue(state.usage.hookGenerations, state.limits.hookGenerations),
      },
      {
        label: "Scheduled posts",
        used: state.usage.scheduledPosts,
        limit: state.limits.scheduling === false ? "locked" : state.limits.scheduling.monthlyPosts,
        value:
          state.limits.scheduling === false
            ? "Locked"
            : formatUsageValue(state.usage.scheduledPosts, state.limits.scheduling.monthlyPosts),
      },
      {
        label: "Engagement opportunities",
        used: state.usage.engagementOpps,
        limit:
          state.limits.engagementFinder === false
            ? "locked"
            : state.limits.engagementFinder.monthlyOpportunities,
        value:
          state.limits.engagementFinder === false
            ? "Locked"
            : formatUsageValue(
                state.usage.engagementOpps,
                state.limits.engagementFinder.monthlyOpportunities,
              ),
      },
    ],
    [state.limits, state.usage],
  );

  const accessRows = useMemo(
    () => [
      {
        label: "Analytics",
        value: state.limits.analytics === false ? "Locked" : state.limits.analytics,
      },
      {
        label: "Variant Lab",
        value: state.limits.variantLab ? "Included" : "Locked",
      },
      {
        label: "Research Copilot",
        value: state.limits.researchCopilot ? "Included" : "Locked",
      },
      {
        label: "Growth Planner AI",
        value: state.limits.growthPlanAI ? "Included" : "Locked",
      },
      {
        label: "Relationships",
        value: state.limits.relationships ? "Included" : "Locked",
      },
    ],
    [state.limits],
  );

  async function refreshState() {
    const response = await fetch("/api/billing/subscription", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to refresh billing state.");
    }
    setState(payload as BillingSubscriptionState);
    return payload as BillingSubscriptionState;
  }

  async function handleSubscribe(planId: BillingPlanId) {
    if (planId === "free") {
      return;
    }

    try {
      setCheckoutPlanId(planId);
      await ensureRazorpayLoaded();

      const response = await fetch("/api/billing/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingRegion: selectedRegion,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<CreateSubscriptionResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create Razorpay subscription.");
      }

      if (!window.Razorpay) {
        if (payload.shortUrl) {
          window.location.assign(payload.shortUrl);
          return;
        }
        throw new Error("Razorpay checkout did not load.");
      }

      const razorpay = new window.Razorpay({
        key: payload.razorpayKeyId,
        subscription_id: payload.subscriptionId,
        name: "ViralSnipAI",
        description: `${formatPlanName(planId)} • Monthly subscription`,
        prefill: {},
        theme: {
          color: "#10b981",
        },
        modal: {
          ondismiss: () => {
            setCheckoutPlanId(null);
          },
        },
        handler: async (checkoutResponse: RazorpaySuccessResponse) => {
          try {
            const verifyResponse = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(checkoutResponse),
            });
            const verifyPayload = await verifyResponse.json().catch(() => ({}));
            if (!verifyResponse.ok) {
              throw new Error(verifyPayload.error ?? "Failed to verify Razorpay subscription.");
            }

            await refreshState();
            router.refresh();
            toast.success("Subscription updated", {
              description: `${formatPlanName(planId)} is now active on your account.`,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Verification failed.";
            toast.error("Billing verification failed", { description: message });
          } finally {
            setCheckoutPlanId(null);
          }
        },
      });

      razorpay.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      toast.error("Checkout unavailable", { description: message });
      setCheckoutPlanId(null);
    }
  }

  async function handleCancel() {
    try {
      setCancelBusy(true);
      const response = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to cancel subscription.");
      }

      const nextState = await refreshState();
      router.refresh();
      toast.success("Cancellation scheduled", {
        description:
          nextState.periodEnd
            ? `Your access remains active until ${formatDate(nextState.periodEnd)}.`
            : "Your subscription is set to cancel at period end.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel subscription.";
      toast.error("Cancellation failed", { description: message });
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {state.status === "pending" ? (
        <StatusNotice
          tone="amber"
          title="Subscription pending confirmation"
          description="Complete Razorpay checkout to activate your paid access. If payment already succeeded, refreshing this page will pull the latest subscription state."
        />
      ) : null}

      {state.cancelAtPeriodEnd ? (
        <StatusNotice
          tone="amber"
          title="Cancellation scheduled"
          description={
            state.periodEnd
              ? `Your ${formatPlanName(currentPlanId)} plan stays active until ${periodEndLabel}.`
              : "Your plan is set to end at the close of the current billing period."
          }
        />
      ) : null}

      {isPaidSubscriber ? (
        <PaidSubscriberView
          state={state}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          showPlanCatalog={showPlanCatalog}
          setShowPlanCatalog={setShowPlanCatalog}
          checkoutPlanId={checkoutPlanId}
          currentPlanId={currentPlanId}
          currentPlanRank={currentPlanRank}
          currentPlanPrice={currentPlanPrice}
          periodEndLabel={periodEndLabel}
          usageRows={usageRows}
          accessRows={accessRows}
          featureCatalog={featureCatalog}
          handleSubscribe={handleSubscribe}
          handleCancel={handleCancel}
          cancelBusy={cancelBusy}
        />
      ) : (
        <FreeCustomerView
          state={state}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          checkoutPlanId={checkoutPlanId}
          currentPlanId={currentPlanId}
          currentPlanRank={currentPlanRank}
          featureCatalog={featureCatalog}
          handleSubscribe={handleSubscribe}
          currentPlanPrice={currentPlanPrice}
          periodEndLabel={periodEndLabel}
          usageRows={usageRows}
          accessRows={accessRows}
          cancelBusy={cancelBusy}
          handleCancel={handleCancel}
        />
      )}
    </div>
  );
}

function FreeCustomerView({
  state,
  selectedRegion,
  setSelectedRegion,
  checkoutPlanId,
  currentPlanId,
  currentPlanRank,
  featureCatalog,
  handleSubscribe,
  currentPlanPrice,
  periodEndLabel,
  usageRows,
  accessRows,
  cancelBusy,
  handleCancel,
}: {
  state: BillingSubscriptionState;
  selectedRegion: BillingRegion;
  setSelectedRegion: (region: BillingRegion) => void;
  checkoutPlanId: BillingPlanId | null;
  currentPlanId: BillingPlanId;
  currentPlanRank: number;
  featureCatalog: string[];
  handleSubscribe: (planId: BillingPlanId) => void;
  currentPlanPrice: string;
  periodEndLabel: string;
  usageRows: UsageRow[];
  accessRows: { label: string; value: string }[];
  cancelBusy: boolean;
  handleCancel: () => Promise<void>;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 pt-4 text-center">
          <SectionEyebrow>Launch SnipRadar</SectionEyebrow>
          <div className="space-y-3">
            <h3 className="max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-7xl">
              Start <span className="font-serif italic font-normal text-white/95">building and monetizing</span> your X audience
            </h3>
            <p className="mx-auto max-w-2xl text-base leading-7 text-[#94a3b8]">
              Pick the plan that matches your publishing speed. Your live SnipRadar limits,
              features, and billing actions stay exactly the same, just presented with a cleaner
              acquisition flow.
            </p>
          </div>

          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.14),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mb-4 inline-flex rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
              Special offer
            </div>
            <p className="text-lg leading-8 text-[#cbd5e1]">
              Start on the free plan, then unlock higher limits, scheduling, analytics, and
              deeper X workflows the moment you are ready to scale.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(14,116,255,0.18),transparent_28%),#09090d] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:p-6 lg:p-8">
          <div className="rounded-[26px] border border-white/7 bg-[linear-gradient(180deg,rgba(10,10,15,0.98),rgba(18,18,26,0.96))] p-5 sm:p-7">
            <div className="flex flex-col gap-4 border-b border-white/6 pb-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <SectionEyebrow>Choose your plan</SectionEyebrow>
                <p className="max-w-2xl text-sm leading-6 text-[#64748b]">
                  Monthly pricing only. Switch region to preview the live Razorpay catalog backed
                  by your current billing configuration.
                </p>
              </div>

              <RegionToggle selectedRegion={selectedRegion} setSelectedRegion={setSelectedRegion} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              {state.plans.map((plan) => {
                const isCurrentPlan = currentPlanId === plan.id;
                const planRank = PLAN_ORDER[plan.id];
                const isDowngrade = planRank < currentPlanRank;
                const busy = checkoutPlanId === plan.id;
                const meta = getPlanMarketingMeta(plan.id);

                let buttonLabel = "Current plan";
                let buttonDisabled = true;

                if (plan.id === "free") {
                  buttonLabel = isCurrentPlan ? "Current plan" : "Cancel paid plan to return to free";
                  buttonDisabled = true;
                } else if (!isCurrentPlan) {
                  buttonLabel = isDowngrade ? "Cancel to downgrade" : `Upgrade to ${plan.name}`;
                  buttonDisabled = isDowngrade;
                } else if (state.status === "pending") {
                  buttonLabel = "Resume checkout";
                  buttonDisabled = false;
                }

                return (
                  <article
                    key={plan.id}
                    className={cn(
                      "relative flex min-h-[620px] flex-col rounded-[26px] border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:-translate-y-1",
                      plan.id === "free" && "border-white/10 bg-[linear-gradient(180deg,rgba(8,8,12,0.95),rgba(12,12,18,0.95))]",
                      plan.id === "plus" && "border-sky-500/30 bg-[linear-gradient(180deg,rgba(7,14,28,0.96),rgba(11,18,34,0.98))] shadow-[0_24px_70px_rgba(14,116,255,0.12)]",
                      plan.id === "pro" && "border-violet-500/25 bg-[linear-gradient(180deg,rgba(14,10,26,0.96),rgba(10,10,18,0.98))] shadow-[0_24px_70px_rgba(124,58,237,0.12)]",
                      isCurrentPlan && "ring-1 ring-[#10b981] shadow-[0_0_0_1px_rgba(124,58,237,0.4),0_30px_70px_rgba(124,58,237,0.18)]",
                    )}
                  >
                    {meta.badge ? (
                      <span className="absolute right-6 top-6 rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-300">
                        {meta.badge}
                      </span>
                    ) : null}

                    {isCurrentPlan ? (
                      <span className="absolute right-6 top-6 rounded-full bg-[#10b981] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                        Current
                      </span>
                    ) : null}

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/85 shadow-[inset_0_1px_12px_rgba(255,255,255,0.08)]">
                      <meta.icon className="h-6 w-6" />
                    </div>

                    <div className="mt-10 space-y-4">
                      <div>
                        <h4 className="text-[20px] font-bold text-white">{plan.name}</h4>
                        <p className="mt-1 text-[15px] leading-6 text-[#94a3b8]">{meta.description}</p>
                      </div>

                      <div className="flex items-end gap-1 text-white">
                        <span className="text-[42px] font-extrabold tracking-[-0.05em]">
                          {plan.id === "free" ? "Free" : formatPlanPrice(plan.id, selectedRegion)}
                        </span>
                        {plan.id !== "free" ? (
                          <span className="pb-2 text-[15px] font-medium text-[#94a3b8]">/mo</span>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      className={cn(
                        "mt-8 h-11 w-full rounded-xl border text-sm font-semibold transition-all duration-150",
                        buttonDisabled
                          ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] text-[#cbd5e1] hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))]"
                          : plan.id === "plus"
                            ? "border-sky-400/40 bg-[linear-gradient(180deg,#38bdf8,#1d4ed8)] text-white shadow-[0_12px_30px_rgba(14,116,255,0.3)] hover:brightness-110"
                            : "border-violet-400/40 bg-[linear-gradient(180deg,#34d399,#6d28d9)] text-white shadow-[0_12px_30px_rgba(124,58,237,0.3)] hover:brightness-110",
                      )}
                      disabled={buttonDisabled || busy}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening checkout...
                        </>
                      ) : (
                        buttonLabel
                      )}
                    </Button>

                    <div className="mt-8 space-y-4 border-t border-white/6 pt-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                        Includes
                      </p>
                      <ul className="space-y-3">
                        {featureCatalog.map((feature) => {
                          const included = plan.features.includes(feature);
                          return (
                            <li key={feature} className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "mt-1 flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
                                  included
                                    ? plan.id === "plus"
                                      ? "border-sky-400 bg-sky-400 text-[#020617]"
                                      : plan.id === "pro"
                                        ? "border-violet-400 bg-violet-400 text-[#09090f]"
                                        : "border-white/60 bg-white/80 text-[#09090f]"
                                    : "border-[#334155] text-[#334155]",
                                )}
                              >
                                {included ? <Check className="h-3 w-3" /> : <Circle className="h-[10px] w-[10px]" />}
                              </span>
                              <span className={included ? "text-[15px] leading-6 text-[#e2e8f0]" : "text-[15px] leading-6 text-[#475569]"}>
                                {feature}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/6 pt-6 text-center">
              <Button
                className="h-12 rounded-xl border border-sky-400/30 bg-[linear-gradient(180deg,#38bdf8,#1d4ed8)] px-8 text-[15px] font-semibold text-white shadow-[0_16px_36px_rgba(14,116,255,0.28)] hover:brightness-110"
                disabled
              >
                Start with your plan
              </Button>
              <p className="text-sm text-[#64748b]">
                Create your SnipRadar setup, then choose the plan that fits your publishing speed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[24px] border border-white/7 bg-[#12121a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="space-y-4">
            <SectionEyebrow>What you have today</SectionEyebrow>
            <div className="grid gap-4 md:grid-cols-2">
              <ManagementRow label="Current plan" value={formatPlanName(currentPlanId)} />
              <ManagementRow label="Status" value={capitalize(state.status)} />
              <ManagementRow label="Price" value={currentPlanPrice} />
              <ManagementRow
                label="Renewal"
                value={
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-[#64748b]" />
                    {periodEndLabel}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/7 bg-[#12121a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="space-y-4">
            <SectionEyebrow>Starter access</SectionEyebrow>
            <div className="space-y-3">
              {usageRows.slice(0, 3).map((row) => (
                <UsageMeter key={row.label} row={row} />
              ))}
            </div>
            <div className="grid gap-3 border-t border-white/6 pt-4">
              {accessRows.slice(0, 2).map((row) => (
                <AccessRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaidSubscriberView({
  state,
  selectedRegion,
  setSelectedRegion,
  showPlanCatalog,
  setShowPlanCatalog,
  checkoutPlanId,
  currentPlanId,
  currentPlanRank,
  currentPlanPrice,
  periodEndLabel,
  usageRows,
  accessRows,
  featureCatalog,
  handleSubscribe,
  handleCancel,
  cancelBusy,
}: {
  state: BillingSubscriptionState;
  selectedRegion: BillingRegion;
  setSelectedRegion: (region: BillingRegion) => void;
  showPlanCatalog: boolean;
  setShowPlanCatalog: (value: boolean | ((prev: boolean) => boolean)) => void;
  checkoutPlanId: BillingPlanId | null;
  currentPlanId: BillingPlanId;
  currentPlanRank: number;
  currentPlanPrice: string;
  periodEndLabel: string;
  usageRows: UsageRow[];
  accessRows: { label: string; value: string }[];
  featureCatalog: string[];
  handleSubscribe: (planId: BillingPlanId) => void;
  handleCancel: () => Promise<void>;
  cancelBusy: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#12121a] shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="border-b border-white/6 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[30px] font-bold tracking-tight text-[#f8fafc]">
                    {formatPlanName(currentPlanId)} plan
                  </h3>
                  {renderStatusBadge(state.status)}
                </div>
                <p className="text-lg font-medium text-[#e2e8f0]">Monthly</p>
                <p className="text-sm leading-6 text-[#64748b]">
                  {state.cancelAtPeriodEnd
                    ? `Your subscription remains active until ${periodEndLabel}.`
                    : `Your subscription will auto renew on ${periodEndLabel}.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                className="h-11 rounded-xl border border-white/10 px-5 text-[14px] font-semibold text-[#e2e8f0] hover:border-white/20 hover:bg-white/[0.04]"
                onClick={() => setShowPlanCatalog((value) => !value)}
              >
                Adjust plan
                <ChevronDown
                  className={cn(
                    "ml-2 h-4 w-4 transition-transform duration-150",
                    showPlanCatalog ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            </div>
          </div>
        </div>

        {showPlanCatalog ? (
          <div className="space-y-5 border-b border-white/6 px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <SectionEyebrow>Adjust Plan</SectionEyebrow>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">
                  Change billing region pricing or move to another monthly plan. Downgrades still
                  route through cancellation.
                </p>
              </div>
              <RegionToggle selectedRegion={selectedRegion} setSelectedRegion={setSelectedRegion} />
            </div>

            <PlanCatalog
              state={state}
              selectedRegion={selectedRegion}
              currentPlanId={currentPlanId}
              currentPlanRank={currentPlanRank}
              checkoutPlanId={checkoutPlanId}
              featureCatalog={featureCatalog}
              handleSubscribe={handleSubscribe}
            />
          </div>
        ) : null}

        <div className="px-6 py-2 lg:px-8">
          <ManagementSection title="Subscription">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="grid gap-3 md:grid-cols-2">
                <ManagementRow label="Plan" value={formatPlanName(currentPlanId)} />
                <ManagementRow label="Status" value={capitalize(state.status)} />
                <ManagementRow label="Billing region" value={REGION_LABELS[state.billingRegion]} />
                <ManagementRow label="Price" value={currentPlanPrice} />
                <ManagementRow
                  label="Renewal"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-[#64748b]" />
                      {periodEndLabel}
                    </span>
                  }
                />
                <ManagementRow
                  label="Provider"
                  value={state.currentProvider === "free" ? "Free" : "Razorpay"}
                />
                <ManagementRow
                  label="Referral"
                  value={
                    state.referralCode
                      ? `${state.referralCode}${state.referredBy ? ` • referred by ${state.referredBy}` : ""}`
                      : "Not assigned"
                  }
                />
                <ManagementRow
                  label="Promo"
                  value={
                    state.promoCode
                      ? state.promoCode
                      : state.freeMonthsCredit > 0
                        ? `${state.freeMonthsCredit} free month credit`
                        : "None"
                  }
                />
              </div>

              {!state.cancelAtPeriodEnd ? (
                <Button
                  variant="ghost"
                  className="h-11 rounded-xl border border-white/10 px-5 text-[14px] font-semibold text-[#e2e8f0] hover:border-white/20 hover:bg-white/[0.04]"
                  onClick={() => setShowPlanCatalog(true)}
                >
                  Adjust plan
                </Button>
              ) : null}
            </div>
          </ManagementSection>

          <ManagementSection title="Usage this month">
            <div className="space-y-3.5">
              {usageRows.map((row) => (
                <UsageMeter key={row.label} row={row} />
              ))}
            </div>
          </ManagementSection>

          <ManagementSection title="Access profile">
            <div className="space-y-3">
              {accessRows.map((row) => (
                <AccessRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </ManagementSection>

          <ManagementSection title="Cancellation" borderless>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[#f8fafc]">Cancel plan</p>
                <p className="max-w-xl text-sm leading-6 text-[#64748b]">
                  Cancel at period end to downgrade back to free once the current billing cycle
                  completes.
                </p>
              </div>

              {!state.cancelAtPeriodEnd ? (
                <Button
                  className="h-11 rounded-xl border border-[#ef4444] bg-[#b91c1c] px-5 text-[14px] font-semibold text-white hover:bg-[#991b1b]"
                  onClick={() => void handleCancel()}
                  disabled={cancelBusy}
                >
                  {cancelBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling cancellation...
                    </>
                  ) : (
                    "Cancel"
                  )}
                </Button>
              ) : (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
                  Cancellation scheduled
                </span>
              )}
            </div>
          </ManagementSection>
        </div>
      </section>
    </div>
  );
}

function RegionToggle({
  selectedRegion,
  setSelectedRegion,
}: {
  selectedRegion: BillingRegion;
  setSelectedRegion: (region: BillingRegion) => void;
}) {
  return (
    <div className="inline-flex w-fit items-center rounded-full border border-white/8 bg-[#1e1e2e] p-[3px]">
      {(["IN", "GLOBAL"] as BillingRegion[]).map((region) => (
        <button
          key={region}
          type="button"
          onClick={() => setSelectedRegion(region)}
          className={cn(
            "rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-150",
            selectedRegion === region
              ? "bg-[#10b981] text-white shadow-[0_0_18px_rgba(124,58,237,0.35)]"
              : "text-[#64748b] hover:text-[#cbd5e1]",
          )}
        >
          {REGION_LABELS[region]}
        </button>
      ))}
    </div>
  );
}

function PlanCatalog({
  state,
  selectedRegion,
  currentPlanId,
  currentPlanRank,
  checkoutPlanId,
  featureCatalog,
  handleSubscribe,
}: {
  state: BillingSubscriptionState;
  selectedRegion: BillingRegion;
  currentPlanId: BillingPlanId;
  currentPlanRank: number;
  checkoutPlanId: BillingPlanId | null;
  featureCatalog: string[];
  handleSubscribe: (planId: BillingPlanId) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {state.plans.map((plan) => {
        const isCurrentPlan = currentPlanId === plan.id;
        const planRank = PLAN_ORDER[plan.id];
        const isDowngrade = planRank < currentPlanRank;
        const busy = checkoutPlanId === plan.id;
        const description =
          plan.id === "free"
            ? "Try the core workflow"
            : plan.id === "plus"
              ? "For active solo operators"
              : "For full SnipRadar access";

        let buttonLabel = "Current plan";
        let buttonDisabled = true;

        if (plan.id === "free") {
          buttonLabel = isCurrentPlan ? "Current plan" : "Cancel paid plan to return to free";
          buttonDisabled = true;
        } else if (!isCurrentPlan) {
          buttonLabel = isDowngrade ? "Cancel to downgrade" : `Upgrade to ${plan.name}`;
          buttonDisabled = isDowngrade;
        } else if (state.status === "pending") {
          buttonLabel = "Resume checkout";
          buttonDisabled = false;
        }

        const priceLabel = plan.id === "free" ? "Free" : formatPlanPrice(plan.id, selectedRegion);

        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex h-full flex-col rounded-[18px] border p-6 transition-all duration-150 hover:scale-[1.01]",
              plan.id === "free" &&
                "border-[rgba(255,255,255,0.06)] bg-[#12121a] hover:border-[rgba(255,255,255,0.1)]",
              plan.id === "plus" &&
                "border-[rgba(255,255,255,0.1)] bg-[rgba(124,58,237,0.04)] hover:border-[rgba(255,255,255,0.16)] hover:bg-[#16161f]",
              plan.id === "pro" && "bg-[#151521] hover:bg-[#181824]",
              isCurrentPlan && "border-[#10b981] shadow-[0_0_30px_rgba(124,58,237,0.2)]",
            )}
          >
            {isCurrentPlan ? (
              <span className="absolute right-5 top-5 rounded-full bg-[#10b981] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                Current
              </span>
            ) : null}

            <div className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-[18px] font-bold text-[#f1f5f9]">{plan.name}</h4>
                  <p className="text-[13px] text-[#64748b]">{description}</p>
                </div>

                <div className="space-y-1">
                  <div
                    className={cn(
                      "text-[38px] font-extrabold tracking-[-0.04em]",
                      plan.id === "free" ? "text-[#64748b]" : "text-[#f1f5f9]",
                    )}
                  >
                    {priceLabel}
                  </div>
                  <p className="text-[12px] text-[#64748b]">per month</p>
                </div>
              </div>

              <ul className="space-y-2.5">
                {featureCatalog.map((feature) => {
                  const included = plan.features.includes(feature);
                  return (
                    <li key={feature} className="flex items-start gap-2 text-[13px] text-[#94a3b8]">
                      <span
                        className={cn(
                          "mt-[2px] flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
                          included
                            ? "border-[#22c55e] bg-[#22c55e] text-[#0a0a0f]"
                            : "border-[#334155] text-[#334155]",
                        )}
                      >
                        {included ? <Check className="h-3 w-3" /> : <Circle className="h-[10px] w-[10px]" />}
                      </span>
                      <span className={included ? "text-[#cbd5e1]" : "text-[#475569]"}>{feature}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6">
              <Button
                className={cn(
                  "h-10 w-full rounded-lg border text-sm font-semibold transition-all duration-150",
                  buttonDisabled
                    ? "border-[#334155] bg-transparent text-[#64748b] hover:border-[#475569] hover:bg-transparent hover:text-[#94a3b8]"
                    : "border-[#10b981] bg-[#10b981] text-white shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:bg-[#6d28d9]",
                )}
                disabled={buttonDisabled || busy}
                onClick={() => handleSubscribe(plan.id)}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    {plan.id !== "free" && !buttonDisabled ? <CreditCard className="mr-2 h-4 w-4" /> : null}
                    {buttonLabel}
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubscriptionSidebar({
  state,
  currentPlanId,
  currentPlanPrice,
  periodEndLabel,
  usageRows,
  accessRows,
  cancelBusy,
  handleCancel,
}: {
  state: BillingSubscriptionState;
  currentPlanId: BillingPlanId;
  currentPlanPrice: string;
  periodEndLabel: string;
  usageRows: UsageRow[];
  accessRows: { label: string; value: string }[];
  cancelBusy: boolean;
  handleCancel: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-white/7 bg-[#12121a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
      <div className="space-y-6">
        <div className="space-y-4 border-b border-white/5 pb-6">
          <SectionEyebrow>Current Subscription</SectionEyebrow>
          <div className="space-y-3">
            <SubscriptionRow label="Plan" value={formatPlanName(currentPlanId)} />
            <SubscriptionRow label="Status" value={renderStatusBadge(state.status)} />
            <SubscriptionRow label="Billing region" value={REGION_LABELS[state.billingRegion]} />
            <SubscriptionRow label="Price" value={currentPlanPrice} />
            <SubscriptionRow
              label="Renewal"
              value={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-[#64748b]" />
                  {periodEndLabel}
                </span>
              }
            />
            <SubscriptionRow
              label="Provider"
              value={state.currentProvider === "free" ? "Free" : "Razorpay"}
            />
            <SubscriptionRow
              label="Referral"
              value={
                state.referralCode
                  ? `${state.referralCode}${state.referredBy ? ` • referred by ${state.referredBy}` : ""}`
                  : "Not assigned"
              }
            />
            <SubscriptionRow
              label="Promo"
              value={
                state.promoCode
                  ? state.promoCode
                  : state.freeMonthsCredit > 0
                    ? `${state.freeMonthsCredit} free month credit`
                    : "None"
              }
            />
          </div>

          {state.plan.id !== "free" && !state.cancelAtPeriodEnd ? (
            <Button
              className="h-9 w-full rounded-lg border border-[#ef4444] bg-transparent text-[13px] font-medium text-[#ef4444] hover:bg-[#ef4444]/10 hover:text-[#f87171]"
              variant="ghost"
              onClick={() => void handleCancel()}
              disabled={cancelBusy}
            >
              {cancelBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling cancellation...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Cancel at period end
                </>
              )}
            </Button>
          ) : null}
        </div>

        <div className="space-y-4 border-b border-white/5 pb-6">
          <SectionEyebrow>Usage This Month</SectionEyebrow>
          <div className="space-y-3.5">
            {usageRows.map((row) => (
              <UsageMeter key={row.label} row={row} />
            ))}
          </div>
        </div>

        <div className="space-y-4 border-b border-white/5 pb-6">
          <SectionEyebrow>Access Profile</SectionEyebrow>
          <div className="space-y-3">
            {accessRows.map((row) => (
              <AccessRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-[rgba(59,130,246,0.2)] border-l-[3px] border-l-[#3b82f6] bg-[rgba(59,130,246,0.08)] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[#60a5fa]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#dbeafe]">Cutover note</p>
              <p className="text-[12px] leading-6 text-[#64748b]">
                Active billing now uses the canonical free, plus, and pro plan model. Legacy
                plan aliases remain internal compatibility mappings only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getPlanMarketingMeta(planId: BillingPlanId) {
  if (planId === "plus") {
    return {
      icon: Rocket,
      description: "Scale your X workflow with full Discover, Create, and publishing velocity.",
      badge: "Top choice",
    };
  }

  if (planId === "pro") {
    return {
      icon: Gem,
      description: "Run the complete SnipRadar operating system with analytics, AI, and relationships.",
      badge: null,
    };
  }

  return {
    icon: Compass,
    description: "Start building your audience with the core SnipRadar workflow and safe limits.",
    badge: null,
  };
}

function ManagementSection({
  title,
  children,
  borderless = false,
}: {
  title: string;
  children: ReactNode;
  borderless?: boolean;
}) {
  return (
    <section className={cn("py-6", borderless ? "" : "border-b border-white/6")}>
      <div className="space-y-4">
        <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
          {title}
        </h4>
        {children}
      </div>
    </section>
  );
}

function ManagementRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#64748b]">{label}</p>
      <div className="mt-2 text-sm font-semibold text-[#f8fafc]">{value}</div>
    </div>
  );
}

function StatusNotice({
  tone,
  title,
  description,
}: {
  tone: "amber";
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4",
        tone === "amber" && "border-amber-500/20 bg-amber-500/[0.08]",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-200">{title}</p>
          <p className="text-sm leading-6 text-amber-100/70">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">{children}</p>
  );
}

function SubscriptionRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#64748b]">{label}</span>
      <div className="text-right text-sm font-semibold text-[#f1f5f9]">{value}</div>
    </div>
  );
}

function UsageMeter({ row }: { row: UsageRow }) {
  const progress = resolveUsageProgress(row.used, row.limit);
  const mutedUnlimited = row.limit === "unlimited";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-3">
      <span className="text-sm text-[#94a3b8]">{row.label}</span>
      <div className="h-1 rounded-full bg-[#1e1e2e]">
        <div
          className={cn(
            "h-1 rounded-full transition-[width] duration-700 ease-out",
            mutedUnlimited ? "bg-violet-500/45" : "bg-[#10b981]",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-right text-[13px] font-medium text-[#f1f5f9]">{formatUsageDisplay(row.value)}</span>
    </div>
  );
}

function AccessRow({ label, value }: { label: string; value: string }) {
  const included = value === "Included";
  const analyticsBadge = value !== "Locked" && value !== "Included";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#94a3b8]">{label}</span>
      {included ? (
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#22c55e]">
          <Check className="h-4 w-4" />
          Included
        </span>
      ) : analyticsBadge ? (
        <span className="rounded-md bg-[rgba(124,58,237,0.12)] px-2 py-1 text-xs font-semibold text-[#a78bfa]">
          {value}
        </span>
      ) : (
        <span className="text-sm font-semibold text-[#64748b]">{value}</span>
      )}
    </div>
  );
}

function renderStatusBadge(status: string) {
  const normalized = capitalize(status);
  const active = status === "active";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active
          ? "bg-[rgba(34,197,94,0.12)] text-[#22c55e]"
          : "bg-white/5 text-[#cbd5e1]",
      )}
    >
      {normalized}
    </span>
  );
}

function resolveUsageProgress(used: number, limit: number | "unlimited" | "locked") {
  if (limit === "locked") return 0;
  if (limit === "unlimited") return 10;
  if (limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

function formatUsageDisplay(value: string) {
  const [used, limit] = value.split(" / ");
  if (!limit) return value;
  return (
    <>
      <span className="text-[#f1f5f9]">{used}</span>
      <span className="text-[#475569]"> / {limit}</span>
    </>
  );
}

function formatPlanName(planId: BillingPlanId) {
  if (planId === "plus") return "Plus";
  if (planId === "pro") return "Pro";
  return "Free";
}

function formatPlanPrice(planId: BillingPlanId, region: BillingRegion) {
  if (planId === "free") return "Free";
  const amount = planId === "plus" ? (region === "IN" ? 499 : 9.99) : region === "IN" ? 2199 : 29.99;
  return region === "IN"
    ? currencyFormatters.INR.format(amount)
    : currencyFormatters.USD.format(amount);
}

function formatUsageValue(used: number, limit: number | "unlimited") {
  if (limit === "unlimited") {
    return `${used} / Unlimited`;
  }
  return `${used} / ${limit}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

let razorpayScriptPromise: Promise<void> | null = null;

function ensureRazorpayLoaded() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout can only run in the browser."));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }
  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}
