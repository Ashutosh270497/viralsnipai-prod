# Feature Implementation Plan - Critical Features for Launch

**Document Version**: 1.0
**Created**: February 4, 2026
**Features**: Keyword Research, Competitor Tracking, SEO Score, Real-Time Analytics
**Timeline**: 4 Phases over 3-4 weeks

---

## Executive Summary

This document outlines the complete implementation plan for four critical features needed to compete with VidIQ and achieve launch readiness:

1. **Keyword Research** - YouTube keyword analysis with search volume and competition data
2. **Competitor Tracking** - Monitor competitor channels, uploads, and performance
3. **SEO Score** - Automated video optimization scoring system
4. **Real-Time Analytics** - VPH (Views Per Hour) tracking and performance monitoring

**Total Estimated Timeline**: 18-22 working days (3-4 weeks)
**Team Size**: 1-2 developers
**Priority**: P0 (Launch Blocking)

---

## Table of Contents

1. [Phase 1: Keyword Research Module](#phase-1-keyword-research-module)
2. [Phase 2: Competitor Tracking System](#phase-2-competitor-tracking-system)
3. [Phase 3: SEO Score Engine](#phase-3-seo-score-engine)
4. [Phase 4: Real-Time Analytics Dashboard](#phase-4-real-time-analytics-dashboard)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Technical Architecture](#technical-architecture)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Plan](#deployment-plan)
10. [Success Metrics](#success-metrics)

---

# Phase 1: Keyword Research Module

**Duration**: 5-6 days
**Priority**: P0 (Critical)
**Dependencies**: YouTube Data API v3, Third-party keyword data

---

## Overview

Build a comprehensive keyword research tool that helps creators find searchable keywords with realistic competition levels. This is VidIQ's #1 feature and must be implemented before launch.

---

## Features to Implement

### 1.1 Keyword Search
- Search for YouTube keywords
- Display search volume (monthly searches)
- Show competition score (1-100)
- Difficulty rating (Easy/Medium/Hard)
- Trend direction (Rising/Stable/Falling)

### 1.2 Related Keywords
- Suggest related keywords
- Long-tail keyword variations
- Question-based keywords
- Semantic keyword grouping

### 1.3 Keyword Metrics
- Average views for top 10 videos
- Average likes/comments ratio
- Estimated CPM (revenue potential)
- Seasonality indicator

### 1.4 Save & Organize
- Save favorite keywords
- Create keyword lists
- Tag keywords by niche
- Export to CSV

---

## Technical Specifications

### Database Schema

```prisma
// Add to schema.prisma

model KeywordResearch {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  keyword           String
  searchVolume      Int      // Monthly searches
  competition       Int      // 1-100 score
  difficulty        String   // 'easy' | 'medium' | 'hard'
  trendDirection    String   // 'rising' | 'stable' | 'falling'

  // Analytics
  avgViews          Int?     // Average views for top videos
  avgLikes          Int?
  avgComments       Int?
  estimatedCPM      Float?

  // Metadata
  relatedKeywords   Json?    // Array of related keywords
  topVideos         Json?    // Top 10 video data
  lastUpdated       DateTime @default(now())

  // User actions
  isSaved           Boolean  @default(false)
  tags              String[] @default([])
  notes             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([keyword])
  @@index([searchVolume])
  @@map("keyword_research")
}

model SavedKeyword {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  keyword     String
  listName    String?  // Organize into lists
  tags        String[] @default([])
  notes       String?

  createdAt   DateTime @default(now())

  @@unique([userId, keyword])
  @@index([userId])
  @@map("saved_keywords")
}
```

### API Integration

#### YouTube Data API v3
```typescript
// lib/integrations/youtube-api.ts

import { google } from 'googleapis';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export async function getKeywordSearchVolume(keyword: string) {
  // Use YouTube Search API
  const response = await youtube.search.list({
    part: ['snippet'],
    q: keyword,
    type: ['video'],
    maxResults: 50,
    order: 'relevance',
  });

  return response.data;
}

export async function getVideoStatistics(videoIds: string[]) {
  const response = await youtube.videos.list({
    part: ['statistics', 'snippet'],
    id: videoIds,
  });

  return response.data.items;
}
```

#### Third-Party Keyword Data (Optional Enhancement)
```typescript
// Consider integrating:
// - Google Keyword Planner API (via Google Ads API)
// - DataForSEO API (keyword data provider)
// - Ahrefs API (if budget allows)

interface KeywordDataProvider {
  getSearchVolume(keyword: string): Promise<number>;
  getCompetitionScore(keyword: string): Promise<number>;
  getRelatedKeywords(keyword: string): Promise<string[]>;
}
```

### Competition Score Algorithm

```typescript
// lib/algorithms/competition-score.ts

interface CompetitionFactors {
  totalResults: number;        // Total videos for keyword
  topChannelSize: number;       // Avg subscribers of top 10
  avgViews: number;             // Avg views of top 10 videos
  uploadFrequency: number;      // Videos per month for this keyword
  domainAuthority: number;      // How many big channels rank
}

export function calculateCompetitionScore(factors: CompetitionFactors): number {
  // Weighted algorithm
  const weights = {
    totalResults: 0.20,
    topChannelSize: 0.30,
    avgViews: 0.25,
    uploadFrequency: 0.15,
    domainAuthority: 0.10,
  };

  // Normalize each factor to 0-100 scale
  const normalizedResults = Math.min(factors.totalResults / 10000, 1) * 100;
  const normalizedChannelSize = Math.min(factors.topChannelSize / 1000000, 1) * 100;
  const normalizedViews = Math.min(factors.avgViews / 100000, 1) * 100;
  const normalizedFrequency = Math.min(factors.uploadFrequency / 100, 1) * 100;
  const normalizedAuthority = factors.domainAuthority; // Already 0-100

  // Calculate weighted score
  const score = (
    normalizedResults * weights.totalResults +
    normalizedChannelSize * weights.topChannelSize +
    normalizedViews * weights.avgViews +
    normalizedFrequency * weights.uploadFrequency +
    normalizedAuthority * weights.domainAuthority
  );

  return Math.round(score);
}

export function getDifficultyRating(competitionScore: number): 'easy' | 'medium' | 'hard' {
  if (competitionScore < 33) return 'easy';
  if (competitionScore < 66) return 'medium';
  return 'hard';
}
```

---

## API Endpoints

### POST /api/keywords/search
Search for keyword data

```typescript
// app/api/keywords/search/route.ts

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyword } = await request.json();

  // 1. Check cache first (24hr cache)
  const cached = await redis.get(`keyword:${keyword}`);
  if (cached) return NextResponse.json(JSON.parse(cached));

  // 2. Fetch from YouTube API
  const searchResults = await getKeywordSearchVolume(keyword);
  const topVideoIds = searchResults.items.slice(0, 10).map(v => v.id.videoId);
  const videoStats = await getVideoStatistics(topVideoIds);

  // 3. Calculate metrics
  const avgViews = videoStats.reduce((sum, v) => sum + parseInt(v.statistics.viewCount), 0) / videoStats.length;
  const avgLikes = videoStats.reduce((sum, v) => sum + parseInt(v.statistics.likeCount), 0) / videoStats.length;

  // 4. Get competition score
  const competitionScore = calculateCompetitionScore({
    totalResults: searchResults.pageInfo.totalResults,
    topChannelSize: 50000, // Calculate from channel data
    avgViews,
    uploadFrequency: 10, // Estimate from search results
    domainAuthority: 50, // Calculate based on verified channels
  });

  // 5. Get related keywords
  const relatedKeywords = await getRelatedKeywords(keyword);

  const data = {
    keyword,
    searchVolume: searchResults.pageInfo.totalResults,
    competition: competitionScore,
    difficulty: getDifficultyRating(competitionScore),
    trendDirection: 'stable', // TODO: Implement trend analysis
    avgViews: Math.round(avgViews),
    avgLikes: Math.round(avgLikes),
    relatedKeywords,
    topVideos: videoStats,
  };

  // 6. Cache for 24 hours
  await redis.setex(`keyword:${keyword}`, 86400, JSON.stringify(data));

  // 7. Save to database
  await prisma.keywordResearch.create({
    data: {
      userId: user.id,
      ...data,
    },
  });

  return NextResponse.json(data);
}
```

### GET /api/keywords/saved
Get user's saved keywords

```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const savedKeywords = await prisma.savedKeyword.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(savedKeywords);
}
```

### POST /api/keywords/save
Save a keyword to favorites

```typescript
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyword, listName, tags, notes } = await request.json();

  const saved = await prisma.savedKeyword.create({
    data: {
      userId: user.id,
      keyword,
      listName,
      tags,
      notes,
    },
  });

  return NextResponse.json(saved);
}
```

---

## UI Components

### Keyword Search Interface

```tsx
// app/(workspace)/keywords/page.tsx

"use client";

import { useState } from "react";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function KeywordResearchPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const response = await fetch("/api/keywords/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    const data = await response.json();
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Keyword Research</h1>
        <p className="text-muted-foreground">
          Find searchable keywords with realistic competition levels
        </p>
      </div>

      {/* Search Bar */}
      <Card className="p-6">
        <div className="flex gap-4">
          <Input
            placeholder="Enter keyword or video topic..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Main Metrics */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Keyword Metrics</h3>
            <div className="space-y-4">
              <MetricRow
                label="Search Volume"
                value={results.searchVolume.toLocaleString()}
                subtitle="monthly searches"
              />
              <MetricRow
                label="Competition"
                value={results.competition}
                subtitle={
                  <Badge variant={getDifficultyColor(results.difficulty)}>
                    {results.difficulty}
                  </Badge>
                }
              />
              <MetricRow
                label="Avg Views"
                value={results.avgViews.toLocaleString()}
                subtitle="for top 10 videos"
              />
              <MetricRow
                label="Trend"
                value={
                  <div className="flex items-center gap-2">
                    {getTrendIcon(results.trendDirection)}
                    <span className="capitalize">{results.trendDirection}</span>
                  </div>
                }
              />
            </div>
          </Card>

          {/* Related Keywords */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Related Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {results.relatedKeywords.map((kw) => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setKeyword(kw)}
                >
                  {kw}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, subtitle }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-semibold">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
```

---

## Phase 1 Implementation Steps

### Day 1: Setup & Database
- [ ] Add Prisma schema for KeywordResearch and SavedKeyword models
- [ ] Run database migration
- [ ] Set up YouTube Data API credentials
- [ ] Test YouTube API connection

### Day 2: Core Algorithm
- [ ] Implement competition score algorithm
- [ ] Build difficulty rating function
- [ ] Create keyword metrics calculator
- [ ] Write unit tests for algorithms

### Day 3: API Endpoints
- [ ] Create POST /api/keywords/search endpoint
- [ ] Implement caching with Redis
- [ ] Create GET /api/keywords/saved endpoint
- [ ] Create POST /api/keywords/save endpoint
- [ ] Test all endpoints

### Day 4: UI Components
- [ ] Build keyword search interface
- [ ] Create results display component
- [ ] Add related keywords section
- [ ] Implement save to favorites functionality

### Day 5: Integration & Polish
- [ ] Integrate keyword research into Title Generator
- [ ] Add keyword suggestions to Content Calendar
- [ ] Implement export to CSV
- [ ] Add loading states and error handling

### Day 6: Testing & Documentation
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Add usage limits by tier
- [ ] Write user documentation

---

## Success Criteria

✅ Users can search 50+ keywords per day
✅ Results load in < 3 seconds
✅ Competition scores are accurate within 10%
✅ Related keywords suggestions are relevant
✅ 90% API success rate
✅ Data cached for 24 hours

---

# Phase 2: Competitor Tracking System

**Duration**: 4-5 days
**Priority**: P0 (Critical)
**Dependencies**: YouTube Data API v3, Phase 1 completed

---

## Overview

Build a competitor tracking system that allows users to monitor 3-10 competitor channels (based on tier), tracking uploads, views, subscriber growth, and content strategy.

---

## Features to Implement

### 2.1 Competitor Management
- Add competitor channels by URL or channel ID
- Track 3 channels (free), 5 (Creator), 10 (Studio)
- Remove/archive competitors
- Organize by category

### 2.2 Performance Tracking
- Recent uploads (last 30 days)
- View counts and growth
- Subscriber count tracking
- Upload frequency analysis
- Average performance metrics

### 2.3 Content Analysis
- Top-performing videos (by views, engagement)
- Most-used keywords
- Video length patterns
- Upload time patterns
- Thumbnail style analysis

### 2.4 Alerts & Notifications
- Email when competitor uploads
- Alert on viral videos (>2x avg views)
- Weekly summary email
- Keyword overlap alerts

---

## Technical Specifications

### Database Schema

```prisma
// Add to schema.prisma

model Competitor {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Channel Info
  channelId       String
  channelTitle    String
  channelUrl      String
  thumbnailUrl    String?
  category        String?  // User-defined category

  // Current Stats (snapshot)
  subscriberCount Int
  videoCount      Int
  viewCount       BigInt

  // Tracking
  isActive        Boolean  @default(true)
  lastChecked     DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  snapshots       CompetitorSnapshot[]
  videos          CompetitorVideo[]

  @@unique([userId, channelId])
  @@index([userId])
  @@index([channelId])
  @@map("competitors")
}

model CompetitorSnapshot {
  id              String      @id @default(cuid())
  competitorId    String
  competitor      Competitor  @relation(fields: [competitorId], references: [id], onDelete: Cascade)

  subscriberCount Int
  videoCount      Int
  viewCount       BigInt

  // Growth calculations
  subsGrowth      Int         // Since last snapshot
  viewsGrowth     BigInt

  createdAt       DateTime    @default(now())

  @@index([competitorId])
  @@index([createdAt])
  @@map("competitor_snapshots")
}

model CompetitorVideo {
  id              String      @id @default(cuid())
  competitorId    String
  competitor      Competitor  @relation(fields: [competitorId], references: [id], onDelete: Cascade)

  videoId         String
  title           String
  description     String?     @db.Text
  thumbnailUrl    String

  publishedAt     DateTime
  duration        Int?        // Seconds

  // Stats
  views           Int
  likes           Int?
  comments        Int?

  // Analysis
  keywords        String[]    @default([])
  isViral         Boolean     @default(false) // >2x avg views

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([competitorId, videoId])
  @@index([competitorId])
  @@index([publishedAt])
  @@map("competitor_videos")
}

model CompetitorAlert {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  type            String      // 'new_video' | 'viral' | 'keyword_overlap'
  competitorId    String
  videoId         String?

  message         String
  isRead          Boolean     @default(false)

  createdAt       DateTime    @default(now())

  @@index([userId, isRead])
  @@map("competitor_alerts")
}
```

### Background Job - Daily Sync

```typescript
// lib/jobs/competitor-sync.ts

import { inngest } from "@/lib/inngest/client";

export const competitorDailySync = inngest.createFunction(
  { id: "competitor-daily-sync" },
  { cron: "0 2 * * *" }, // Run at 2 AM daily
  async ({ step }) => {
    // Get all active competitors
    const competitors = await step.run("fetch-competitors", async () => {
      return prisma.competitor.findMany({
        where: { isActive: true },
        include: { user: true },
      });
    });

    // Process each competitor
    for (const competitor of competitors) {
      await step.run(`sync-${competitor.id}`, async () => {
        // 1. Fetch latest channel data
        const channelData = await youtube.channels.list({
          part: ['statistics', 'snippet'],
          id: [competitor.channelId],
        });

        const stats = channelData.items[0].statistics;

        // 2. Create snapshot
        const snapshot = await prisma.competitorSnapshot.create({
          data: {
            competitorId: competitor.id,
            subscriberCount: parseInt(stats.subscriberCount),
            videoCount: parseInt(stats.videoCount),
            viewCount: BigInt(stats.viewCount),
            subsGrowth: parseInt(stats.subscriberCount) - competitor.subscriberCount,
            viewsGrowth: BigInt(stats.viewCount) - competitor.viewCount,
          },
        });

        // 3. Fetch recent videos (last 7 days)
        const videosResponse = await youtube.search.list({
          part: ['snippet'],
          channelId: competitor.channelId,
          order: 'date',
          maxResults: 10,
          publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // 4. Save new videos
        for (const video of videosResponse.items) {
          const existing = await prisma.competitorVideo.findUnique({
            where: {
              competitorId_videoId: {
                competitorId: competitor.id,
                videoId: video.id.videoId,
              },
            },
          });

          if (!existing) {
            // Get video statistics
            const videoStats = await youtube.videos.list({
              part: ['statistics', 'contentDetails'],
              id: [video.id.videoId],
            });

            const stats = videoStats.items[0].statistics;
            const duration = videoStats.items[0].contentDetails.duration;

            await prisma.competitorVideo.create({
              data: {
                competitorId: competitor.id,
                videoId: video.id.videoId,
                title: video.snippet.title,
                description: video.snippet.description,
                thumbnailUrl: video.snippet.thumbnails.high.url,
                publishedAt: new Date(video.snippet.publishedAt),
                duration: parseDuration(duration),
                views: parseInt(stats.viewCount),
                likes: parseInt(stats.likeCount || 0),
                comments: parseInt(stats.commentCount || 0),
              },
            });

            // Create alert for new video
            await prisma.competitorAlert.create({
              data: {
                userId: competitor.userId,
                type: 'new_video',
                competitorId: competitor.id,
                videoId: video.id.videoId,
                message: `${competitor.channelTitle} uploaded: ${video.snippet.title}`,
              },
            });
          }
        }

        // 5. Update competitor stats
        await prisma.competitor.update({
          where: { id: competitor.id },
          data: {
            subscriberCount: parseInt(stats.subscriberCount),
            videoCount: parseInt(stats.videoCount),
            viewCount: BigInt(stats.viewCount),
            lastChecked: new Date(),
          },
        });
      });
    }

    return { processed: competitors.length };
  }
);

function parseDuration(isoDuration: string): number {
  // Convert PT1H2M3S to seconds
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}
```

---

## API Endpoints

### POST /api/competitors/add
Add a competitor channel

```typescript
// app/api/competitors/add/route.ts

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelUrl, category } = await request.json();

  // Check tier limits
  const competitorCount = await prisma.competitor.count({
    where: { userId: user.id, isActive: true },
  });

  const limits = { free: 3, starter: 5, creator: 10, studio: 10 };
  const userTier = user.subscriptionTier || 'free';

  if (competitorCount >= limits[userTier]) {
    return NextResponse.json(
      { error: `You've reached your limit of ${limits[userTier]} competitors. Upgrade to track more.` },
      { status: 403 }
    );
  }

  // Extract channel ID from URL
  const channelId = extractChannelId(channelUrl);

  // Fetch channel data
  const channelData = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    id: [channelId],
  });

  if (!channelData.items.length) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  const channel = channelData.items[0];

  // Create competitor
  const competitor = await prisma.competitor.create({
    data: {
      userId: user.id,
      channelId,
      channelTitle: channel.snippet.title,
      channelUrl,
      thumbnailUrl: channel.snippet.thumbnails.default.url,
      category,
      subscriberCount: parseInt(channel.statistics.subscriberCount),
      videoCount: parseInt(channel.statistics.videoCount),
      viewCount: BigInt(channel.statistics.viewCount),
    },
  });

  // Create initial snapshot
  await prisma.competitorSnapshot.create({
    data: {
      competitorId: competitor.id,
      subscriberCount: parseInt(channel.statistics.subscriberCount),
      videoCount: parseInt(channel.statistics.videoCount),
      viewCount: BigInt(channel.statistics.viewCount),
      subsGrowth: 0,
      viewsGrowth: BigInt(0),
    },
  });

  return NextResponse.json(competitor);
}

