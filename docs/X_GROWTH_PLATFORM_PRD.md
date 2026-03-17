# X Growth Platform — Architecture & PRD

> **Status:** In execution (Phase-based rollout)
> **Date:** February 15, 2026
> **Scope:** Production-grade X Radar with clean workflow UX, robust scheduling, and scalable architecture

---

## 0. Baseline Architecture (Industry Grade)

### 0.1 System Style
- **Modular monolith** in Next.js (App Router) with strict module boundaries:
  - `Discover` (tracking + viral feed + engagement opportunities)
  - `Create` (drafts + templates + hooks + threads)
  - `Publish` (scheduler + best-time + calendar)
  - `Analytics` (growth + engagement + pattern intelligence)
- **Single source of truth:** PostgreSQL (Supabase) via Prisma.
- **Async workloads:** background job pipeline for fetch/analyze/post operations.

### 0.2 Runtime Components
- **Web/API:** `apps/web` (UI + API routes)
- **DB:** Supabase Postgres (Prisma migrations as source-of-truth schema)
- **Queue/Jobs:** scheduled workers for auto-post, sync, retries
- **Cache/Locks:** Redis-style semantics (or equivalent) for idempotency + cooldowns
- **Observability:** structured logs + latency metrics + job health counters

### 0.3 Engineering Standards
- API contracts validated with Zod.
- Idempotent write operations for scheduler/post actions.
- Cursor-based pagination for large feeds.
- Rate-limit + retry policy for X API interactions.
- Feature flags for phased rollout.
- p95 latency targets:
  - read APIs: `< 400ms`
  - heavy operations moved to async jobs

### 0.4 UX Baseline
- Workflow-first IA: `Overview -> Discover -> Create -> Publish -> Analytics`
- Fast, predictable interactions:
  - optimistic UX where safe
  - visible loading/success/error states
  - clean empty states with next-step CTA
- Mobile-first usability, no control overload.

---

## 1. Problem Statement

The X Radar feature has grown into a **1360-line monolithic page** (`x-radar/page.tsx`) that crams 10+ distinct features into a single scrollable view. This creates:

- **Confusing UX** — Users can't find features buried in the scroll
- **Overwhelming page** — Too many sections competing for attention
- **Maintenance nightmare** — 1360 lines with 15 state variables and 7 mutations in one file
- **No room to grow** — Adding Thread Writer, Scheduler, etc. would make it worse

---

## 2. Solution: Workflow-Based 4-Page Architecture

Instead of splitting into 7+ granular pages (which just moves the overwhelm to the nav bar), we group features by **user workflow stage**:

```
Discover  →  Create  →  Publish  →  Analyze
```

This maps directly to the screenshot's 3 columns (Grow Your Account / Create Content / Schedule & Analyze) and gives users a clear mental model.

### Feature Map

| # | Feature | Workflow Stage | Status | Target Page + Tab |
|---|---------|---------------|--------|-------------------|
| 1 | Track Niche Leaders | Discover | ✅ Built | `/x-radar/discover` → Tracker tab |
| 2 | Viral Feed + Analysis | Discover | ✅ Built | `/x-radar/discover` → Viral Feed tab |
| 3 | Engagement Finder | Discover | ✅ Built | `/x-radar/discover` → Engagement tab |
| 4 | AI Post Generator | Create | ✅ Built | `/x-radar/create` → Drafts tab |
| 5 | AI Tweet Predictor | Create | ✅ Built | `/x-radar/create` → (in draft card) |
| 6 | AI Rewriter | Create | ✅ Built | `/x-radar/create` → (in draft card) |
| 7 | Viral Templates | Create | ✅ Built | `/x-radar/create` → Templates tab |
| 8 | Personal Style Trainer | Create | ✅ Built | `/x-radar/create` → Style tab |
| 9 | Thread Writer | Create | ❌ Phase 2 | `/x-radar/create` → Threads tab |
| 10 | Hook Generator | Create | ❌ Phase 2 | `/x-radar/create` → Hooks tab |
| 11 | Smart Scheduler | Publish | ❌ Phase 2 | `/x-radar/publish` → Scheduler tab |
| 12 | Best Time Predictor | Publish | ❌ Phase 2 | `/x-radar/publish` → Best Times tab |
| 13 | Content Calendar | Publish | ❌ Phase 2 | `/x-radar/publish` → Calendar tab |
| 14 | Analytics Dashboard | Analyze | ✅ Built | `/x-radar/analytics` |
| 15 | AI Growth Coach | Overview | ✅ Built | `/x-radar` (hub) |
| 16 | Growth Stats | Overview | ✅ Built | `/x-radar` (hub) |

