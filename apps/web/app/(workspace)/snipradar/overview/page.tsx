"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FeatureNavCards } from "@/components/snipradar/feature-nav-cards";
import { SnipRadarActivationCard } from "@/components/snipradar/activation-card";
import { SnipRadarFirstSessionCard } from "@/components/snipradar/first-session-card";
import { GrowthCoachCard } from "@/components/snipradar/growth-coach-card";
import { GrowthStats } from "@/components/snipradar/growth-stats";
import { LowDataGuidanceCard } from "@/components/snipradar/low-data-guidance-card";
import { ProfileAuditCard } from "@/components/snipradar/profile-audit-card";
import { WorkflowSteps } from "@/components/snipradar/workflow-steps";
import { useSnipRadar } from "@/components/snipradar/snipradar-context";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { trackSnipRadarEvent } from "@/lib/snipradar/events";

export default function SnipRadarOverviewPage() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { account, profile, stats, counts, statsPeriodDays, setStatsPeriodDays } = useSnipRadar();

  useEffect(() => {
    trackSnipRadarEvent("snipradar_overview_view", {
      trackedAccounts: counts.trackedAccounts,
      drafts: counts.drafts,
      postedDrafts: counts.postedDrafts,
      avgImpressionsPerPost: stats.avgImpressionsPerPost,
    });
  }, [counts.drafts, counts.postedDrafts, counts.trackedAccounts, stats.avgImpressionsPerPost]);

  const showLowDataGuidance = useMemo(() => {
    if (!flags.snipRadarOverviewV2Enabled) {
      return false;
    }
    return (
      counts.postedDrafts < 3 ||
      stats.avgImpressionsPerPost <= 5 ||
      stats.avgEngagementRate <= 0
    );
  }, [
    counts.postedDrafts,
    flags.snipRadarOverviewV2Enabled,
    stats.avgEngagementRate,
    stats.avgImpressionsPerPost,
  ]);

  const checklist = useMemo(
    () => [
      { label: "X account connected", done: Boolean(account) },
      { label: "Publish 3 SnipRadar drafts", done: counts.postedDrafts >= 3 },
      { label: "Gather baseline engagement signals", done: stats.avgImpressionsPerPost > 5 },
    ],
    [account, counts.postedDrafts, stats.avgImpressionsPerPost],
  );

  const showFirstSessionCard = useMemo(
    () =>
      counts.postedDrafts === 0 ||
      counts.drafts === 0 ||
      counts.viralTweets === 0 ||
      counts.scheduledDrafts === 0,
    [counts.drafts, counts.postedDrafts, counts.scheduledDrafts, counts.viralTweets],
  );

  return (
    <div className="space-y-6">
      {showFirstSessionCard ? (
        <SnipRadarFirstSessionCard
          selectedNiche={profile.selectedNiche}
          trackedAccounts={counts.trackedAccounts}
          viralTweets={counts.viralTweets}
          drafts={counts.drafts}
          scheduledDrafts={counts.scheduledDrafts}
          postedDrafts={counts.postedDrafts}
          onOpenDiscover={() => router.push("/snipradar/discover")}
          onOpenCreate={() => router.push("/snipradar/create/drafts")}
          onOpenPublish={() => router.push("/snipradar/publish/calendar")}
        />
      ) : null}

      <GrowthStats
        followerCount={stats.followerCount}
        followerGrowth7d={stats.followerGrowth7d}
        tweetsPosted={stats.tweetsPosted}
        actualTweetCount={stats.actualTweetCount}
        avgEngagementRate={stats.avgEngagementRate}
        avgImpressionsPerPost={stats.avgImpressionsPerPost}
        periodDays={statsPeriodDays}
        onPeriodChange={setStatsPeriodDays}
        impressionsTrend={stats.impressionsTrend}
      />

      <SnipRadarActivationCard />

      <ProfileAuditCard />

      {showLowDataGuidance ? (
        <LowDataGuidanceCard
          checklist={checklist}
          onGoCreate={() => {
            trackSnipRadarEvent("snipradar_overview_drafts_pill_click", { source: "guidance_card" });
            router.push("/snipradar/create/drafts");
          }}
        />
      ) : null}

      <GrowthCoachCard />

      <WorkflowSteps
        trackedCount={counts.trackedAccounts}
        viralCount={counts.viralTweets}
        analyzedCount={counts.analyzedViralTweets}
        draftCount={counts.drafts}
        onDraftsReadyClick={() => {
          trackSnipRadarEvent("snipradar_overview_drafts_pill_click", { source: "workflow_steps" });
          router.push("/snipradar/create/drafts");
        }}
      />

      <FeatureNavCards trackedCount={counts.trackedAccounts} draftCount={counts.drafts + counts.scheduledDrafts} />
    </div>
  );
}