function extractChannelId(url: string): string {
  // Handle various YouTube channel URL formats
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube channel URL');
}
```

### GET /api/competitors
Get user's competitor list

```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const competitors = await prisma.competitor.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      snapshots: {
        orderBy: { createdAt: 'desc' },
        take: 2, // Current and previous for growth calculation
      },
      videos: {
        orderBy: { publishedAt: 'desc' },
        take: 5, // Recent videos
      },
    },
  });

  // Calculate growth rates
  const enriched = competitors.map(comp => {
    const [current, previous] = comp.snapshots;
    const subsGrowth = current && previous ? current.subscriberCount - previous.subscriberCount : 0;
    const subsGrowthPercent = previous ? ((subsGrowth / previous.subscriberCount) * 100).toFixed(2) : 0;

    return {
      ...comp,
      subsGrowth,
      subsGrowthPercent,
      recentVideos: comp.videos,
    };
  });

  return NextResponse.json(enriched);
}
```

### GET /api/competitors/[id]/analytics
Get detailed analytics for a competitor

```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const competitor = await prisma.competitor.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      snapshots: {
        orderBy: { createdAt: 'desc' },
        take: 30, // Last 30 days
      },
      videos: {
        orderBy: { publishedAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!competitor) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }

  // Calculate analytics
  const analytics = {
    growthChart: competitor.snapshots.map(s => ({
      date: s.createdAt,
      subscribers: s.subscriberCount,
      growth: s.subsGrowth,
    })),
    topVideos: competitor.videos
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    avgViews: competitor.videos.reduce((sum, v) => sum + v.views, 0) / competitor.videos.length,
    uploadFrequency: calculateUploadFrequency(competitor.videos),
    commonKeywords: extractCommonKeywords(competitor.videos),
  };

  return NextResponse.json(analytics);
}
```

---

## UI Components

### Competitor Dashboard

```tsx
// app/(workspace)/competitors/page.tsx

