"use client";

import { ArrowRight, CheckCircle2, Compass, PenLine, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FirstSessionCardProps = {
  selectedNiche: string | null;
  trackedAccounts: number;
  viralTweets: number;
  drafts: number;
  scheduledDrafts: number;
  postedDrafts: number;
  onOpenDiscover: () => void;
  onOpenCreate: () => void;
  onOpenPublish: () => void;
};

export function SnipRadarFirstSessionCard({
  selectedNiche,
  trackedAccounts,
  viralTweets,
  drafts,
  scheduledDrafts,
  postedDrafts,
  onOpenDiscover,
  onOpenCreate,
  onOpenPublish,
}: FirstSessionCardProps) {
  const steps = [
    {
      id: "discover",
      title: "Explore your seeded radar",
      description:
        trackedAccounts > 0
          ? `${trackedAccounts} starter accounts are being tracked${selectedNiche ? ` for ${selectedNiche}` : ""}.`
          : "Starter accounts will appear here after connect and the first fetch.",
      status:
        viralTweets > 0 ? `${viralTweets} fresh tweets ready` : trackedAccounts > 0 ? "Waiting for first fetch" : "Needs setup",
      done: trackedAccounts > 0 && viralTweets > 0,
      cta: "Open Discover",
      onClick: onOpenDiscover,
      icon: Compass,
    },
    {
      id: "drafts",
      title: "Generate your first draft batch",
      description: "Turn live patterns into a first set of posts you can edit, remix, and score.",
      status: drafts > 0 ? `${drafts} drafts ready` : "No drafts yet",
      done: drafts > 0,
      cta: "Open Create",
      onClick: onOpenCreate,
      icon: PenLine,
    },
    {
      id: "publish",
      title: postedDrafts > 0 ? "Keep the momentum going" : "Queue your first post",
      description:
        postedDrafts > 0
          ? `${postedDrafts} SnipRadar post${postedDrafts === 1 ? "" : "s"} already shipped.`
          : "Scheduling the first draft is the fastest route to SnipRadar activation.",
      status:
        postedDrafts > 0
          ? `${postedDrafts} posted`
          : scheduledDrafts > 0
            ? `${scheduledDrafts} scheduled`
            : "Nothing on the calendar yet",
      done: scheduledDrafts > 0 || postedDrafts > 0,
      cta: "Open Publish",
      onClick: onOpenPublish,
      icon: CalendarClock,
    },
  ] as const;

  const completedCount = steps.filter((step) => step.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/[0.09] via-card to-card p-5">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-300/70">
              First Session
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              Build the first SnipRadar win in one sitting
            </h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              The activation path is simple: confirm the seeded radar, turn patterns into drafts, then queue the first
              post. {selectedNiche ? `Everything here is tuned for your ${selectedNiche} niche.` : "Pick one clear niche and move through the flow once."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Activation progress</span>
              <span className="font-semibold text-foreground">{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-2xl border p-4",
                  step.done ? "border-emerald-500/25 bg-emerald-500/[0.07]" : "border-border/60 bg-background/35"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        step.done ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary"
                      )}
                    >
                      {step.done ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className={cn("text-xs", step.done ? "text-emerald-400" : "text-muted-foreground")}>{step.status}</p>
                  <Button size="sm" variant={step.done ? "outline" : "default"} className="gap-1.5" onClick={step.onClick}>
                    {step.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
