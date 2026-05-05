# X Radar - Complete Feature Plan

## Context

Building "X Radar" for the ViralSnipAI SaaS platform. The feature scrapes viral posts from X.com, uses Claude AI to analyze WHY they went viral (hook type, format, emotional trigger), and generates 3 personalized ready-to-post tweets daily. Initial goal: grow from 7 to 1,000 followers in 90 days, then launch as a paid feature.

## Market Research Summary

### Competitor Landscape
| Tool | Price | Key Feature | Gap |
|------|-------|-------------|-----|
| Tweet Hunter | $36-57/mo | 3M+ viral tweet library, "Tweet Predict" | No deep WHY analysis |
| Typefully | $12.50-29/mo | Clean writer-focused UI | No viral scraping |
| Hypefury | $29-199/mo | Evergreen recycling, automation | No AI analysis |
| Taplio | $39/mo | LinkedIn-focused | Wrong platform |

**X Radar's unique edge**: Deep viral WHY analysis (hook type, format, emotional trigger) + personalized daily tweet generation — no competitor does both.

### X.com API Options
| Tier | Cost | Read | Write |
|------|------|------|-------|
| Free | $0 | None | 1,500 tweets/mo |
| Basic | $200/mo | 15,000 tweets/mo | 50,000 tweets/mo |
| Pro | $5,000/mo | High limits | High limits |

**Recommendation**: Start with **Basic tier ($200/mo)** for read+write. Use `search/recent` endpoint with operators like `min_faves:1000` to find viral tweets. Supplement with Apify for historical data if needed.

### AI Provider: OpenAI (Already Configured)
- Already installed (`openai` package) and working throughout the codebase
- Use **gpt-4o-mini** for tweet generation (cheap, fast) — same as content calendar/scripts
- Use **gpt-4o** for deep viral analysis (better reasoning)
- Existing patterns in `apps/web/app/api/content-calendar/generate/route.ts` to reuse
- Estimated cost: $20-50/mo

### Legal Compliance
- Must use **official X API** (not scraping) — X ToS bans unauthorized scraping with $15K/1M posts penalties
- X API Basic tier is the compliant approach
- Posting via API is fully supported and permitted

---

## Architecture Overview

```
X API (Basic $200/mo) → Fetch viral tweets
        ↓
  Store in DB (ViralTweet model)
        ↓
  OpenAI Analysis → Hook type, format, emotional trigger, WHY it worked
        ↓
  Store analysis (TweetAnalysis model)
        ↓
  OpenAI Generation → 3 personalized tweets/day based on patterns
        ↓
  Store drafts (TweetDraft model) → User reviews/edits → Post via X API
```

---

## Phase 1: Database Schema

**File**: `apps/web/prisma/schema.prisma`

Add these models (following Competitor Tracking pattern):