"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { AddCompetitorDialog } from "@/components/competitors/add-competitor-dialog";

export default function CompetitorsPage() {
  const { data: competitors, isLoading } = useQuery({
    queryKey: ['competitors'],
    queryFn: async () => {
      const res = await fetch('/api/competitors');
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competitor Tracking</h1>
          <p className="text-muted-foreground">
            Monitor competitor channels and learn from their success
          </p>
        </div>
        <AddCompetitorDialog />
      </div>

      {/* Competitor Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {competitors?.map((competitor) => (
          <CompetitorCard key={competitor.id} competitor={competitor} />
        ))}
      </div>
    </div>
  );
}

function CompetitorCard({ competitor }) {
  const growthPositive = competitor.subsGrowth > 0;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <img
          src={competitor.thumbnailUrl}
          alt={competitor.channelTitle}
          className="h-16 w-16 rounded-full"
        />
        <div className="flex-1">
          <h3 className="font-semibold">{competitor.channelTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {competitor.subscriberCount.toLocaleString()} subscribers
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {growthPositive ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
        <span className={growthPositive ? "text-green-600" : "text-red-600"}>
          {competitor.subsGrowthPercent}% this week
        </span>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">Recent Videos</p>
        <div className="mt-2 space-y-2">
          {competitor.recentVideos.slice(0, 3).map((video) => (
            <div key={video.id} className="text-sm">
              <p className="line-clamp-1">{video.title}</p>
              <p className="text-xs text-muted-foreground">
                {video.views.toLocaleString()} views
              </p>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        className="mt-4 w-full"
        onClick={() => window.location.href = `/competitors/${competitor.id}`}
      >
        View Analytics
      </Button>
    </Card>
  );
}
```

---

## Phase 2 Implementation Steps

### Day 1: Database & Schema
- [ ] Add Competitor, CompetitorSnapshot, CompetitorVideo, CompetitorAlert models
- [ ] Run database migration
- [ ] Set up Inngest for background jobs
- [ ] Test YouTube channel data fetching

### Day 2: Core API
- [ ] Create POST /api/competitors/add endpoint
- [ ] Create GET /api/competitors endpoint
- [ ] Create GET /api/competitors/[id]/analytics endpoint
- [ ] Implement tier-based limits

### Day 3: Background Jobs
- [ ] Create daily sync job
- [ ] Implement snapshot creation
- [ ] Build video tracking system
- [ ] Set up alert generation

### Day 4: UI Components
- [ ] Build competitor dashboard
- [ ] Create add competitor dialog
- [ ] Build competitor card component
- [ ] Create detailed analytics page

### Day 5: Testing & Polish
- [ ] End-to-end testing
- [ ] Add email notifications
- [ ] Implement export functionality
- [ ] Performance optimization

---

## Success Criteria

✅ Users can track 3-10 competitors based on tier
✅ Daily sync runs reliably
✅ Data updates within 24 hours
✅ Alerts sent for new videos and viral content
✅ Growth charts display accurately
✅ < 5 seconds load time for dashboard

---

# Phase 3: SEO Score Engine

**Duration**: 3-4 days
**Priority**: P1 (High)
**Dependencies**: Phase 1 (Keyword Research) completed

---

## Overview

Build an automated SEO scoring system that evaluates video optimization on a 1-100 scale, providing actionable recommendations for improvement.

---

## Features to Implement

### 3.1 Video SEO Score
- Overall score (1-100)
- Category breakdown:
  - Title optimization (30%)
  - Description quality (25%)
  - Keywords/tags (25%)
  - Thumbnail quality (20%)

### 3.2 Optimization Checklist
- ✓ Title length optimal (50-60 chars)
- ✓ Keywords in first 60 chars of description
- ✓ 5+ relevant tags
- ✓ Thumbnail has high CTR prediction
- ✓ Description has timestamps
- ✓ Call-to-action included

### 3.3 Real-Time Suggestions
- Live score updates as user types
- Specific recommendations
- Before/after comparisons
- Competitor benchmark

### 3.4 Historical Tracking
- Track score over time
- Compare published videos
- Identify patterns in top-performing content

---

## Technical Specifications

### Database Schema

```prisma
// Add to schema.prisma

model VideoSEO {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content (can be draft or published video)
  contentIdeaId     String?
  contentIdea       ContentIdea? @relation(fields: [contentIdeaId], references: [id])

  videoId           String?  // YouTube video ID if published

  // Content for analysis
  title             String
  description       String?  @db.Text
  tags              String[] @default([])
  thumbnailUrl      String?

  // Scores (0-100)
  overallScore      Int
  titleScore        Int
  descriptionScore  Int
  keywordScore      Int
  thumbnailScore    Int

  // Analysis
  recommendations   Json     // Array of suggestions
  checklist         Json     // Checklist items with pass/fail

  // Metadata
  analyzedAt        DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([contentIdeaId])
  @@map("video_seo")
}

model SEORecommendation {
  id          String   @id @default(cuid())
  type        String   // 'title' | 'description' | 'keywords' | 'thumbnail'
  priority    String   // 'high' | 'medium' | 'low'
  message     String
  example     String?

  createdAt   DateTime @default(now())

  @@map("seo_recommendations")
}
```

### SEO Scoring Algorithm

```typescript
// lib/algorithms/seo-score.ts

interface SEOInput {
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  targetKeyword?: string;
}

interface SEOScore {
  overall: number;
  breakdown: {
    title: number;
    description: number;
    keywords: number;
    thumbnail: number;
  };
  recommendations: Recommendation[];
  checklist: ChecklistItem[];
}

interface Recommendation {
  type: 'title' | 'description' | 'keywords' | 'thumbnail';
  priority: 'high' | 'medium' | 'low';
  message: string;
  example?: string;
}

interface ChecklistItem {
  label: string;
  passed: boolean;
  weight: number;
}

export async function calculateSEOScore(input: SEOInput): Promise<SEOScore> {
  const titleScore = analyzeTitleSEO(input.title, input.targetKeyword);
  const descriptionScore = analyzeDescriptionSEO(input.description, input.targetKeyword);
  const keywordScore = analyzeKeywordsSEO(input.tags, input.targetKeyword);
  const thumbnailScore = await analyzeThumbnailSEO(input.thumbnailUrl);

  // Weighted average
  const overall = Math.round(
    titleScore.score * 0.30 +
    descriptionScore.score * 0.25 +
    keywordScore.score * 0.25 +
    thumbnailScore.score * 0.20
  );

  const recommendations = [
    ...titleScore.recommendations,
    ...descriptionScore.recommendations,
    ...keywordScore.recommendations,
    ...thumbnailScore.recommendations,
  ].sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  });

  const checklist = [
    ...titleScore.checklist,
    ...descriptionScore.checklist,
    ...keywordScore.checklist,
    ...thumbnailScore.checklist,
  ];

  return {
    overall,
    breakdown: {
      title: titleScore.score,
      description: descriptionScore.score,
      keywords: keywordScore.score,
      thumbnail: thumbnailScore.score,
    },
    recommendations,
    checklist,
  };
}

function analyzeTitleSEO(title: string, keyword?: string) {
  const score = 0;
  const recommendations: Recommendation[] = [];
  const checklist: ChecklistItem[] = [];

  // Length check (50-60 chars is optimal)
  const length = title.length;
  const lengthScore = length >= 50 && length <= 60 ? 100 :
                     length >= 40 && length <= 70 ? 70 : 50;

  checklist.push({
    label: 'Title length is optimal (50-60 characters)',
    passed: length >= 50 && length <= 60,
    weight: 20,
  });

  if (length < 40) {
    recommendations.push({
      type: 'title',
      priority: 'high',
      message: 'Title is too short. Aim for 50-60 characters.',
      example: 'Add more descriptive words or include your target keyword.',
    });
  } else if (length > 70) {
    recommendations.push({
      type: 'title',
      priority: 'medium',
      message: 'Title may be truncated in search results. Keep it under 60 characters.',
    });
  }

  // Keyword placement
  let keywordScore = 50;
  if (keyword) {
    const lowerTitle = title.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    if (lowerTitle.includes(lowerKeyword)) {
      const position = lowerTitle.indexOf(lowerKeyword);
      // Keyword at start is best
      keywordScore = position === 0 ? 100 : position < 20 ? 85 : 70;

      checklist.push({
        label: 'Target keyword appears in title',
        passed: true,
        weight: 30,
      });
    } else {
      recommendations.push({
        type: 'title',
        priority: 'high',
        message: `Include your target keyword "${keyword}" in the title`,
        example: `Try: "${keyword} - ${title.substring(0, 40)}..."`,
      });

      checklist.push({
        label: 'Target keyword appears in title',
        passed: false,
        weight: 30,
      });
    }
  }

  // Numbers and power words
  const hasNumber = /\d/.test(title);
  const powerWords = ['ultimate', 'guide', 'secrets', 'proven', 'easy', 'fast', 'best', 'top', 'how to'];
  const hasPowerWord = powerWords.some(word => title.toLowerCase().includes(word));

  let engagementScore = 50;
  if (hasNumber) engagementScore += 25;
  if (hasPowerWord) engagementScore += 25;

  checklist.push({
    label: 'Title includes numbers or power words',
    passed: hasNumber || hasPowerWord,
    weight: 15,
  });

  if (!hasNumber && !hasPowerWord) {
    recommendations.push({
      type: 'title',
      priority: 'medium',
      message: 'Add numbers or power words to increase CTR',
      example: 'Try: "7 Tips for..." or "Ultimate Guide to..."',
    });
  }

  // Capitalization
  const isAllCaps = title === title.toUpperCase();
  if (isAllCaps) {
    recommendations.push({
      type: 'title',
      priority: 'low',
      message: 'Avoid ALL CAPS - it reduces credibility',
    });
  }

  // Calculate final score
  const finalScore = Math.round(
    (lengthScore * 0.35 + keywordScore * 0.45 + engagementScore * 0.20)
  );

  return { score: finalScore, recommendations, checklist };
}

function analyzeDescriptionSEO(description: string, keyword?: string) {
  const score = 0;
  const recommendations: Recommendation[] = [];
  const checklist: ChecklistItem[] = [];

  if (!description || description.length < 50) {
    recommendations.push({
      type: 'description',
      priority: 'high',
      message: 'Description is too short. Aim for at least 200 characters.',
      example: 'Expand on what viewers will learn, include timestamps, and add links.',
    });

    checklist.push({
      label: 'Description has minimum 200 characters',
      passed: false,
      weight: 25,
    });

    return { score: 20, recommendations, checklist };
  }

  let lengthScore = 50;
  const length = description.length;
  if (length >= 200 && length <= 5000) {
    lengthScore = 100;
    checklist.push({
      label: 'Description has minimum 200 characters',
      passed: true,
      weight: 25,
    });
  } else if (length > 5000) {
    lengthScore = 75;
    recommendations.push({
      type: 'description',
      priority: 'low',
      message: 'Description is very long. Most viewers won\'t read it all.',
    });
  }

  // Keyword in first 150 characters
  let keywordScore = 50;
  if (keyword) {
    const first150 = description.substring(0, 150).toLowerCase();
    if (first150.includes(keyword.toLowerCase())) {
      keywordScore = 100;
      checklist.push({
        label: 'Keyword appears in first 150 characters',
        passed: true,
        weight: 30,
      });
    } else if (description.toLowerCase().includes(keyword.toLowerCase())) {
      keywordScore = 70;
      recommendations.push({
        type: 'description',
        priority: 'high',
        message: 'Move your target keyword to the first 150 characters',
      });
      checklist.push({
        label: 'Keyword appears in first 150 characters',
        passed: false,
        weight: 30,
      });
    } else {
      recommendations.push({
        type: 'description',
        priority: 'high',
        message: `Include your target keyword "${keyword}" in the description`,
      });
    }
  }

  // Has timestamps
  const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
  checklist.push({
    label: 'Includes timestamps',
    passed: hasTimestamps,
    weight: 15,
  });

  if (!hasTimestamps) {
    recommendations.push({
      type: 'description',
      priority: 'medium',
      message: 'Add timestamps to improve user experience',
      example: '0:00 - Introduction\n2:15 - Main topic\n5:30 - Conclusion',
    });
  }

  // Has links
  const hasLinks = /https?:\/\//.test(description);
  checklist.push({
    label: 'Includes relevant links',
    passed: hasLinks,
    weight: 10,
  });

  if (!hasLinks) {
    recommendations.push({
      type: 'description',
      priority: 'low',
      message: 'Add links to related content, products, or resources',
    });
  }

  // Has CTA
  const ctaWords = ['subscribe', 'like', 'comment', 'share', 'follow', 'check out', 'watch'];
  const hasCTA = ctaWords.some(word => description.toLowerCase().includes(word));
  checklist.push({
    label: 'Includes call-to-action',
    passed: hasCTA,
    weight: 20,
  });

  if (!hasCTA) {
    recommendations.push({
      type: 'description',
      priority: 'medium',
      message: 'Add a call-to-action (subscribe, like, comment)',
    });
  }

  const finalScore = Math.round(
    lengthScore * 0.25 +
    keywordScore * 0.35 +
    (hasTimestamps ? 100 : 50) * 0.15 +
    (hasLinks ? 100 : 50) * 0.10 +
    (hasCTA ? 100 : 50) * 0.15
  );

  return { score: finalScore, recommendations, checklist };
}

function analyzeKeywordsSEO(tags: string[], keyword?: string) {
  const recommendations: Recommendation[] = [];
  const checklist: ChecklistItem[] = [];

  // Number of tags
  const tagCount = tags.length;
  let countScore = 50;

  if (tagCount >= 5 && tagCount <= 15) {
    countScore = 100;
    checklist.push({
      label: 'Has 5-15 relevant tags',
      passed: true,
      weight: 30,
    });
  } else if (tagCount < 5) {
    recommendations.push({
      type: 'keywords',
      priority: 'high',
      message: `Add more tags. You have ${tagCount}, aim for 5-15.`,
      example: 'Include variations of your main keyword and related topics.',
    });
    checklist.push({
      label: 'Has 5-15 relevant tags',
      passed: false,
      weight: 30,
    });
  } else {
    recommendations.push({
      type: 'keywords',
      priority: 'low',
      message: 'Too many tags can dilute relevance. Stick to 5-15 best ones.',
    });
  }

  // Target keyword as first tag
  let keywordScore = 50;
  if (keyword && tags.length > 0) {
    if (tags[0].toLowerCase() === keyword.toLowerCase()) {
      keywordScore = 100;
      checklist.push({
        label: 'Target keyword is first tag',
        passed: true,
        weight: 40,
      });
    } else if (tags.some(tag => tag.toLowerCase() === keyword.toLowerCase())) {
      keywordScore = 75;
      recommendations.push({
        type: 'keywords',
        priority: 'medium',
        message: 'Move your target keyword to the first tag position',
      });
    } else {
      recommendations.push({
        type: 'keywords',
        priority: 'high',
        message: `Add "${keyword}" as your first tag`,
      });
      checklist.push({
        label: 'Target keyword is first tag',
        passed: false,
        weight: 40,
      });
    }
  }

  // Tag length (not too long)
  const longTags = tags.filter(tag => tag.length > 30);
  if (longTags.length > 0) {
    recommendations.push({
      type: 'keywords',
      priority: 'low',
      message: 'Some tags are too long. Keep tags under 30 characters.',
    });
  }

  checklist.push({
    label: 'All tags are concise (<30 characters)',
    passed: longTags.length === 0,
    weight: 15,
  });

  // Variety (not all single-word tags)
  const singleWordTags = tags.filter(tag => !tag.includes(' '));
  const varietyScore = singleWordTags.length < tags.length * 0.7 ? 100 : 50;

  checklist.push({
    label: 'Mix of single and multi-word tags',
    passed: varietyScore === 100,
    weight: 15,
  });

  if (varietyScore === 50) {
    recommendations.push({
      type: 'keywords',
      priority: 'medium',
      message: 'Include more phrase tags, not just single words',
      example: '"video editing tips" instead of just "editing"',
    });
  }

  const finalScore = Math.round(
    countScore * 0.30 +
    keywordScore * 0.45 +
    varietyScore * 0.25
  );

  return { score: finalScore, recommendations, checklist };
}

async function analyzeThumbnailSEO(thumbnailUrl?: string) {
  const recommendations: Recommendation[] = [];
  const checklist: ChecklistItem[] = [];

  if (!thumbnailUrl) {
    recommendations.push({
      type: 'thumbnail',
      priority: 'high',
      message: 'Upload a custom thumbnail - videos with custom thumbnails get 2x more views',
    });

    return {
      score: 0,
      recommendations,
      checklist: [{
        label: 'Has custom thumbnail',
        passed: false,
        weight: 100,
      }]
    };
  }

  // If we have CTR prediction from thumbnail generator, use that
  // Otherwise, use basic checks

  checklist.push({
    label: 'Has custom thumbnail',
    passed: true,
    weight: 40,
  });

  // Check if it's a ViralSnipAI-generated thumbnail (has storagePath in DB)
  // If yes, get the CTR score
  const thumbnail = await prisma.thumbnail.findFirst({
    where: { imageUrl: thumbnailUrl },
    select: { ctrScore: true },
  });

  if (thumbnail?.ctrScore) {
    checklist.push({
      label: 'Thumbnail has high CTR prediction',
      passed: thumbnail.ctrScore >= 70,
      weight: 60,
    });

    if (thumbnail.ctrScore < 70) {
      recommendations.push({
        type: 'thumbnail',
        priority: 'high',
        message: 'Generate a new thumbnail with better CTR prediction',
        example: 'Use bold colors, clear text, and emotional expressions.',
      });
    }

    return {
      score: thumbnail.ctrScore,
      recommendations,
      checklist,
    };
  }

  // Basic fallback score if no CTR data
  return {
    score: 75,
    recommendations,
    checklist,
  };
}
```

---

## API Endpoints

### POST /api/seo/analyze
Analyze SEO for content

```typescript
// app/api/seo/analyze/route.ts

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, tags, thumbnailUrl, targetKeyword, contentIdeaId } = await request.json();

  // Calculate SEO score
  const seoScore = await calculateSEOScore({
    title,
    description,
    tags,
    thumbnailUrl,
    targetKeyword,
  });

  // Save to database
  const seo = await prisma.videoSEO.create({
    data: {
      userId: user.id,
      contentIdeaId,
      title,
      description,
      tags,
      thumbnailUrl,
      overallScore: seoScore.overall,
      titleScore: seoScore.breakdown.title,
      descriptionScore: seoScore.breakdown.description,
      keywordScore: seoScore.breakdown.keywords,
      thumbnailScore: seoScore.breakdown.thumbnail,
      recommendations: seoScore.recommendations,
      checklist: seoScore.checklist,
    },
  });

  return NextResponse.json({
    id: seo.id,
    ...seoScore,
  });
}
```

### GET /api/seo/history
Get SEO score history

```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const history = await prisma.videoSEO.findMany({
    where: { userId: user.id },
    orderBy: { analyzedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(history);
}
```

---

## UI Components

### SEO Score Widget

```tsx
// components/seo/seo-score-widget.tsx

"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface SEOScoreWidgetProps {
  score: number;
  breakdown: {
    title: number;
    description: number;
    keywords: number;
    thumbnail: number;
  };
  recommendations: any[];
  checklist: any[];
}

export function SEOScoreWidget({ score, breakdown, recommendations, checklist }: SEOScoreWidgetProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-50 dark:bg-green-950/20";
    if (score >= 60) return "bg-yellow-50 dark:bg-yellow-950/20";
    return "bg-red-50 dark:bg-red-950/20";
  };

  return (
    <Card className="p-6">
      <div className="mb-6 text-center">
        <div className={`inline-flex h-24 w-24 items-center justify-center rounded-full ${getScoreBg(score)}`}>
          <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold">SEO Score</h3>
        <p className="text-sm text-muted-foreground">
          {score >= 80 ? "Excellent!" : score >= 60 ? "Good" : "Needs Improvement"}
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-4">
        <ScoreBar label="Title" score={breakdown.title} />
        <ScoreBar label="Description" score={breakdown.description} />
        <ScoreBar label="Keywords" score={breakdown.keywords} />
        <ScoreBar label="Thumbnail" score={breakdown.thumbnail} />
      </div>

      {/* Checklist */}
      <div className="mt-6 space-y-2">
        <h4 className="font-medium">Optimization Checklist</h4>
        {checklist.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {item.passed ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={item.passed ? "" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-medium">Recommendations</h4>
          {recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} className="rounded-lg bg-secondary p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{rec.message}</p>
                  {rec.example && (
                    <p className="mt-1 text-xs text-muted-foreground">{rec.example}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <Progress value={score} />
    </div>
  );
}
```

---

## Phase 3 Implementation Steps

### Day 1: Algorithm Development
- [ ] Build title analysis function
- [ ] Build description analysis function
- [ ] Build keywords analysis function
- [ ] Build thumbnail analysis function
- [ ] Write unit tests

### Day 2: Database & API
- [ ] Add VideoSEO and SEORecommendation models
- [ ] Run database migration
- [ ] Create POST /api/seo/analyze endpoint
- [ ] Create GET /api/seo/history endpoint
- [ ] Test API endpoints

### Day 3: UI Components
- [ ] Build SEO Score Widget
- [ ] Create real-time analyzer
- [ ] Add to Title Generator
- [ ] Add to Script Generator
- [ ] Add to Thumbnail Generator

### Day 4: Integration & Testing
- [ ] Integrate with Dashboard
- [ ] Add historical tracking
- [ ] Implement export functionality
- [ ] End-to-end testing
- [ ] Performance optimization

---

## Success Criteria

✅ Scores calculate in < 1 second
✅ Recommendations are actionable
✅ 90%+ accuracy vs. manual review
✅ Integrates seamlessly into workflow
✅ Users understand how to improve scores

---

# Phase 4: Real-Time Analytics Dashboard

**Duration**: 5-6 days
**Priority**: P2 (Medium)
**Dependencies**: Phase 2 (Competitor Tracking) recommended

---

## Overview

Build a real-time analytics system that tracks VPH (Views Per Hour), monitors first 48 hours performance, and provides alerts for viral videos. This is VidIQ's unique feature that creators love.

---

## Features to Implement

### 4.1 VPH Tracking
- Views Per Hour for user's videos
- Compare to channel average
- Competitor VPH comparison
- Hour-by-hour chart

### 4.2 First 48 Hours Dashboard
- Focused view on new uploads
- Real-time performance vs. historical average
- "Is this video performing well?" indicator
- Milestone alerts (1K, 10K, 100K views)

### 4.3 Performance Alerts
- Email when video goes viral (>2x avg)
- Notification when underperforming (<50% avg)
- Hourly digest for new uploads
- Weekly summary report

### 4.4 Analytics Widgets
- Embeddable widgets for Dashboard
- Quick stats cards
- Performance trends
- Top-performing videos

---

## Technical Specifications

### Database Schema

```prisma
// Add to schema.prisma

model VideoAnalytics {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  videoId         String   // YouTube video ID
  videoTitle      String
  thumbnailUrl    String
  publishedAt     DateTime

  // Current Stats
  views           Int
  likes           Int?
  comments        Int?
  shares          Int?

  // VPH Tracking
  currentVPH      Float    // Current views per hour
  avgVPH          Float    // Average VPH for this channel
  peakVPH         Float    // Highest VPH recorded

  // Performance Indicators
  isViral         Boolean  @default(false)
  isUnderperforming Boolean @default(false)
  performanceRating String  // 'excellent' | 'good' | 'average' | 'poor'

  // Metadata
  lastSynced      DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  snapshots       VideoSnapshot[]
  alerts          PerformanceAlert[]

  @@unique([userId, videoId])
  @@index([userId])
  @@index([publishedAt])
  @@map("video_analytics")
}

model VideoSnapshot {
  id              String         @id @default(cuid())
  videoAnalyticsId String
  videoAnalytics  VideoAnalytics @relation(fields: [videoAnalyticsId], references: [id], onDelete: Cascade)

  // Stats at this point in time
  views           Int
  likes           Int?
  comments        Int?
  shares          Int?

  // VPH at snapshot
  vph             Float

  // Hours since publish
  hoursSincePublish Int

  createdAt       DateTime       @default(now())

  @@index([videoAnalyticsId])
  @@index([hoursSincePublish])
  @@map("video_snapshots")
}

model PerformanceAlert {
  id              String         @id @default(cuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  videoAnalyticsId String
  videoAnalytics  VideoAnalytics @relation(fields: [videoAnalyticsId], references: [id], onDelete: Cascade)

  type            String         // 'viral' | 'underperforming' | 'milestone'
  message         String
  threshold       Int?           // e.g., 10000 for milestone

  isRead          Boolean        @default(false)
  emailSent       Boolean        @default(false)

  createdAt       DateTime       @default(now())

  @@index([userId, isRead])
  @@map("performance_alerts")
}

model ChannelStats {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  channelId       String

  // Calculated averages
  avgVPH          Float
  avgViews24h     Int
  avgViews48h     Int
  avgViews7d      Int
  avgViews30d     Int

  // Benchmark for comparisons
  totalVideos     Int
  lastCalculated  DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, channelId])
  @@map("channel_stats")
}
```

### Background Job - Hourly Sync

```typescript
// lib/jobs/video-analytics-sync.ts

export const videoAnalyticsHourlySync = inngest.createFunction(
  { id: "video-analytics-hourly-sync" },
  { cron: "0 * * * *" }, // Run every hour
  async ({ step }) => {
    // Get all videos published in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trackedVideos = await step.run("fetch-tracked-videos", async () => {
      return prisma.videoAnalytics.findMany({
        where: {
          publishedAt: { gte: sevenDaysAgo },
        },
        include: { user: true },
      });
    });

    // Process each video
    for (const video of trackedVideos) {
      await step.run(`sync-${video.videoId}`, async () => {
        // Fetch latest stats from YouTube
        const videoData = await youtube.videos.list({
          part: ['statistics'],
          id: [video.videoId],
        });

        if (!videoData.items.length) return;

        const stats = videoData.items[0].statistics;
        const newViews = parseInt(stats.viewCount);

        // Calculate hours since publish
        const hoursSincePublish = Math.floor(
          (Date.now() - video.publishedAt.getTime()) / (1000 * 60 * 60)
        );

        // Calculate VPH
        const vph = hoursSincePublish > 0 ? newViews / hoursSincePublish : 0;

        // Create snapshot
        await prisma.videoSnapshot.create({
          data: {
            videoAnalyticsId: video.id,
            views: newViews,
            likes: parseInt(stats.likeCount || 0),
            comments: parseInt(stats.commentCount || 0),
            vph,
            hoursSincePublish,
          },
        });

        // Get channel averages
        const channelStats = await prisma.channelStats.findFirst({
          where: { userId: video.userId },
        });

        // Determine performance
        let isViral = false;
        let isUnderperforming = false;
        let performanceRating = 'average';

        if (channelStats) {
          const avgVPH = channelStats.avgVPH;

          if (vph > avgVPH * 2) {
            isViral = true;
            performanceRating = 'excellent';

            // Send viral alert
            await createAlert(video, 'viral', `Your video is going viral! ${newViews.toLocaleString()} views and counting.`);
          } else if (vph < avgVPH * 0.5) {
            isUnderperforming = true;
            performanceRating = 'poor';

            // Send underperforming alert (only once, after 24h)
            if (hoursSincePublish === 24) {
              await createAlert(video, 'underperforming', `Video is underperforming. Consider promoting it.`);
            }
          } else if (vph > avgVPH) {
            performanceRating = 'good';
          }
        }

        // Check milestones
        const milestones = [1000, 10000, 100000, 1000000];
        for (const milestone of milestones) {
          if (newViews >= milestone && video.views < milestone) {
            await createAlert(video, 'milestone', `🎉 Your video hit ${milestone.toLocaleString()} views!`, milestone);
          }
        }

        // Update video analytics
        await prisma.videoAnalytics.update({
          where: { id: video.id },
          data: {
            views: newViews,
            likes: parseInt(stats.likeCount || 0),
            comments: parseInt(stats.commentCount || 0),
            currentVPH: vph,
            peakVPH: Math.max(vph, video.peakVPH),
            isViral,
            isUnderperforming,
            performanceRating,
            lastSynced: new Date(),
          },
        });
      });
    }

    return { processed: trackedVideos.length };
  }
);

async function createAlert(video: any, type: string, message: string, threshold?: number) {
  await prisma.performanceAlert.create({
    data: {
      userId: video.userId,
      videoAnalyticsId: video.id,
      type,
      message,
      threshold,
    },
  });

  // Send email notification
  await sendEmail({
    to: video.user.email,
    subject: `[ViralSnipAI] ${message}`,
    html: `
      <h2>${message}</h2>
      <p>Video: ${video.videoTitle}</p>
      <p>Current views: ${video.views.toLocaleString()}</p>
      <p>VPH: ${video.currentVPH.toFixed(2)}</p>
      <a href="https://app.viralsnipai.com/analytics/${video.id}">View Analytics</a>
    `,
  });
}
```

### Calculate Channel Averages

```typescript
// lib/jobs/calculate-channel-stats.ts

export const calculateChannelStats = inngest.createFunction(
  { id: "calculate-channel-stats" },
  { cron: "0 3 * * *" }, // Run at 3 AM daily
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return prisma.user.findMany({
        select: { id: true },
      });
    });

    for (const user of users) {
      await step.run(`calc-${user.id}`, async () => {
        // Get all user's videos from last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const videos = await prisma.videoAnalytics.findMany({
          where: {
            userId: user.id,
            publishedAt: { gte: thirtyDaysAgo },
          },
          include: {
            snapshots: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (videos.length === 0) return;

        // Calculate average VPH
        const avgVPH = videos.reduce((sum, v) => sum + v.currentVPH, 0) / videos.length;

        // Calculate average views at different timeframes
        const views24h = videos
          .flatMap(v => v.snapshots.filter(s => s.hoursSincePublish === 24))
          .map(s => s.views);
        const avgViews24h = views24h.length > 0
          ? views24h.reduce((sum, v) => sum + v, 0) / views24h.length
          : 0;

        const views48h = videos
          .flatMap(v => v.snapshots.filter(s => s.hoursSincePublish === 48))
          .map(s => s.views);
        const avgViews48h = views48h.length > 0
          ? views48h.reduce((sum, v) => sum + v, 0) / views48h.length
          : 0;

        // Save channel stats
        await prisma.channelStats.upsert({
          where: {
            userId_channelId: {
              userId: user.id,
              channelId: 'default', // Assuming one channel per user for now
            },
          },
          create: {
            userId: user.id,
            channelId: 'default',
            avgVPH,
            avgViews24h: Math.round(avgViews24h),
            avgViews48h: Math.round(avgViews48h),
            avgViews7d: 0, // TODO: Calculate
            avgViews30d: 0, // TODO: Calculate
            totalVideos: videos.length,
          },
          update: {
            avgVPH,
            avgViews24h: Math.round(avgViews24h),
            avgViews48h: Math.round(avgViews48h),
            totalVideos: videos.length,
            lastCalculated: new Date(),
          },
        });
      });
    }

    return { processed: users.length };
  }
);
```

---

## API Endpoints

### POST /api/analytics/track
Start tracking a video

```typescript
// app/api/analytics/track/route.ts

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { videoId, videoUrl } = await request.json();

  // Extract video ID if URL provided
  const extractedId = videoId || extractVideoId(videoUrl);

  // Fetch video data from YouTube
  const videoData = await youtube.videos.list({
    part: ['snippet', 'statistics'],
    id: [extractedId],
  });

  if (!videoData.items.length) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const video = videoData.items[0];
  const stats = video.statistics;

  // Create analytics record
  const analytics = await prisma.videoAnalytics.create({
    data: {
      userId: user.id,
      videoId: extractedId,
      videoTitle: video.snippet.title,
      thumbnailUrl: video.snippet.thumbnails.high.url,
      publishedAt: new Date(video.snippet.publishedAt),
      views: parseInt(stats.viewCount),
      likes: parseInt(stats.likeCount || 0),
      comments: parseInt(stats.commentCount || 0),
      currentVPH: 0, // Will be calculated by background job
      avgVPH: 0,
      peakVPH: 0,
      performanceRating: 'average',
    },
  });

  // Create initial snapshot
  await prisma.videoSnapshot.create({
    data: {
      videoAnalyticsId: analytics.id,
      views: parseInt(stats.viewCount),
      likes: parseInt(stats.likeCount || 0),
      comments: parseInt(stats.commentCount || 0),
      vph: 0,
      hoursSincePublish: 0,
    },
  });

  return NextResponse.json(analytics);
}

function extractVideoId(url: string): string {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL');
}
```

### GET /api/analytics/videos
Get user's tracked videos

```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const videos = await prisma.videoAnalytics.findMany({
    where: { userId: user.id },
    orderBy: { publishedAt: 'desc' },
    include: {
      snapshots: {
        orderBy: { createdAt: 'desc' },
        take: 48, // Last 48 hours
      },
      alerts: {
        where: { isRead: false },
      },
    },
  });

  return NextResponse.json(videos);
}
```

### GET /api/analytics/[videoId]/detailed
Get detailed analytics for a video

```typescript
export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const analytics = await prisma.videoAnalytics.findFirst({
    where: {
      userId: user.id,
      videoId: params.videoId,
    },
    include: {
      snapshots: {
        orderBy: { createdAt: 'asc' },
      },
      alerts: true,
    },
  });

  if (!analytics) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  // Get channel averages for comparison
  const channelStats = await prisma.channelStats.findFirst({
    where: { userId: user.id },
  });

  return NextResponse.json({
    ...analytics,
    channelStats,
  });
}
```

---

## UI Components

### Real-Time Analytics Dashboard

```tsx
// app/(workspace)/analytics/page.tsx

