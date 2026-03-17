"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, Loader2, Radar, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { SNIPRADAR_STARTER_NICHES } from "@/lib/snipradar/starter-accounts";

const GOALS = [
  {
    id: "build_audience",
    label: "Build audience",
    description: "Grow reach and turn posting into a repeatable audience engine.",
  },
  {
    id: "drive_leads",
    label: "Drive leads",
    description: "Use X as a top-of-funnel channel for calls, signups, or waitlists.",
  },
  {
    id: "ship_consistently",
    label: "Post consistently",
    description: "Reduce blank-page time and publish on a dependable cadence.",
  },
  {
    id: "sell_products",
    label: "Sell products",
    description: "Package ideas into posts that convert attention into revenue.",
  },
] as const;

export default function SnipRadarOnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(session?.user?.name ?? "");
  const [goalSelection, setGoalSelection] = useState<(typeof GOALS)[number]["id"] | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [name, session?.user?.name]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin?callbackUrl=/snipradar-onboarding");
      return;
    }

    if (session?.user?.onboardingCompleted) {
      router.replace("/snipradar/overview");
    }
  }, [router, session?.user?.onboardingCompleted, status]);

  const selectedNicheMeta = useMemo(
    () => SNIPRADAR_STARTER_NICHES.find((niche) => niche.label === selectedNiche) ?? null,
    [selectedNiche],
  );

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated" || session?.user?.onboardingCompleted) {
    return null;
  }

  async function handleSubmit() {
    if (!goalSelection || !selectedNiche) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/snipradar/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goalSelection,
          selectedNiche,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to finish onboarding");
      }

      await fetch("/api/ecosystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ecosystem: "x" }),
      });
      await update();

      toast({
        title: "SnipRadar is ready",
        description: "Next step: connect X so we can seed your radar and fetch the first patterns.",
      });
      router.replace(data.redirectTo ?? "/snipradar/discover?welcome=1");
    } catch (error) {
      toast({
        title: "Onboarding failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  }

  const progressPct = Math.round((step / 3) * 100);

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              <Radar className="h-3.5 w-3.5" />
              SnipRadar setup
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Launch your X workflow with the right niche, feed, and first actions.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-400">
                This setup keeps activation focused: choose a goal, pick your niche, then connect
                X so SnipRadar can seed your radar with starter accounts and guide the first post.
              </p>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
                <span>Step {step} of 3</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold text-white">Name your workspace</p>
                    <p className="mt-1 text-sm text-slate-400">
                      We’ll use this to personalize the SnipRadar workspace and saved outputs.
                    </p>
                  </div>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name or brand"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/60"
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => setStep(2)} className="gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold text-white">What should SnipRadar optimize for?</p>
                    <p className="mt-1 text-sm text-slate-400">
                      This sets the default activation path and keeps the next actions relevant.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {GOALS.map((goal) => {
                      const active = goalSelection === goal.id;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setGoalSelection(goal.id)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-violet-400/60 bg-violet-500/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{goal.label}</p>
                            {active ? <Check className="h-4 w-4 text-violet-300" /> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{goal.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={!goalSelection} className="gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold text-white">Pick your starter niche</p>
                    <p className="mt-1 text-sm text-slate-400">
                      SnipRadar will use this to seed your first tracked accounts and guide early
                      drafts, research, and hooks.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {SNIPRADAR_STARTER_NICHES.map((niche) => {
                      const active = selectedNiche === niche.label;
                      return (
                        <button
                          key={niche.id}
                          type="button"
                          onClick={() => setSelectedNiche(niche.label)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-cyan-400/50 bg-cyan-500/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{niche.label}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-400">{niche.description}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                Starter radar: {niche.handles.map((handle) => `@${handle}`).join(", ")}
                              </p>
                            </div>
                            {active ? <Check className="mt-1 h-4 w-4 text-cyan-300" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={!selectedNiche || isSubmitting} className="gap-2">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Finish setup
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Target className="h-3.5 w-3.5" />
              First-run plan
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">1. Connect X</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  OAuth or read-only connect unlocks live account data and lets SnipRadar start the
                  radar for your niche.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">2. Seed your radar</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  We’ll add starter accounts automatically based on your niche so Discover is not
                  empty on day one.
                </p>
                {selectedNicheMeta ? (
                  <p className="mt-2 text-xs text-cyan-200">
                    Current seed set: {selectedNicheMeta.handles.map((handle) => `@${handle}`).join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">3. Generate and schedule</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Once the first viral patterns land, Create and Publish take over with guided next
                  actions instead of empty states.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
