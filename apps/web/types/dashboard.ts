import { PLAN_LIMITS, type PlanTier } from "@/lib/billing/plans";

export interface DashboardMetrics {
  // Content Stats
  totalIdeas: number;
  scriptedIdeas: number;
  publishedIdeas: number;
  averageViralityScore: number;

  // Usage Stats
  creditsUsed: number;
  creditsRemaining: number;
  subscriptionTier: string;
  nextBillingDate?: Date;

  // Growth Indicators
  weekOverWeekGrowth: number;
  mostPopularNiche: string;
  topKeyword: string;
}

export interface RecentActivityItem {
  id: string;
  type: 'idea' | 'script' | 'title' | 'thumbnail';
  title: string;
  status: 'draft' | 'scripted' | 'published';
  viralityScore?: number;
  createdAt: Date;
  niche?: string;
}

export interface UsageStats {
  feature: string;
  count: number;
  limit: number | null; // null = unlimited
  percentage: number;
}

export interface InsightItem {
  id: string;
  type: 'tip' | 'trend' | 'opportunity' | 'warning';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
  url?: string;
  description?: string;
  completedAt?: string | null;
  emphasis?: 'milestone' | 'aha' | 'activation';
}

export interface ActivationSummary {
  ecosystemLabel: string;
  activated: boolean;
  activationEventLabel: string;
  activationCompletedAt?: string | null;
  ahaMoment: string;
  successThreshold: string;
  progressPct: number;
  completedSteps: number;
  totalSteps: number;
  nextStepLabel?: string | null;
  nextStepUrl?: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentActivity: RecentActivityItem[];
  usageStats: UsageStats[];
  insights: InsightItem[];
  onboarding: OnboardingStep[];
  activation: ActivationSummary;
}

export { PLAN_LIMITS };
export type { PlanTier };