"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Eye, ThumbsUp } from "lucide-react";

export default function AnalyticsPage() {
  const { data: videos } = useQuery({
    queryKey: ['analytics-videos'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/videos');
      return res.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Real-Time Analytics</h1>
        <p className="text-muted-foreground">
          Track your video performance hour by hour
        </p>
      </div>

      {/* Video Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {videos?.map((video) => (
          <VideoAnalyticsCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}

function VideoAnalyticsCard({ video }) {
  const performanceColor = {
    excellent: 'text-green-600 bg-green-50 dark:bg-green-950/20',
    good: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
    average: 'text-gray-600 bg-gray-50 dark:bg-gray-950/20',
    poor: 'text-red-600 bg-red-50 dark:bg-red-950/20',
  }[video.performanceRating];

  // Prepare chart data
  const chartData = video.snapshots.map(s => ({
    hour: s.hoursSincePublish,
    views: s.views,
    vph: s.vph,
  }));

  return (
    <Card className="p-6">
      <div className="flex gap-4">
        <img
          src={video.thumbnailUrl}
          alt={video.videoTitle}
          className="h-20 w-32 rounded object-cover"
        />
        <div className="flex-1">
          <h3 className="line-clamp-2 font-semibold">{video.videoTitle}</h3>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span>{video.views.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              <span>{video.likes?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Indicator */}
      <div className={`mt-4 rounded-lg p-3 ${performanceColor}`}>
        <div className="flex items-center justify-between">
          <span className="font-medium capitalize">{video.performanceRating}</span>
          <div className="flex items-center gap-2">
            {video.currentVPH > video.avgVPH ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">
              {video.currentVPH.toFixed(1)} VPH
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs">
          Channel average: {video.avgVPH.toFixed(1)} VPH
        </p>
      </div>

      {/* VPH Chart */}
      <div className="mt-4 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" label={{ value: 'Hours', position: 'insideBottom', offset: -5 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="vph" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alerts */}
      {video.alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {video.alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg bg-primary/10 p-2 text-sm">
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

---

## Phase 4 Implementation Steps

### Day 1: Database & Jobs Setup
- [ ] Add VideoAnalytics, VideoSnapshot, PerformanceAlert, ChannelStats models
- [ ] Run database migration
- [ ] Set up Inngest hourly sync job
- [ ] Set up daily channel stats calculation
- [ ] Test background jobs

### Day 2: Core API
- [ ] Create POST /api/analytics/track endpoint
- [ ] Create GET /api/analytics/videos endpoint
- [ ] Create GET /api/analytics/[videoId]/detailed endpoint
- [ ] Implement VPH calculation
- [ ] Test API endpoints

### Day 3: Alert System
- [ ] Implement alert creation logic
- [ ] Build email notification templates
- [ ] Create alert management UI
- [ ] Test email delivery

### Day 4: UI Components
- [ ] Build real-time analytics dashboard
- [ ] Create video analytics card
- [ ] Build VPH chart component
- [ ] Add performance indicators

### Day 5: Integration
- [ ] Add analytics widgets to main Dashboard
- [ ] Create "Add to tracking" buttons in Content Calendar
- [ ] Implement milestone celebrations
- [ ] Add export functionality

### Day 6: Testing & Polish
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Add usage limits by tier
- [ ] Write user documentation

---

## Success Criteria

✅ VPH updates every hour
✅ Data displays in real-time (<60s delay)
✅ Alerts sent within 5 minutes of threshold
✅ 95%+ uptime for background jobs
✅ Charts load in < 2 seconds
✅ Email deliverability > 95%

---

# Database Schema

## Complete Prisma Schema

Add these models to your existing `schema.prisma`:

```prisma
// ============================================
// KEYWORD RESEARCH
// ============================================

model KeywordResearch {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  keyword           String
  searchVolume      Int
  competition       Int
  difficulty        String
  trendDirection    String

  avgViews          Int?
  avgLikes          Int?
  avgComments       Int?
  estimatedCPM      Float?

  relatedKeywords   Json?
  topVideos         Json?
  lastUpdated       DateTime @default(now())

  isSaved           Boolean  @default(false)
  tags              String[] @default([])
  notes             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([keyword])
  @@index([searchVolume])
  @@map("keyword_research")
}

model SavedKeyword {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  keyword     String
  listName    String?
  tags        String[] @default([])
  notes       String?

  createdAt   DateTime @default(now())

  @@unique([userId, keyword])
  @@index([userId])
  @@map("saved_keywords")
}

// ============================================
// COMPETITOR TRACKING
// ============================================

model Competitor {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  channelId       String
  channelTitle    String
  channelUrl      String
  thumbnailUrl    String?
  category        String?

  subscriberCount Int
  videoCount      Int
  viewCount       BigInt

  isActive        Boolean  @default(true)
  lastChecked     DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  snapshots       CompetitorSnapshot[]
  videos          CompetitorVideo[]

  @@unique([userId, channelId])
  @@index([userId])
  @@index([channelId])
  @@map("competitors")
}

model CompetitorSnapshot {
  id              String      @id @default(cuid())
  competitorId    String
  competitor      Competitor  @relation(fields: [competitorId], references: [id], onDelete: Cascade)

  subscriberCount Int
  videoCount      Int
  viewCount       BigInt

  subsGrowth      Int
  viewsGrowth     BigInt

  createdAt       DateTime    @default(now())

  @@index([competitorId])
  @@index([createdAt])
  @@map("competitor_snapshots")
}

model CompetitorVideo {
  id              String      @id @default(cuid())
  competitorId    String
  competitor      Competitor  @relation(fields: [competitorId], references: [id], onDelete: Cascade)

  videoId         String
  title           String
  description     String?     @db.Text
  thumbnailUrl    String

  publishedAt     DateTime
  duration        Int?

  views           Int
  likes           Int?
  comments        Int?

  keywords        String[]    @default([])
  isViral         Boolean     @default(false)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([competitorId, videoId])
  @@index([competitorId])
  @@index([publishedAt])
  @@map("competitor_videos")
}

model CompetitorAlert {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  type            String
  competitorId    String
  videoId         String?

  message         String
  isRead          Boolean     @default(false)

  createdAt       DateTime    @default(now())

  @@index([userId, isRead])
  @@map("competitor_alerts")
}

// ============================================
// SEO SCORE
// ============================================

model VideoSEO {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  contentIdeaId     String?
  contentIdea       ContentIdea? @relation(fields: [contentIdeaId], references: [id])

  videoId           String?

  title             String
  description       String?  @db.Text
  tags              String[] @default([])
  thumbnailUrl      String?

  overallScore      Int
  titleScore        Int
  descriptionScore  Int
  keywordScore      Int
  thumbnailScore    Int

  recommendations   Json
  checklist         Json

  analyzedAt        DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([contentIdeaId])
  @@map("video_seo")
}

// ============================================
// REAL-TIME ANALYTICS
// ============================================

model VideoAnalytics {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  videoId         String
  videoTitle      String
  thumbnailUrl    String
  publishedAt     DateTime

  views           Int
  likes           Int?
  comments        Int?
  shares          Int?

  currentVPH      Float
  avgVPH          Float
  peakVPH         Float

  isViral         Boolean  @default(false)
  isUnderperforming Boolean @default(false)
  performanceRating String

  lastSynced      DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  snapshots       VideoSnapshot[]
  alerts          PerformanceAlert[]

  @@unique([userId, videoId])
  @@index([userId])
  @@index([publishedAt])
  @@map("video_analytics")
}

model VideoSnapshot {
  id              String         @id @default(cuid())
  videoAnalyticsId String
  videoAnalytics  VideoAnalytics @relation(fields: [videoAnalyticsId], references: [id], onDelete: Cascade)

  views           Int
  likes           Int?
  comments        Int?
  shares          Int?

  vph             Float

  hoursSincePublish Int

  createdAt       DateTime       @default(now())

  @@index([videoAnalyticsId])
  @@index([hoursSincePublish])
  @@map("video_snapshots")
}

model PerformanceAlert {
  id              String         @id @default(cuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  videoAnalyticsId String
  videoAnalytics  VideoAnalytics @relation(fields: [videoAnalyticsId], references: [id], onDelete: Cascade)

  type            String
  message         String
  threshold       Int?

  isRead          Boolean        @default(false)
  emailSent       Boolean        @default(false)

  createdAt       DateTime       @default(now())

  @@index([userId, isRead])
  @@map("performance_alerts")
}

model ChannelStats {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  channelId       String

  avgVPH          Float
  avgViews24h     Int
  avgViews48h     Int
  avgViews7d      Int
  avgViews30d     Int

  totalVideos     Int
  lastCalculated  DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, channelId])
  @@map("channel_stats")
}
```

---

# API Endpoints Summary

## Complete API Routes

```
Keyword Research:
├── POST   /api/keywords/search          - Search keyword data
├── GET    /api/keywords/saved           - Get saved keywords
├── POST   /api/keywords/save            - Save a keyword
└── DELETE /api/keywords/:id             - Delete saved keyword

Competitor Tracking:
├── POST   /api/competitors/add          - Add competitor
├── GET    /api/competitors              - List competitors
├── GET    /api/competitors/:id          - Get competitor details
├── GET    /api/competitors/:id/analytics - Detailed analytics
├── DELETE /api/competitors/:id          - Remove competitor
└── POST   /api/competitors/sync         - Manual sync trigger

SEO Score:
├── POST   /api/seo/analyze              - Analyze SEO
├── GET    /api/seo/history              - Get score history
└── GET    /api/seo/:id                  - Get specific analysis

Real-Time Analytics:
├── POST   /api/analytics/track          - Track a video
├── GET    /api/analytics/videos         - List tracked videos
├── GET    /api/analytics/:videoId/detailed - Detailed analytics
├── GET    /api/analytics/alerts         - Get unread alerts
└── POST   /api/analytics/alerts/:id/read - Mark alert as read
```

---

# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Keyword    │  │  Competitor  │  │     SEO      │     │
│  │   Research   │  │   Tracking   │  │    Score     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Real-Time Analytics Dashboard              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API Routes)          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Keywords    │  │ Competitors  │  │  SEO         │     │
│  │  Routes      │  │  Routes      │  │  Routes      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Analytics Routes                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services & Algorithms                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Competition  │  │  SEO Score   │  │     VPH      │     │
│  │  Calculator  │  │  Algorithm   │  │  Calculator  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Background Jobs (Inngest)                  │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Hourly Sync     │  │  Daily Channel   │                │
│  │  (Competitors &  │  │  Stats           │                │
│  │   Analytics)     │  │  Calculation     │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      External Services                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   YouTube    │  │    Redis     │  │    Email     │     │
│  │  Data API    │  │   (Cache)    │  │  (Resend)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│                                                              │
│  • KeywordResearch    • Competitor       • VideoSEO         │
│  • SavedKeyword       • CompetitorSnapshot                  │
│  • VideoAnalytics     • CompetitorVideo                     │
│  • VideoSnapshot      • CompetitorAlert                     │
│  • PerformanceAlert   • ChannelStats                        │
└─────────────────────────────────────────────────────────────┘
```

---

# Testing Strategy

## Test Coverage Requirements

### Unit Tests (80% coverage)

```typescript
// lib/algorithms/__tests__/competition-score.test.ts
describe('Competition Score Algorithm', () => {
  it('should calculate score correctly', () => {
    const score = calculateCompetitionScore({
      totalResults: 5000,
      topChannelSize: 100000,
      avgViews: 10000,
      uploadFrequency: 20,
      domainAuthority: 50,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return "easy" for low competition', () => {
    const difficulty = getDifficultyRating(25);
    expect(difficulty).toBe('easy');
  });
});

// lib/algorithms/__tests__/seo-score.test.ts
describe('SEO Score Algorithm', () => {
  it('should score optimal title highly', async () => {
    const result = await analyzeTitleSEO(
      'How to Master YouTube SEO in 2026 - Complete Guide',
      'YouTube SEO'
    );
    expect(result.score).toBeGreaterThan(80);
  });

  it('should penalize very short titles', async () => {
    const result = await analyzeTitleSEO('Short', 'test');
    expect(result.score).toBeLessThan(50);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// app/api/keywords/__tests__/search.test.ts
describe('POST /api/keywords/search', () => {
  it('should return keyword data', async () => {
    const response = await fetch('/api/keywords/search', {
      method: 'POST',
      body: JSON.stringify({ keyword: 'youtube tips' }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.searchVolume).toBeGreaterThan(0);
    expect(data.competition).toBeGreaterThan(0);
  });

  it('should use cache on second request', async () => {
    // First request
    await fetch('/api/keywords/search', {
      method: 'POST',
      body: JSON.stringify({ keyword: 'test' }),
    });

    // Second request (should be faster due to cache)
    const start = Date.now();
    await fetch('/api/keywords/search', {
      method: 'POST',
      body: JSON.stringify({ keyword: 'test' }),
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // Should be instant from cache
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/keyword-research.spec.ts
test('Keyword research workflow', async ({ page }) => {
  await page.goto('/keywords');

  // Search for keyword
  await page.fill('input[placeholder*="keyword"]', 'youtube seo');
  await page.click('button:has-text("Search")');

  // Wait for results
  await page.waitForSelector('text=/Search Volume/i');

  // Verify metrics displayed
  const searchVolume = await page.textContent('[data-testid="search-volume"]');
  expect(parseInt(searchVolume)).toBeGreaterThan(0);

  // Save keyword
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=/Saved/i');
});
```

---

# Deployment Plan

## Pre-Deployment Checklist

### Environment Variables

```bash
# YouTube API
YOUTUBE_API_KEY=

# Redis (for caching)
REDIS_URL=

# Email (Resend)
RESEND_API_KEY=

# Inngest (background jobs)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Database
DATABASE_URL=
```

### Database Migration

```bash
# Run migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull

# Check migration status
npx prisma migrate status
```

### Background Jobs Setup

```bash
# Deploy Inngest functions
npx inngest-cli deploy

# Verify jobs are scheduled
npx inngest-cli jobs list
```

---

## Deployment Steps

### 1. Stage Environment (Testing)

```bash
# Deploy to staging
vercel --prod=false

# Run smoke tests
npm run test:e2e:staging

# Manual QA testing
```

### 2. Production Deployment

```bash
# Deploy to production
vercel --prod

# Monitor logs
vercel logs --follow

# Check background jobs
npx inngest-cli jobs status
```

### 3. Post-Deployment Verification

```bash
# Health check endpoints
curl https://app.viralsnipai.com/api/health

# Verify YouTube API connection
curl https://app.viralsnipai.com/api/keywords/test

# Check database connections
npx prisma studio
```

---

## Monitoring & Alerts

### Metrics to Track

1. **API Performance**
   - Response times (<500ms p95)
   - Error rates (<1%)
   - Rate limit hits

2. **Background Jobs**
   - Job success rate (>95%)
   - Job duration
   - Queue depth

3. **User Engagement**
   - Feature adoption rates
   - Daily active users
   - Retention rates

### Alert Configuration

```yaml
# alerts.yml
alerts:
  - name: High API Error Rate
    condition: error_rate > 5%
    notification: email, slack

  - name: Slow Keyword Search
    condition: response_time > 3s
    notification: slack

  - name: Background Job Failures
    condition: job_failure_rate > 10%
    notification: email, pagerduty
```

---

# Success Metrics

## Phase-Specific KPIs

### Phase 1: Keyword Research
- ✅ 50+ keyword searches per day per user
- ✅ <3 second average search time
- ✅ 30% of users save keywords
- ✅ 90%+ API success rate

### Phase 2: Competitor Tracking
- ✅ Average 2-3 competitors tracked per user
- ✅ Daily sync success rate >95%
- ✅ <24 hour data freshness
- ✅ 40% of users check competitors weekly

### Phase 3: SEO Score
- ✅ 80%+ of generated content analyzed
- ✅ <1 second score calculation
- ✅ 50% of users improve scores after recommendations
- ✅ Integration used in 3+ features

### Phase 4: Real-Time Analytics
- ✅ VPH updates hourly
- ✅ <5 minute alert delivery
- ✅ 60% email open rate for alerts
- ✅ 20% of videos tracked in real-time

---

## Overall Launch Success Criteria

### Adoption Metrics
- 70%+ of users try keyword research
- 50%+ of users track competitors
- 80%+ of generated titles/thumbnails get SEO scored
- 30%+ of users track video analytics

### Satisfaction Metrics
- NPS score >40
- Feature satisfaction >4/5 stars
- <5% churn rate in first month
- >60% feature retention (use weekly)

### Technical Metrics
- 99.5% uptime
- <500ms p95 response time
- <1% error rate
- Zero data loss incidents

---

# Timeline Summary

## 4-Phase Implementation

| Phase | Feature | Duration | Start | End |
|-------|---------|----------|-------|-----|
| 1 | Keyword Research | 5-6 days | Day 1 | Day 6 |
| 2 | Competitor Tracking | 4-5 days | Day 7 | Day 11 |
| 3 | SEO Score | 3-4 days | Day 12 | Day 15 |
| 4 | Real-Time Analytics | 5-6 days | Day 16 | Day 22 |

**Total Duration**: 18-22 working days (3-4 weeks)

---

## Resource Requirements

### Development Team
- 1-2 Full-stack developers
- 0.5 DevOps engineer (for deployment)
- 0.5 QA engineer (for testing)

### External Services
- YouTube Data API quota (~10,000 units/day)
- Redis instance (for caching)
- Email service (Resend)
- Background job service (Inngest)
- Analytics tracking (optional)

### Budget Estimates
- YouTube API: $0 (free tier: 10K units/day)
- Redis: $10-30/month (Upstash or Redis Cloud)
- Email: $10-20/month (Resend)
- Inngest: $0-20/month (free tier: 50K events)
- **Total**: ~$30-70/month operational costs

---

# Risk Mitigation

## Potential Risks & Solutions

### Risk 1: YouTube API Rate Limits
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - Implement aggressive caching (24hr for keywords)
  - Use Redis for request deduplication
  - Batch API requests where possible
  - Apply for quota increase if needed

### Risk 2: Data Accuracy
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Validate against multiple data sources
  - Show "last updated" timestamps
  - Allow manual refresh
  - Track accuracy metrics

### Risk 3: Background Job Failures
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Implement retry logic (3 attempts)
  - Dead letter queue for failed jobs
  - Monitoring and alerts
  - Manual trigger option

### Risk 4: Performance at Scale
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Database indexing on all query fields
  - Pagination for large lists
  - Query optimization
  - Vertical scaling plan

---

# Next Steps

## Immediate Actions (This Week)

1. **Get Approval** on implementation plan
2. **Set up YouTube API** credentials
3. **Configure Redis** instance
4. **Create Figma mockups** for UI (if needed)
5. **Kick off Phase 1** (Keyword Research)

## Post-Launch Actions (Week 5+)

1. **User feedback** collection
2. **Analytics review** and optimization
3. **Bug fixes** and improvements
4. **Feature iterations** based on usage data
5. **Chrome extension** planning

---

# Conclusion

This 4-phase plan provides a structured approach to implementing the four critical features needed to compete with VidIQ:

1. ✅ **Keyword Research** - Find searchable keywords
2. ✅ **Competitor Tracking** - Learn from competitors
3. ✅ **SEO Score** - Optimize video content
4. ✅ **Real-Time Analytics** - Track performance

**Total Timeline**: 3-4 weeks
**Total Cost**: ~$30-70/month operational
**Expected Impact**: 50-70% increase in user retention

With these features in place, ViralSnipAI will have:
- **Competitive parity** with VidIQ on research tools
- **Unique differentiation** with superior creation tools
- **Complete platform** from idea to analytics
- **Launch readiness** for public release

**Ready to start Phase 1? Let's build! 🚀**

---

**Document Prepared By**: Claude Code
**Last Updated**: February 4, 2026
**Status**: Awaiting Approval
