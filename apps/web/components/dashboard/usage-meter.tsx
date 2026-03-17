"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UsageStats } from "@/types/dashboard";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { getCommercialPlan, planHasUnlimitedCoreUsage, resolvePlanTier } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  usageStats: UsageStats[];
  subscriptionTier: string;
}

export function UsageMeter({ usageStats, subscriptionTier }: UsageMeterProps) {
  const router = useRouter();
  const tier = resolvePlanTier(subscriptionTier);
  const plan = getCommercialPlan(tier);
  const isFreeTier = tier === "free";
  const isUnlimited = planHasUnlimitedCoreUsage(tier);

  // Check if any feature is approaching limit (>80%)
  const hasWarning = usageStats.some(stat => stat.limit !== null && stat.percentage > 80);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Usage This Month
        </h3>
        <Zap className="h-5 w-5 text-yellow-500" />
      </div>

      {isUnlimited ? (
        <div className="mt-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4 dark:from-blue-950/30 dark:to-purple-950/30">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {plan.name} plan active
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Monthly caps are removed for ideas, scripts, titles, and thumbnails on this plan.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {usageStats.map((stat) => {
            const isOverLimit = stat.limit !== null && stat.count > stat.limit;
            const isNearLimit = stat.limit !== null && stat.percentage > 80 && !isOverLimit;

            return (
              <div key={stat.feature} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {stat.feature}
                  </span>
                  <span className={cn(
                    "text-xs",
                    isOverLimit ? "text-red-600 font-semibold" : "text-muted-foreground"
                  )}>
                    {stat.count} / {stat.limit === null ? '∞' : stat.limit}
                  </span>
                </div>
                <Progress
                  value={Math.min(stat.percentage, 100)}
                  className={cn(
                    "h-2",
                    isOverLimit && "bg-red-100 dark:bg-red-900/20",
                    isNearLimit && "bg-yellow-100 dark:bg-yellow-900/20"
                  )}
                  indicatorClassName={cn(
                    isOverLimit && "bg-red-500",
                    isNearLimit && "bg-yellow-500",
                    !isOverLimit && !isNearLimit && "bg-blue-500"
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Upgrade CTA */}
      {!isUnlimited && (
        <div className="mt-6">
          {hasWarning && (
            <div className="mb-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                You&apos;re approaching your monthly limits
              </p>
            </div>
          )}
          <Button
            className="w-full"
            variant={hasWarning ? "default" : "outline"}
            onClick={() => router.push("/pricing")}
          >
            <Zap className="mr-2 h-4 w-4" />
            {isFreeTier ? "Upgrade to Start Creating" : "Compare higher-capacity plans"}
          </Button>
        </div>
      )}

      {isUnlimited && (
        <div className="mt-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/pricing")}
          >
            View Plans
          </Button>
        </div>
      )}
    </Card>
  );
}