```prisma
// X.com account linked to user for posting
model XAccount {
  id                String        @id @default(cuid())
  userId            String
  xUserId           String        // X.com user ID
  xUsername          String        // @handle
  xDisplayName      String
  profileImageUrl   String?
  followerCount     Int           @default(0)
  followingCount    Int           @default(0)
  accessToken       String        // OAuth token (encrypted)
  refreshToken      String?       // OAuth refresh token (encrypted)
  tokenExpiresAt    DateTime?
  isActive          Boolean       @default(true)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots         XAccountSnapshot[]
  drafts            TweetDraft[]
  trackedAccounts   XTrackedAccount[]

  @@unique([userId, xUserId])
  @@index([userId])
}

// Follower growth snapshots (daily)
model XAccountSnapshot {
  id                String        @id @default(cuid())
  xAccountId        String
  followerCount     Int
  followingCount    Int
  tweetCount        Int
  followerGrowth    Int           @default(0)
  createdAt         DateTime      @default(now())

  xAccount          XAccount      @relation(fields: [xAccountId], references: [id], onDelete: Cascade)

  @@index([xAccountId, createdAt])
}

// Accounts to track for viral content (niche leaders)
model XTrackedAccount {
  id                String        @id @default(cuid())
  userId            String
  xAccountId        String        // User's linked X account
  trackedXUserId    String        // The account being tracked
  trackedUsername    String
  trackedDisplayName String
  profileImageUrl   String?
  followerCount     Int           @default(0)
  niche             String?
  isActive          Boolean       @default(true)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  xAccount          XAccount      @relation(fields: [xAccountId], references: [id], onDelete: Cascade)
  viralTweets       ViralTweet[]

  @@unique([userId, trackedXUserId])
  @@index([userId])
}

// Scraped viral tweets from tracked accounts
model ViralTweet {
  id                String        @id @default(cuid())
  trackedAccountId  String
  tweetId           String        @unique
  text              String
  authorUsername    String
  authorDisplayName String
  likes             Int           @default(0)
  retweets          Int           @default(0)
  replies           Int           @default(0)
  impressions       Int           @default(0)
  bookmarks         Int           @default(0)
  quoteTweets       Int           @default(0)
  mediaType         String?       // 'image' | 'video' | 'poll' | 'thread' | null
  publishedAt       DateTime
  fetchedAt         DateTime      @default(now())

  // AI Analysis fields (populated by OpenAI)
  isAnalyzed        Boolean       @default(false)
  hookType          String?       // 'question' | 'stat' | 'contrarian' | 'story' | 'list' | 'challenge'
  format            String?       // 'one-liner' | 'thread' | 'listicle' | 'story' | 'hot-take' | 'how-to'
  emotionalTrigger  String?       // 'curiosity' | 'anger' | 'awe' | 'humor' | 'fomo' | 'controversy'
  viralScore        Int?          // 1-100
  whyItWorked       String?       // AI analysis (2-3 sentences)
  lessonsLearned    String[]      // Actionable takeaways
  analyzedAt        DateTime?

  trackedAccount    XTrackedAccount @relation(fields: [trackedAccountId], references: [id], onDelete: Cascade)

  @@index([trackedAccountId, publishedAt])
  @@index([viralScore])
}

// AI-generated tweet drafts for the user
model TweetDraft {
  id                String        @id @default(cuid())
  userId            String
  xAccountId        String
  text              String        // The generated tweet
  inspiredByTweetId String?       // Which viral tweet inspired this
  hookType          String?       // Hook type used
  format            String?       // Format used
  emotionalTrigger  String?       // Emotional trigger targeted
  aiReasoning       String?       // Why AI generated this
  viralPrediction   Int?          // 1-100 predicted engagement
  status            String        @default("draft") // 'draft' | 'scheduled' | 'posted' | 'rejected'
  scheduledFor      DateTime?
  postedAt          DateTime?
  postedTweetId     String?       // X.com tweet ID after posting

  // Post-publish metrics (fetched after posting)
  actualLikes       Int?
  actualRetweets    Int?
  actualReplies     Int?
  actualImpressions Int?

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  xAccount          XAccount      @relation(fields: [xAccountId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, createdAt])
}
```

---

## Phase 2: X.com API Integration

**File**: `apps/web/lib/integrations/x-api.ts`

### OAuth 2.0 Flow (for posting)
- X API requires OAuth 2.0 PKCE for user-delegated actions (posting tweets)
- Scopes needed: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- Store access/refresh tokens in `XAccount` model (encrypted)

### Key Endpoints to Implement
```typescript
// Search viral tweets (Basic tier)
// GET /2/tweets/search/recent?query=min_faves:1000 -is:retweet lang:en
searchViralTweets(query: string, minLikes: number): Promise<Tweet[]>

// Get user tweets (for tracked accounts)
// GET /2/users/:id/tweets?tweet.fields=public_metrics
getUserTweets(userId: string, maxResults: number): Promise<Tweet[]>

// Post a tweet
// POST /2/tweets
postTweet(text: string, accessToken: string): Promise<{ tweetId: string }>

// Get tweet metrics (for posted drafts)
// GET /2/tweets/:id?tweet.fields=public_metrics
getTweetMetrics(tweetId: string): Promise<TweetMetrics>

// Lookup user by username
// GET /2/users/by/username/:username
lookupUser(username: string): Promise<XUser>
```