---

## 3. Target Route Structure

```
apps/web/app/(workspace)/x-radar/
├── layout.tsx              ← NEW: shared sub-nav + connection gate + context
├── page.tsx                ← REWRITE: hub/overview (~200 lines, down from 1360)
├── loading.tsx             ← MODIFY: hub skeleton
│
├── discover/               ← DISCOVER: Track + Viral Feed + Engagement
│   ├── page.tsx            ← Internal tabs: Tracker | Viral Feed | Engagement
│   └── loading.tsx
│
├── create/                 ← CREATE: Drafts + Templates + Style (+ Threads/Hooks Phase 2)
│   ├── page.tsx            ← Internal tabs: Drafts | Templates | Style
│   └── loading.tsx
│
├── publish/                ← PUBLISH (Phase 2): Scheduler + Best Time + Calendar
│   ├── page.tsx
│   └── loading.tsx
│
└── analytics/              ← ANALYZE: EXISTS (minor update)
    └── page.tsx
```

**Only 4 nav items** (+ hub): `Overview` · `Discover` · `Create` · `Publish` · `Analytics`

---

## 4. Architecture Design

### 4.1 Shared Layout (`x-radar/layout.tsx`)

Provides three things every sub-page needs:

**1. Connection Gate** — If no X account connected, shows ConnectXDialog CTA instead of children
**2. Sub-Navigation** — Clean 5-item horizontal nav (not 7+)
**3. Shared Context** — Account data, stats, tracked accounts via React Context

```
┌───────────────────────────────────────────────────────────┐
│  X Radar    @username  ·  12.5K followers          [⚙]    │
├───────────────────────────────────────────────────────────┤
│  Overview  │  Discover  │  Create  │  Publish  │ Analytics│
├───────────────────────────────────────────────────────────┤
│                                                           │
│  {children}  ← sub-page content                           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Sub-nav behavior:**
- Uses `pathname` matching (same pattern as existing `workspace-nav.tsx` line 103)
- 5 items fits cleanly on mobile without horizontal scroll
- "Publish" shows disabled with "Soon" badge until Phase 2
- Sticky below main header on scroll

**Scheduled draft polling** lives in the layout so it runs on ANY sub-page.

### 4.2 Shared Context (`components/x-radar/x-radar-context.tsx`)

```typescript
interface XRadarContextValue {
  // Account
  account: {
    id: string;
    xUsername: string;
    followerCount: number;
    profileImageUrl?: string;
  } | null;
  isConnected: boolean;

  // Stats
  stats: {
    followerGrowth7d: number;
    totalPostsLast7d: number;
    avgEngagementRate: string;
    actualTweetCount: number;
  };

  // Data (from GET /api/x-radar)
  trackedAccounts: TrackedAccount[];
  drafts: Draft[];
  scheduledDrafts: Draft[];
  postedDrafts: Draft[];
  viralTweets: ViralTweet[];

  // Utilities
  isLoading: boolean;
  invalidate: () => void;  // queryClient.invalidateQueries(["x-radar"])
}
```

- Data from existing `GET /api/x-radar` endpoint (NO API changes needed)
- Layout runs `useQuery(["x-radar"])` once with `staleTime: 30_000`
- Sub-pages consume via `useXRadar()` hook
- React Query cache prevents re-fetching on navigation

### 4.3 Data Flow

```
x-radar/layout.tsx
  useQuery(["x-radar"]) → GET /api/x-radar
  Provides: XRadarContext { account, stats, data, invalidate }
  Runs: scheduled draft polling (every 60s)
  Guards: connection state (shows ConnectXDialog if not connected)
  │
  ├── /page.tsx (hub/overview)
  │     Reads: stats, trackedAccounts.length, drafts.length from context
  │     Own components: GrowthStats, GrowthCoachCard, FeatureNavCards
  │
  ├── /discover/page.tsx
  │     Tab: Tracker → Reads context.trackedAccounts
  │     Tab: Viral Feed → Reads context.viralTweets
  │     Tab: Engagement → EngagementFinder (own query)
  │     Mutations: fetchViral, analyze, clearViral, deleteTracked
  │
  ├── /create/page.tsx
  │     Tab: Drafts → Reads context.drafts/scheduled/posted
  │     Tab: Templates → TemplateLibrary (own query)
  │     Tab: Style → StyleTrainerCard (own query)
  │     Mutations: generateDrafts
  │
  ├── /publish/page.tsx (Phase 2)
  │     Own queries for scheduler/calendar
  │
  └── /analytics/page.tsx (exists)
        Own query: ["x-radar-metrics"]
