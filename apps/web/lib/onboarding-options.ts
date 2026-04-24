import type {
  CreatorType,
  PrimaryPlatform,
  ContentGoal,
  TargetPlatform,
} from "@/lib/validations";

export interface OptionDefinition<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export const CREATOR_TYPE_OPTIONS: Array<OptionDefinition<CreatorType>> = [
  {
    value: "founder",
    label: "Founder",
    description: "Building a startup or product",
  },
  {
    value: "coach",
    label: "Coach / Creator",
    description: "Teaching, consulting, or audience-building",
  },
  {
    value: "agency",
    label: "Agency / Editor",
    description: "Editing for multiple clients",
  },
  {
    value: "youtuber",
    label: "YouTuber",
    description: "Long-form video channel",
  },
  {
    value: "podcaster",
    label: "Podcaster",
    description: "Audio or video podcasts",
  },
  {
    value: "marketer",
    label: "Marketer",
    description: "B2B or B2C growth marketing",
  },
  { value: "other", label: "Other", description: "Tell us anything else later" },
];

export const PRIMARY_PLATFORM_OPTIONS: Array<OptionDefinition<PrimaryPlatform>> = [
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
];

export const TARGET_PLATFORM_OPTIONS: Array<OptionDefinition<TargetPlatform>> =
  PRIMARY_PLATFORM_OPTIONS;

export const CONTENT_GOAL_OPTIONS: Array<OptionDefinition<ContentGoal>> = [
  {
    value: "more_reach",
    label: "More reach",
    description: "Grow views and impressions",
  },
  {
    value: "more_leads",
    label: "More leads",
    description: "Drive signups, demos, or sales",
  },
  {
    value: "faster_editing",
    label: "Faster editing",
    description: "Ship clips without a full edit",
  },
  {
    value: "repurpose_long_form",
    label: "Repurpose podcasts & webinars",
    description: "Turn long-form into many shorts",
  },
  {
    value: "personal_brand",
    label: "Grow personal brand",
    description: "Consistent presence on short-form",
  },
];

export function getCreatorTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return CREATOR_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

export function getPrimaryPlatformLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PRIMARY_PLATFORM_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

export function getTargetPlatformLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return TARGET_PLATFORM_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

export function getContentGoalLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return CONTENT_GOAL_OPTIONS.find((option) => option.value === value)?.label ?? null;
}