### Environment Variables
```env
X_API_KEY=               # X API key (Basic tier)
X_API_SECRET=            # X API secret
X_CLIENT_ID=             # OAuth 2.0 client ID
X_CLIENT_SECRET=         # OAuth 2.0 client secret
X_CALLBACK_URL=http://localhost:3000/api/x-radar/callback
X_RADAR_ENABLED=true
NEXT_PUBLIC_X_RADAR_ENABLED=true
```

---

## Phase 3: OpenAI Integration (Reuse Existing Patterns)

**File**: `apps/web/lib/ai/x-radar-analyzer.ts`

Uses existing OpenAI setup — same pattern as `apps/web/app/api/content-calendar/generate/route.ts`.

### Analysis Prompt (gpt-4o for deep reasoning)
```typescript
const ANALYSIS_SYSTEM_PROMPT = `You are a viral tweet analyst. Given a tweet and its metrics, analyze:

1. HOOK TYPE: How does the first line grab attention?
   - question | stat | contrarian | story | list | challenge

2. FORMAT: What structural pattern does it use?
   - one-liner | thread | listicle | story | hot-take | how-to

3. EMOTIONAL TRIGGER: What emotion drives sharing?
   - curiosity | anger | awe | humor | fomo | controversy

4. VIRAL SCORE: 1-100 (based on engagement/follower ratio)

5. WHY IT WORKED: 2-3 sentences explaining the mechanics

6. LESSONS: 2-3 actionable takeaways for recreating this pattern

Return JSON only.`;
```

### Generation Prompt (gpt-4o-mini for speed/cost)
```typescript
const GENERATION_SYSTEM_PROMPT = `You are a Twitter ghostwriter. Based on the user's niche,
writing style, and patterns from viral tweets, generate 3 ready-to-post tweets.

USER CONTEXT:
- Niche: {niche}
- Current followers: {followers}
- Writing style: {style_examples}
- Goal: Grow to {target} followers

VIRAL PATTERNS THAT WORKED THIS WEEK:
{analyzed_tweets_summary}

For each tweet, provide:
- text: The tweet (max 280 chars)
- hookType: Which hook pattern you used
- format: Which format pattern
- emotionalTrigger: Which emotion you're targeting
- reasoning: Why this specific tweet should work for this user
- viralPrediction: 1-100 estimated engagement score

Return JSON array of 3 tweets.`;
```

### OpenAI Client (reuse existing pattern)
```typescript
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Analysis uses gpt-4o for better reasoning
const analysis = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "system", content: ANALYSIS_SYSTEM_PROMPT }, ...],
  temperature: 0.3, // Lower temp for consistent analysis
});

// Generation uses gpt-4o-mini for speed + cost
const drafts = await client.chat.completions.create({
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  messages: [{ role: "system", content: GENERATION_SYSTEM_PROMPT }, ...],
  temperature: 0.8, // Higher temp for creative variety
});
```

---

## Phase 4: API Routes

**File structure**:
```
apps/web/app/api/x-radar/
├── route.ts                          # GET (dashboard data), POST (connect X account)
├── callback/route.ts                 # OAuth callback from X.com
├── accounts/
│   ├── route.ts                      # GET (tracked accounts), POST (add tracked account)
│   └── [id]/route.ts                 # DELETE (remove tracked account)
├── viral/
│   ├── route.ts                      # GET (viral tweets feed with analysis)
│   └── analyze/route.ts             # POST (trigger analysis for specific tweets)
├── drafts/
│   ├── route.ts                      # GET (daily drafts), POST (generate new drafts)
│   ├── [id]/route.ts                 # PATCH (edit draft), DELETE
│   └── [id]/post/route.ts           # POST (publish draft to X)
└── metrics/route.ts                  # GET (growth metrics, posted tweet performance)
```

### Key Flows

**1. Connect X Account** (`POST /api/x-radar`)
- Initiate OAuth 2.0 PKCE flow
- Redirect user to X.com authorization
- Callback stores tokens in XAccount model

