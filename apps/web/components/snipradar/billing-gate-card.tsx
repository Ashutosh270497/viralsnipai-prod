"use client";

import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getBillingPlanLabel,
  getSnipRadarBillingGateCtaLabel,
  getSnipRadarBillingGateDescription,
  getSnipRadarBillingGateTitle,
  type SnipRadarBillingGateDetails,
} from "@/lib/snipradar/billing-gates";

export function SnipRadarBillingGateCard({
  details,
  title,
  description,
  compact = false,
  href = "/billing",
}: {
  details?: SnipRadarBillingGateDetails | null;
  title?: string;
  description?: string;
  compact?: boolean;
  href?: string;
}) {
  const resolvedTitle = title ?? (details ? getSnipRadarBillingGateTitle(details) : "Upgrade required");
  const resolvedDescription =
    description ??
    (details
      ? getSnipRadarBillingGateDescription(details)
      : "Upgrade your billing plan to continue with this workflow.");
  const badgeLabel =
    details?.upgradePlan
      ? `Recommended: ${getBillingPlanLabel(details.upgradePlan)}`
      : details?.requiredPlan
        ? `Required: ${getBillingPlanLabel(details.requiredPlan)}`
        : "Billing";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-background to-background",
        compact ? "p-4" : "p-5"
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              {details?.kind === "usage_limit_reached" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
              {badgeLabel}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{resolvedTitle}</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{resolvedDescription}</p>
          </div>
        </div>

        <Button asChild className="gap-1.5 self-start md:self-center">
          <Link href={href}>
            {details ? getSnipRadarBillingGateCtaLabel(details) : "View plans"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
