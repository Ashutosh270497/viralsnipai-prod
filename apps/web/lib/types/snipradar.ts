// ============================================
// SnipRadar Types
// ============================================

export type HookType = "question" | "stat" | "contrarian" | "story" | "list" | "challenge";
export type TweetFormat = "one-liner" | "thread" | "listicle" | "story" | "hot-take" | "how-to";
export type EmotionalTrigger = "curiosity" | "anger" | "awe" | "humor" | "fomo" | "controversy";
export type DraftStatus = "draft" | "scheduled" | "posted" | "rejected";

export interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  location?: string;
  profile_image_url?: string;
  pinned_tweet_id?: string;
  url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface XTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  referenced_tweets?: Array<{
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }>;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
    bookmark_count: number;
    quote_count: number;
  };
  attachments?: {
    media_keys?: string[];
  };
}

export interface XSearchResponse {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
    media?: Array<{
      media_key: string;
      type: string;
    }>;
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
  error?: {
    status: number;
    title?: string;
    detail?: string;
    type?: string;
  };
}

export interface TweetAnalysis {
  hookType: HookType;
  format: TweetFormat;
  emotionalTrigger: EmotionalTrigger;
  viralScore: number;
  whyItWorked: string;
  lessonsLearned: string[];
}

export interface GeneratedTweet {
  text: string;
  hookType: HookType;
  format: TweetFormat;
  emotionalTrigger: EmotionalTrigger;
  reasoning: string;
  viralPrediction: number;
}

export interface SnipRadarDashboardData {
  account: {
    id: string;
    xUsername: string;
    xDisplayName: string;
    profileImageUrl: string | null;
    followerCount: number;
    followingCount: number;
    isActive: boolean;
  } | null;
  auth?: {
    reauthRequired: boolean;
    message: string | null;
    refreshedToken: boolean;
  } | null;
  stats: {
    followerCount: number;
    followerGrowth7d: number;
    tweetsPosted: number;
    avgEngagementRate: number;
  };
  trackedAccounts: Array<{
    id: string;
    trackedUsername: string;
    trackedDisplayName: string;
    profileImageUrl: string | null;
    followerCount: number;
    niche: string | null;
    viralTweetCount: number;
  }>;
  recentDrafts: Array<{
    id: string;
    text: string;
    hookType: string | null;
    format: string | null;
    emotionalTrigger: string | null;
    viralPrediction: number | null;
    aiReasoning: string | null;
    status: DraftStatus;
    createdAt: string;
  }>;
  viralTweets: Array<{
    id: string;
    tweetId: string;
    text: string;
    authorUsername: string;
    authorDisplayName: string;
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    hookType: string | null;
    format: string | null;
    emotionalTrigger: string | null;
    viralScore: number | null;
    whyItWorked: string | null;
    lessonsLearned: string[];
    publishedAt: string;
    isAnalyzed: boolean;
  }>;
}