**2. Add Tracked Account** (`POST /api/x-radar/accounts`)
- User enters @handle of a niche leader to track
- Lookup via X API, store in XTrackedAccount
- Tier limits: Free=3, Starter=5, Creator=10

**3. Fetch & Analyze Viral Tweets** (background job)
- Every 6 hours: Fetch recent tweets from tracked accounts
- Filter by engagement (>1000 likes or >2x their avg engagement)
- Store in ViralTweet
- Send to OpenAI for analysis, store results

**4. Generate Daily Drafts** (background job or on-demand)
- Every morning (or user-triggered): Generate 3 tweet drafts
- Uses last 7 days of analyzed viral patterns
- Personalized to user's niche and style

**5. Post Tweet** (`POST /api/x-radar/drafts/[id]/post`)
- Post draft to X via API using stored OAuth token
- Update draft status to "posted", store tweetId
- After 24h: Fetch actual metrics

---

## Phase 5: Frontend Pages

### Page Structure
```
apps/web/app/(workspace)/x-radar/
├── page.tsx                          # Main dashboard
└── analytics/page.tsx               # Detailed analytics (optional, phase 2)
```

### Components
```
apps/web/components/x-radar/
├── connect-x-dialog.tsx              # OAuth connect flow
├── add-tracked-account-dialog.tsx    # Add niche leader to track
├── viral-tweet-card.tsx              # Display analyzed viral tweet
├── tweet-draft-card.tsx              # Display generated draft with edit/post actions
├── daily-drafts-section.tsx          # Today's 3 drafts section
├── viral-feed-section.tsx            # Scrollable viral tweet feed
├── growth-stats.tsx                  # Follower growth cards
└── analysis-badge.tsx                # Hook type / format / emotion badges
```

### Main Dashboard Layout (`page.tsx`)

```
┌─────────────────────────────────────────────────────┐
│ X Radar                          [Connect X Account] │
│ Grow your X presence with AI-powered viral analysis  │
├─────────────┬──────────────┬────────────┬────────────┤
│ Followers   │ Growth (7d)  │ Tweets     │ Avg Engage │
│   7         │  +0          │  Posted    │  ment Rate │
│ current     │ this week    │  12        │  2.3%      │
├─────────────┴──────────────┴────────────┴────────────┤
│                                                       │
│ TODAY'S DRAFTS (3)                    [Generate New]  │
│ ┌───────────────────────────────────────────────┐    │
│ │ "Most people think X is about followers.       │    │
│ │  It's actually about..."                       │    │
│ │ Hook: Contrarian | Format: Hot-take | Score 82 │    │
│ │                          [Edit] [Post] [Skip]  │    │
│ └───────────────────────────────────────────────┘    │
│ (2 more draft cards)                                  │
│                                                       │
│ VIRAL FEED (This Week)               [Filter] [Sort] │
│ ┌───────────────────────────────────────────────┐    │
│ │ @naval · 45.2K likes · 12.1K RTs              │    │
│ │ "The best way to learn is to build..."         │    │
│ │ Hook: Contrarian | Format: One-liner | Awe     │    │
│ │ WHY: Uses authority + contrarian framing...    │    │
│ │ Lessons: 1. Lead with authority  2. ...        │    │
│ └───────────────────────────────────────────────┘    │
│ (more viral tweet cards)                              │
│                                                       │
│ TRACKED ACCOUNTS (3)          [+ Add Account]        │
│ @naval · @sahaborhade · @levelsio                    │
└─────────────────────────────────────────────────────┘
```

---

## Phase 6: Background Jobs (Inngest)

**File**: `apps/web/lib/inngest/functions.ts`

### Job 1: Fetch Viral Tweets (every 6 hours)
```typescript
inngest.createFunction(
  { id: "x-radar-fetch-viral", retries: 3 },
  { cron: "0 */6 * * *" },
  async () => {
    // For each active tracked account:
    // 1. Fetch recent tweets via X API
    // 2. Filter by engagement threshold (>2x avg or >1000 likes)
    // 3. Upsert into ViralTweet table
  }
);
```