```

---

## 5. Page-by-Page Specification

### 5.1 Hub/Overview (`/x-radar`) — ~200 lines

The landing page when users enter X Radar. Quick glance at everything, with clear paths forward.

| Section | Component | Notes |
|---------|-----------|-------|
| Growth stats | `<GrowthStats>` | Existing, no changes. 4 stat cards |
| AI Growth Coach | `<GrowthCoachCard>` | Existing, self-contained |
| Workflow progress | `<WorkflowSteps>` | Extracted from current page.tsx |
| Feature navigation | `<FeatureNavCards>` | NEW: 4 cards linking to sub-pages |

**Feature cards (2-col mobile, 4-col desktop):**

| Card | Icon | Link | Subtitle | Badge |
|------|------|------|----------|-------|
| Discover | Target | /x-radar/discover | Track leaders & find viral patterns | {N} accounts |
| Create | Sparkles | /x-radar/create | Generate AI drafts & use templates | {N} drafts |
| Publish | CalendarClock | /x-radar/publish | Schedule & auto-post (Coming Soon) | Soon |
| Analytics | BarChart3 | /x-radar/analytics | Track growth & performance | — |

**State:** `showDisconnect` only
**Mutations:** None — read-only overview

### 5.2 Discover Page (`/x-radar/discover`) — ~600 lines

Groups all **discovery and research** features. Internal tabs powered by Radix UI Tabs.

**Tab 1: Tracker** (default)
- Tracked accounts grid with add/delete/select
- Batch fetch viral for selected accounts
- `AddTrackedAccountDialog`, `TrackedAccountDetailDialog`, delete confirmation
- State: `selectedTrackedIds`, `accountToDelete`, `addAccountOpen`, `selectedAccountId`
- Mutations: `deleteTrackedMutation`, `fetchViralMutation`

**Tab 2: Viral Feed**
- Filters: by account, search text, analyzed/unanalyzed, sort by score/likes/recent
- Analyze / Clear buttons
- List of `<ViralTweetCard>` components
- State: `selectedFeedAccountId`, `feedSearch`, `feedAnalysisFilter`, `feedSort`, `lastFetchSummary`
- Mutations: `analyzeMutation`, `clearViralMutation`

**Tab 3: Engagement**
- `<EngagementFinder />` component (already self-contained, own data fetching)
- No additional state needed at page level

**Components used:** `ViralTweetCard`, `EngagementFinder`, `AddTrackedAccountDialog`, `TrackedAccountDetailDialog`

### 5.3 Create Page (`/x-radar/create`) — ~400 lines

Groups all **content creation** features. Internal tabs.

**Tab 1: Drafts** (default)
- Generate Drafts button with rate limit indicator
- Sub-tabs or sections: Active | Scheduled | Posted
- List of `<TweetDraftCard>` components (each has predict/rewrite/post/schedule built-in)
- State: `draftFilter` (active/scheduled/posted/all)
- Mutations: `generateDraftsMutation`

**Tab 2: Templates**
- `<TemplateLibrary />` component (already self-contained, own data fetching)
- No additional state needed

**Tab 3: Style**
- `<StyleTrainerCard />` component (already self-contained, own data fetching)
- No additional state needed

**Phase 2 additions:**
- Tab 4: Threads → `<ThreadComposer />` (new component)
- Tab 5: Hooks → `<HookGenerator />` (new component)

### 5.4 Publish Page (`/x-radar/publish`) — Phase 2

**Tab 1: Scheduler** — Smart scheduling with AI best-time predictions
**Tab 2: Calendar** — Visual week/month view of scheduled posts
**Tab 3: Best Times** — Engagement heatmap by day/hour

For Phase 1: Page shows "Coming Soon" placeholder with description of upcoming features.

### 5.5 Analytics Page (`/x-radar/analytics`) — EXISTS, minor update

**Change:** Remove back-arrow button (lines 108-112) since layout provides navigation.
**Everything else stays as-is** (206 lines, own `["x-radar-metrics"]` query).

---

## 6. New Components to Create

| Component | Path | Purpose | Est. Lines |
|-----------|------|---------|------------|
| `x-radar-context.tsx` | `components/x-radar/` | Shared React context + provider + `useXRadar()` hook | ~80 |
| `x-radar-sub-nav.tsx` | `components/x-radar/` | 5-item horizontal nav bar for sub-pages | ~90 |
| `feature-nav-cards.tsx` | `components/x-radar/` | Hub page — 4 clickable workflow cards | ~100 |
| `workflow-steps.tsx` | `components/x-radar/` | Extracted workflow progress indicator | ~70 |

**Total new components: 4**

**Existing components requiring NO changes (11):**
`engagement-finder.tsx`, `template-library.tsx`, `growth-coach-card.tsx`, `growth-stats.tsx`, `style-trainer-dialog.tsx`, `viral-tweet-card.tsx`, `tweet-draft-card.tsx`, `analysis-badge.tsx`, `connect-x-dialog.tsx`, `add-tracked-account-dialog.tsx`, `tracked-account-detail-dialog.tsx`

---

## 7. What Does NOT Change

- **API routes** — All 15+ endpoints stay exactly as-is
- **Prisma schema** — No model changes for Phase 1
- **Existing components** — All 11 component files work unchanged
- **Workspace nav** — Already handles sub-routes via `pathname.startsWith()`
- **Query keys** — All React Query keys remain the same
- **X API integration** — No changes to `lib/integrations/x-api.ts`
- **AI modules** — No changes to analyzer, style trainer, growth coach

---

## 8. Why 4 Pages > 7 Pages

| Concern | 7-Page Approach | 4-Page Approach (chosen) |
|---------|----------------|-------------------------|
| Nav items | 7+ tabs — overwhelming, defeats purpose | 5 tabs — clean, fits mobile |
| Context switching | Many clicks between related features | Related features grouped together |
| Workflow alignment | Fragments the Discover → Create → Publish → Analyze journey | Maps 1:1 to user workflow |
| Wrapper pages | Templates + Engagement are 50-line wrappers (extra click, no value) | Embedded as tabs — zero wasted pages |
| Future scalability | Each new feature = new tab in nav (nav grows forever) | New features = new tab inside existing page (nav stays stable) |
| Mobile UX | 7 items need horizontal scroll | 5 items fit naturally |
| Deep linking | More URLs but fragmented experience | `/x-radar/create?tab=templates` covers it |

---

## 9. Implementation Plan

### Phase 1: Restructure Existing Code (no new features, no API changes)

**Step 1: Create shared infrastructure**
- [ ] `components/x-radar/x-radar-context.tsx` — context + provider + `useXRadar()` hook
- [ ] `components/x-radar/x-radar-sub-nav.tsx` — 5-item horizontal nav
- [ ] `app/(workspace)/x-radar/layout.tsx` — shared layout: connection gate + sub-nav + context + polling
- [ ] `components/x-radar/workflow-steps.tsx` — extract from page.tsx

**Step 2: Create sub-pages (extract from monolithic page)**
- [ ] `x-radar/discover/page.tsx` + `loading.tsx` — 3 tabs: Tracker, Viral Feed, Engagement
- [ ] `x-radar/create/page.tsx` + `loading.tsx` — 3 tabs: Drafts, Templates, Style

**Step 3: Rewrite hub + add placeholder + cleanup**
- [ ] Rewrite `x-radar/page.tsx` to hub overview (~200 lines)
- [ ] Create `components/x-radar/feature-nav-cards.tsx`
- [ ] Create `x-radar/publish/page.tsx` — "Coming Soon" placeholder
- [ ] Update `x-radar/loading.tsx` for hub skeleton
- [ ] Remove back-arrow from `x-radar/analytics/page.tsx`
- [ ] Delete dead code from old monolithic page
- [ ] Build verify: `pnpm --filter web build`

### Phase 1.5: KPI Completion (in progress)
- [x] Add **Avg Impressions per post** metric to overview stats (API + context + UI)
- [ ] Add impressions trend sparkline + period filter (7d / 30d)
- [ ] Normalize engagement math across all cards and analytics tables

### Phase 2: Build New Features (after Phase 1)

**Step 4: Hook Generator**
- [ ] `POST /api/x-radar/hooks/generate` — AI hook generation
- [ ] `components/x-radar/hook-generator.tsx` — UI
- [ ] Add as new tab in `/x-radar/create/page.tsx`

**Step 5: Thread Writer**
- [ ] Schema: Add `threadOrder`/`threadGroupId` to TweetDraft
- [ ] `POST /api/x-radar/threads/generate` — AI thread generation
- [ ] `POST /api/x-radar/threads/post` — post thread via X API (chained replies)
- [ ] `components/x-radar/thread-composer.tsx` — multi-tweet editor
- [ ] Add as new tab in `/x-radar/create/page.tsx`

**Step 6: Smart Scheduler + Best Time + Content Calendar**
- [ ] `lib/ai/post-timing.ts` — analyze best posting times from history
- [ ] `GET /api/x-radar/scheduler/best-times` — AI timing analysis
- [ ] `components/x-radar/best-time-chart.tsx` — day/hour engagement heatmap
- [ ] `components/x-radar/scheduler-calendar.tsx` — week/month view
- [ ] Replace "Coming Soon" in `/x-radar/publish/page.tsx` with real content

### Phase 3: Production Hardening
- [x] Background scheduler reliability (cron + retries + per-user fan-out processing)
- [x] Job observability panel (success/failure counts, last run, error reasons)
- [x] Backfill + repair workers for missing tweet metrics
- [ ] Load test on multi-account setup (10+ tracked accounts) — script added, execution pending

### Phase 4: UX & Scale Enhancements
- [ ] Content Calendar V2 (true week/month grid + drag-drop reschedule)
- [ ] Engagement Finder V2 (ranking, saved opportunities, status workflow)
- [ ] Viral templates expansion to 100+ curated templates
- [ ] Unified platform switch shell (X / YouTube) with shared visual pattern

---

## 10. Files Summary (Phase 1)

| File | Action |
|------|--------|
| `app/(workspace)/x-radar/layout.tsx` | CREATE |
| `app/(workspace)/x-radar/page.tsx` | REWRITE (1360 → ~200 lines) |
| `app/(workspace)/x-radar/loading.tsx` | MODIFY |
| `app/(workspace)/x-radar/discover/page.tsx` | CREATE |
| `app/(workspace)/x-radar/discover/loading.tsx` | CREATE |
| `app/(workspace)/x-radar/create/page.tsx` | CREATE |
| `app/(workspace)/x-radar/create/loading.tsx` | CREATE |
| `app/(workspace)/x-radar/publish/page.tsx` | CREATE (placeholder) |
| `app/(workspace)/x-radar/publish/loading.tsx` | CREATE |
| `app/(workspace)/x-radar/analytics/page.tsx` | MODIFY (remove back-arrow) |
| `components/x-radar/x-radar-context.tsx` | CREATE |
| `components/x-radar/x-radar-sub-nav.tsx` | CREATE |
| `components/x-radar/feature-nav-cards.tsx` | CREATE |
| `components/x-radar/workflow-steps.tsx` | CREATE |

**Total: 10 new files, 3 modified, 0 API changes, 0 schema changes**

---

## 11. Verification Plan

1. `pnpm --filter web build` — zero errors
2. `/x-radar` — hub with stats, growth coach, workflow steps, 4 feature cards
3. `/x-radar/discover` — 3 tabs work: Tracker (add/delete/fetch), Viral Feed (filter/analyze), Engagement (find/reply)
4. `/x-radar/create` — 3 tabs work: Drafts (generate/edit/predict/rewrite/schedule/post), Templates (search/filter/remix), Style (train/view)
5. `/x-radar/publish` — shows "Coming Soon" placeholder
6. `/x-radar/analytics` — charts load, no back-arrow
7. Scheduled draft polling works from ANY sub-page
8. Mobile: 5-item nav fits without scroll, pages stack properly
9. Disconnect/reconnect flow works from layout
10. Sub-nav highlights correct active page

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Query invalidation breaks when mutations move to sub-pages | Context provides shared `invalidate()` that all sub-pages call |
| Scheduled polling only on one page | Polling moves to layout — runs on every sub-page |
| TweetDraftCard inline mutations break | No issue — card is self-contained, uses own endpoints |
| Re-fetching on every navigation | React Query `staleTime: 30_000` prevents this |
| Internal tabs lose state on navigation | Use URL search params (`?tab=templates`) to persist active tab |
| Discover page too large (3 tabs) | Each tab renders lazily — only active tab loads its content |

---

## 13. Key Technical Files Reference

| Purpose | Path |
|---------|------|
| Current monolith (to decompose) | `apps/web/app/(workspace)/x-radar/page.tsx` |
| Analytics page (minor edit) | `apps/web/app/(workspace)/x-radar/analytics/page.tsx` |
| Workspace nav (pathname pattern ref) | `apps/web/components/layout/workspace-nav.tsx` |
| Existing X Radar components (11) | `apps/web/components/x-radar/` |
| Dashboard API (shared data) | `apps/web/app/api/x-radar/route.ts` |
| X API client | `apps/web/lib/integrations/x-api.ts` |
| AI analyzer | `apps/web/lib/ai/x-radar-analyzer.ts` |
| Types | `apps/web/lib/types/x-radar.ts` |
| Constants | `apps/web/lib/constants/x-radar.ts` |
| Prisma schema | `apps/web/prisma/schema.prisma` |
