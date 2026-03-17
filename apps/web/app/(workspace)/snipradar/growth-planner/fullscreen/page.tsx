"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useBillingSubscriptionState } from "@/hooks/use-billing-subscription";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";

const PLAN = [
  {
    phase: "Foundation",
    week: "Week 1-2",
    lift: "+4% to +10%",
    actions: [
      "Train AI on your last 50 posts and lock one KPI",
      "Create 10 hook starters aligned to your niche",
      "Publish 5x/week and collect baseline engagement signals",
      "Build a repeatable post template in Create"
    ],
  },
  {
    phase: "Acceleration",
    week: "Week 3-6",
    lift: "+12% to +25%",
    actions: [
      "Ship 1 strong opinion post and 1 tactical thread weekly",
      "Reply to 20 targeted niche conversations daily",
      "Test 2 new post formats per week",
      "Double down on winners from top-performing posts"
    ],
  },
  {
    phase: "Scale",
    week: "Week 7+",
    lift: "+20% to +40%",
    actions: [
      "Turn best posts into lead magnets or assets",
      "Collaborate with adjacent creators weekly",
      "Systemize ideation -> draft -> publish workflow",
      "Review analytics and iterate themes every week"
    ],
  },
];

export default function SnipRadarGrowthPlannerFullscreenPage() {
  const billingQuery = useBillingSubscriptionState();
  const growthPlannerLocked = billingQuery.data ? !billingQuery.data.limits.growthPlanAI : false;

  if (growthPlannerLocked) {
    return (
      <div className="space-y-5">
        <Badge variant="secondary">AI Personalized Strategy</Badge>
        <SnipRadarBillingGateCard
          details={{
            kind: "upgrade_required",
            feature: "growthPlanAI",
            currentPlan: billingQuery.data!.plan.id,
            requiredPlan: "pro",
            upgradePlan: "pro",
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary">AI Personalized Strategy</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">X Growth Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          Full-screen phased plan optimized for consistency, engagement, and compounding growth.
        </p>
      </div>

      <div className="space-y-4">
        {PLAN.map((item, idx) => (
          <Card key={item.phase} className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-fit">
                    {item.week}
                  </Badge>
                  <Badge variant="secondary" className="w-fit">
                    Est. Lift {item.lift}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Phase {idx + 1}</p>
              </div>
              <CardTitle className="text-lg">{item.phase}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.actions.map((action) => (
                <div
                  key={action}
                  className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{action}</span>
                </div>
              ))}
              <Button
                asChild
                size="sm"
                className="mt-2 h-8 gap-1.5"
                onClick={() =>
                  trackSnipRadarEvent("snipradar_growth_plan_generate_click", {
                    phase: item.phase,
                    location: "fullscreen",
                  })
                }
              >
                <Link href={`/snipradar/create/drafts?phase=${encodeURIComponent(item.phase)}`}>
                  Generate Drafts for this phase
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