### Job 2: Analyze Viral Tweets with OpenAI (every 6 hours, after fetch)
```typescript
inngest.createFunction(
  { id: "x-radar-analyze", retries: 2 },
  { event: "x-radar/tweets.fetched" },
  async ({ event }) => {
    // 1. Get unanalyzed tweets
    // 2. Batch send to gpt-4o for analysis
    // 3. Parse response, update ViralTweet with analysis
  }
);
```

### Job 3: Generate Daily Drafts (every morning at 7am)
```typescript
inngest.createFunction(
  { id: "x-radar-daily-drafts", retries: 2 },
  { cron: "0 7 * * *" },
  async () => {
    // For each active user:
    // 1. Get last 7 days of analyzed viral tweets
    // 2. Get user's niche/style preferences
    // 3. Call gpt-4o-mini to generate 3 personalized tweets
    // 4. Store as TweetDraft with status 'draft'
  }
);
```

### Job 4: Track Growth Snapshots (daily at midnight)
```typescript
inngest.createFunction(
  { id: "x-radar-growth-snapshot", retries: 3 },
  { cron: "0 0 * * *" },
  async () => {
    // For each connected X account:
    // 1. Fetch current follower/following count
    // 2. Create XAccountSnapshot with delta
  }
);
```

### Job 5: Fetch Posted Tweet Metrics (24h after posting)
```typescript
inngest.createFunction(
  { id: "x-radar-post-metrics", retries: 2 },
  { event: "x-radar/tweet.posted" },
  async ({ event }) => {
    // Wait 24 hours, then fetch actual engagement metrics
    // Update TweetDraft with actualLikes, actualRetweets, etc.
  }
);
```

---

## Phase 7: Navigation & Feature Flag

### Add to workspace nav
**File**: `apps/web/components/layout/workspace-nav.tsx`

Add to `contentWorkflow` array:
```typescript
{ href: "/x-radar", label: "X Radar", icon: Radar, badge: "New" }
```

### Feature flag
**File**: `apps/web/lib/feature-flags.ts`

Add `xRadarEnabled` flag controlled by `X_RADAR_ENABLED` env var.

### Middleware protection
**File**: `apps/web/middleware.ts`

Add `/x-radar/:path*` to protected routes.

---

## Implementation Order (Full MVP)

### Step 1: Foundation Setup
1. Add Prisma models (5 new models), run migration
2. Add feature flag (`X_RADAR_ENABLED`) + nav item (Radar icon)
3. Add middleware protection for `/x-radar` routes
4. Add env vars to `.env.example`

### Step 2: X API Integration
5. Build X API client (`lib/integrations/x-api.ts`) — OAuth 2.0, search, post, metrics
6. Implement OAuth 2.0 PKCE connect flow (`/api/x-radar/route.ts` + `/api/x-radar/callback/route.ts`)
7. Build "Connect X Account" dialog component

### Step 3: Tracked Accounts
8. Build tracked account CRUD API (`/api/x-radar/accounts/route.ts`)
9. Build "Add Tracked Account" dialog (search by @handle)
10. Tier-based limits (Free=3, Starter=5, Creator=10)

### Step 4: Viral Tweet Pipeline
11. Build viral tweet fetching via X API search (`/api/x-radar/viral/route.ts`)
12. Build OpenAI analysis pipeline (`lib/ai/x-radar-analyzer.ts`) — gpt-4o for analysis
13. Build viral feed UI (`viral-tweet-card.tsx` with analysis badges)

### Step 5: Draft Generation & Posting
14. Build daily draft generation with OpenAI (`/api/x-radar/drafts/route.ts`) — gpt-4o-mini
15. Build draft UI (`tweet-draft-card.tsx` — edit, post, skip actions)
16. Implement tweet posting via X API (`/api/x-radar/drafts/[id]/post/route.ts`)
17. Build posted tweet metrics tracking

### Step 6: Dashboard & Growth
18. Build main X Radar page with all sections (stats, drafts, viral feed, tracked accounts)
19. Build growth stats cards (follower snapshots)
20. Add Inngest background jobs (fetch viral, analyze, generate drafts, growth snapshots, post metrics)

### Step 7: Polish
21. Dark mode compatibility for all components
22. Loading skeletons and error states
23. Mobile responsive layout
24. Zod validation schemas for all API inputs

---

## Monthly Cost Estimate

| Item | Cost |
|------|------|
| X API Basic | $200/mo |
| OpenAI API (gpt-4o + gpt-4o-mini) | $20-50/mo |
| Supabase (existing) | $0 (already paid) |
| **Total** | **~$220-250/mo** |

---

## Success Metrics (90-day goal: 7 -> 1,000 followers)

| Week | Target | Key Action |
|------|--------|------------|
| 1-2 | Build MVP | Connect account, track 5 niche leaders |
| 3-4 | 7->50 | Start posting 3 AI-generated tweets/day |
| 5-8 | 50->250 | Refine prompts based on what works |
| 9-12 | 250->1000 | Scale posting, add thread generation |

### KPIs to Track
- Follower growth rate (daily/weekly)
- Avg engagement per tweet (likes, RTs, replies)
- Draft acceptance rate (posted vs skipped)
- Best performing hook type, format, and emotional trigger
- AI prediction accuracy (viralPrediction vs actual engagement)

---

## Files to Create/Modify

### New Files (22)
- `apps/web/lib/integrations/x-api.ts` — X API client
- `apps/web/lib/ai/x-radar-analyzer.ts` — OpenAI analysis + generation
- `apps/web/lib/types/x-radar.ts` — TypeScript types
- `apps/web/app/(workspace)/x-radar/page.tsx` — Main page
- `apps/web/app/api/x-radar/route.ts` — Main API route
- `apps/web/app/api/x-radar/callback/route.ts` — OAuth callback
- `apps/web/app/api/x-radar/accounts/route.ts` — Tracked accounts CRUD
- `apps/web/app/api/x-radar/accounts/[id]/route.ts` — Single tracked account ops
- `apps/web/app/api/x-radar/viral/route.ts` — Viral tweets feed
- `apps/web/app/api/x-radar/viral/analyze/route.ts` — Trigger analysis
- `apps/web/app/api/x-radar/drafts/route.ts` — Draft CRUD + generate
- `apps/web/app/api/x-radar/drafts/[id]/route.ts` — Single draft ops
- `apps/web/app/api/x-radar/drafts/[id]/post/route.ts` — Post to X
- `apps/web/app/api/x-radar/metrics/route.ts` — Growth metrics
- `apps/web/components/x-radar/connect-x-dialog.tsx`
- `apps/web/components/x-radar/add-tracked-account-dialog.tsx`
- `apps/web/components/x-radar/viral-tweet-card.tsx`
- `apps/web/components/x-radar/tweet-draft-card.tsx`
- `apps/web/components/x-radar/daily-drafts-section.tsx`
- `apps/web/components/x-radar/viral-feed-section.tsx`
- `apps/web/components/x-radar/growth-stats.tsx`
- `apps/web/components/x-radar/analysis-badge.tsx`

### Modified Files (8)
- `apps/web/prisma/schema.prisma` — Add 5 new models
- `apps/web/components/layout/workspace-nav.tsx` — Add nav item
- `apps/web/lib/feature-flags.ts` — Add xRadarEnabled flag
- `apps/web/middleware.ts` — Add /x-radar to protected routes
- `apps/web/lib/inngest/functions.ts` — Add 5 background jobs
- `apps/web/.env.example` — Add X API env vars
- `apps/web/package.json` — No new AI dependencies needed (OpenAI already installed)
- `apps/web/lib/validations.ts` — Add X Radar Zod schemas

---

## Verification
1. Connect X account via OAuth -> verify tokens stored
2. Add 3 tracked accounts -> verify tweets fetched
3. Trigger OpenAI analysis -> verify hook/format/emotion populated
4. Generate daily drafts -> verify 3 tweets appear
5. Post a draft -> verify tweet appears on X.com
6. Check growth metrics after 24h -> verify snapshot created
7. Run full pipeline end-to-end via Inngest dashboard
