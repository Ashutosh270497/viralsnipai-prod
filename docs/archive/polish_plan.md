# SnipRadar Polish Plan

Date: 2026-03-14
Owner: Product / Engineering
Scope: SnipRadar X ecosystem launch readiness
Status: Wave 0 completed. Execution locked against current codebase audit.

## Goal

Bring SnipRadar to launch-ready quality for the X ecosystem by closing the most important product, activation, retention, and operational gaps before public rollout.

This plan builds on the current feature state in the codebase and the competitive gap analysis already completed.

## Launch Thesis

SnipRadar is already strong in:
- live viral radar
- research inbox + browser extension
- AI-assisted creation
- scheduling
- analytics
- profile audit
- relationship tracking

The main remaining launch risk is not raw feature count. It is:
- weak first-run activation
- missing ROI feature depth
- a few visible placeholder / partial surfaces
- reliability and ops hardening

## Current Product Assessment

### Strong and Launch-Worthy Now

- Discover / X Radar
- AI drafting, templates, hooks, and thread generation
- Scheduler and calendar
- Analytics
- Research inbox and research copilot
- Extension capture and reply assist foundations
- Relationship CRM
- Profile audit and overview insights

### Built but Not Fully Launch-Ready

- Growth Planner
  - scaffold exists, but it is not a real personalized planner yet
- WinnerLoop / evergreen automation
  - partial automation exists, but the positioning is stronger than the actual shipped depth
- Onboarding
  - current onboarding is still generic and not SnipRadar-first
- New-user Discover experience
  - new users can still hit weak or empty states without seeded data
- Thread Writer UX
  - generation exists, but Typefully-class preview polish is still missing

### Missing or Critical Gaps

- Auto-DM automation
- niche-based seeded tracked accounts
- Discover search and filters over stored viral tweets
- launch-grade operational diagnostics for extension, scheduler, X auth, billing, and automations

## Competitive Positioning Summary

### Where SnipRadar Is Already Ahead

- Live viral radar is more timely than static viral libraries
- Research Inbox + browser extension is a real differentiator
- Inline reply assist on X reduces workflow friction more than most competitors

### Where SnipRadar Is On Par

- AI post generation
- hooks and templates
- scheduling
- analytics
- style / voice shaping
- relationship CRM

### Where SnipRadar Is Behind

- Auto-DM as a direct ROI loop
- first-5-minute activation
- searchable viral library UX
- Growth Planner completeness
- thread composer polish

## Launch Principles

- Do not launch visible placeholder product surfaces
- Do not let new users hit empty screens without a guided next action
- Ship one direct ROI feature before launch
- Reliability matters more than adding one more AI tool
- Make onboarding and first value measurable

## Priority Tiers

### P0 — Block Launch Without These

- Fix browser extension text injection reliability on X compose surfaces
- Build Auto-DM MVP
- Complete Growth Planner with real personalized generation
- Ensure Discover is populated for new users on day 1
- Replace generic onboarding with SnipRadar-specific activation

### P1 — Should Ship Before Launch

- Add Discover search + filters
- Add Thread Writer live preview and publishing polish
- Complete or narrow WinnerLoop claims to match actual product behavior
- Add guided empty states and first-run CTAs across all major SnipRadar surfaces
- Standardize remaining SnipRadar AI flows on OpenRouter where still inconsistent

### P2 — Launch Hardening / Post-Blocker

- Billing production validation
- X auth / token refresh drills
- Admin diagnostics and failure logs
- Mobile degradation cleanup
- pricing / packaging cleanup for the X ecosystem

## Locked Execution Order

This is the canonical execution order for launch work. Execution should follow this wave order unless the plan document is explicitly updated.

### Wave Tracker

| Wave | Name | Primary Workstreams | Status |
|---|---|---|---|
| 0 | Audit Freeze | scope lock, baseline capture, execution board | complete |
| 1 | Activation Core | onboarding, niche selection, seeded Discover, first-run CTAs | complete |
| 2 | Revenue Hook MVP | Auto-DM MVP | complete |
| 3 | Trust Gaps | Growth Planner completion, extension reliability, WinnerLoop verification | partial |
| 4 | Retention UX | Discover search/filters, Thread Writer polish, Research onboarding improvements | complete |
| 5 | Launch Hardening | billing validation, X auth drills, diagnostics, AI routing consistency | partial |
| 6 | Mobile and Packaging Polish | responsive cleanup, pricing and packaging polish | partial |

### Execution Rule

- Execute wave by wave, not by randomly picking numbered workstreams
- Numbered workstreams are reference buckets, not the execution sequence by themselves
- Do not start a later wave while an earlier wave still has unresolved blockers, unless the plan doc is explicitly updated

## Workstreams

### 1. Activation and First-Run Experience

Objective:
- get a new user from signup to visible value in under 5 minutes

Work:
- create a SnipRadar-specific onboarding flow
- ask for niche early
- connect X account immediately
- seed tracked accounts based on niche
- show guided CTAs in Discover, Create, Research, and Publish

Acceptance criteria:
- a fresh user can connect X, see a non-empty Discover feed, generate a draft, and reach scheduling in one session
- no major SnipRadar page is blank without a clear next action

### 2. Auto-DM MVP

Objective:
- add the highest-retention, direct-ROI feature missing from the product

Scope:
- trigger when someone replies to a selected tweet
- optional keyword filter
- send templated DM
- enforce rate limits and duplicate-send protection
- surface send logs and failures in UI

Acceptance criteria:
- user can configure a DM automation and see successful sends
- failures and rate-limit conditions are visible
- duplicate sends are prevented

### 3. Growth Planner Completion

Objective:
- replace shell content with real personalized planning

Scope:
- create `POST /api/snipradar/growth`
- use user niche, follower count, cadence, analytics summary, and best content signals
- return a three-phase plan with weekly tasks and output goals

Acceptance criteria:
- planner output is unique per user
- planner no longer shows hardcoded placeholder content
- user receives concrete weekly actions tied to account state

### 4. Discover and Viral Library Upgrade

Objective:
- make Discover useful on day 1 and increasingly valuable over time

Scope:
- seed high-signal accounts by niche
- add search over stored `ViralTweet` records
- add filters for keyword, likes, reposts, date range, hook type, and format

Acceptance criteria:
- Discover is useful immediately for fresh accounts
- users can search and filter historical viral examples instead of only browsing live feed

### 5. Extension Reliability

Objective:
- make the main differentiator dependable before launch

Scope:
- fully resolve Lexical / X compose text injection issues
- regression-test reply assist and remix flows
- verify save-to-inbox and source capture success paths

Acceptance criteria:
- generated reply text reliably lands in the X composer
- capture and inbox save paths work on supported X surfaces
- failures degrade gracefully and visibly

### 6. Thread Writer Polish

Objective:
- move from functional generation to best-in-class composition UX

Scope:
- add live preview panel
- show numbered tweet order
- show per-tweet character counts
- improve handoff into scheduling / draft editing

Acceptance criteria:
- users can confidently preview thread output before publishing
- thread composition feels polished enough to replace native X drafting

### 7. WinnerLoop and Evergreen Automation

Objective:
- make evergreen automation honest and useful

Scope:
- verify current repost / derivative automation depth
- either complete missing evergreen queue behavior or narrow UI claims
- add clear automation audit trail

Acceptance criteria:
- users understand exactly what WinnerLoop will do
- scheduled evergreen behavior is deterministic and observable

### 8. AI Routing and Cost Consistency

Objective:
- make SnipRadar AI routing consistent, cost-controlled, and launch-safe

Scope:
- continue standardizing SnipRadar AI flows on OpenRouter
- remove unnecessary direct-provider fallbacks where product policy requires OpenRouter
- keep extension reply, remix, and analysis on cost-appropriate models

Acceptance criteria:
- SnipRadar AI paths are intentionally routed
- model usage is documented
- extension AI costs stay aligned with usage economics

### 9. Billing and Operational Hardening

Objective:
- ensure the product can survive real paid usage after launch

Scope:
- validate live Razorpay checkout and cancellation flows
- verify webhook replay handling
- test pending-state refresh and subscription reconciliation
- add visibility for scheduler failures, billing failures, X auth failures, and automation failures

Acceptance criteria:
- billing passes live test checklist
- critical background failures are visible to the team
- recovery paths are documented

### 10. Mobile and Responsive Degradation

Objective:
- avoid broken experiences on unsupported layouts

Scope:
- audit SnipRadar Create, Publish, Inbox, and other dense screens on mobile
- fix key breakages or add explicit desktop-preferred messaging

Acceptance criteria:
- no major SnipRadar page is visibly broken on mobile
- unsupported experiences fail gracefully

## Execution Plan

### Wave 0 — Audit Freeze

Duration:
- 0.5 day

Owner:
- engineering lead

Tasks:
- freeze launch scope
- capture current behavior for onboarding, discover, create, publish, extension, and billing
- log all known gaps into one execution board

Exit criteria:
- every launch item has a status, owner, and target wave

Completion notes:
- completed in docs on 2026-03-22
- launch scope is now frozen against the audited codebase rather than the optimistic tracker state
- current implementation baseline captured in `docs/snipradar_wave0_baseline.md`
- remaining launch blockers tracked in `docs/snipradar_launch_execution_board.md`
- deployment checklist is now explicitly gated on closing remaining `partial` launch items before production rollout

### Wave 1 — Activation Core

Duration:
- days 1 to 3

Owner:
- full-stack engineering

Tasks:
- SnipRadar-specific onboarding
- niche selection and account seeding
- first-run CTAs and empty states
- non-empty Discover after X connect

Exit criteria:
- fresh user gets visible value in under 5 minutes

Completion notes:
- completed in code on 2026-03-14
- SnipRadar-specific onboarding now routes new users into the X workflow
- niche-aware starter accounts seed automatically after X connect
- Discover now supports first-run activation guidance and seeded-feed kickoff
- Overview now surfaces a concrete first-session launch path
- Research now includes low-data corpus priming guidance and next-step CTAs

### Wave 2 — Revenue Hook MVP

Duration:
- days 3 to 5

Owner:
- backend / full-stack engineering

Tasks:
- Auto-DM trigger builder
- reply-based trigger execution
- DM templates
- logs and guardrails

Exit criteria:
- Auto-DM works end to end for basic use cases

Completion notes:
- completed in code on 2026-03-14
- Publish now includes an Auto-DM panel with creation, pause/resume, run-now, and delivery logs
- Auto-DM automations persist in dedicated SnipRadar tables with duplicate-send protection
- the scheduler execution path now also processes active Auto-DM automations
- X OAuth scope now requests DM permissions for new/reconnected accounts
- live production-style validation is still required for one real X reconnect and DM send

### Wave 3 — Trust Gaps

Duration:
- days 5 to 6

Owner:
- full-stack engineering

Tasks:
- real Growth Planner backend
- extension text injection reliability
- WinnerLoop verification and completion / narrowing

Exit criteria:
- no obvious placeholder or unreliable differentiator remains in core product surfaces

### Wave 4 — Retention UX

Duration:
- days 6 to 8

Owner:
- frontend engineering

Tasks:
- Discover search + filters
- Thread Writer live preview
- Research onboarding improvements

Exit criteria:
- key daily-use surfaces are polished enough for repeat usage

### Wave 5 — Launch Hardening

Duration:
- days 8 to 10

Owner:
- engineering + QA

Tasks:
- billing validation
- X auth and refresh drills
- scheduler and automation diagnostics
- OpenRouter consistency pass

Exit criteria:
- critical workflows are observable and recoverable

### Wave 6 — Mobile and Packaging Polish

Duration:
- days 10 to 11

Owner:
- frontend + product

Tasks:
- responsive degradation cleanup
- pricing and packaging polish
- final launch copy review

Exit criteria:
- the launch surface is coherent across devices and billing pages

## Critical Path

- SnipRadar onboarding
- niche-seeded Discover
- Auto-DM MVP
- Growth Planner completion
- extension reliability
- billing and ops hardening

If any one of these slips materially, launch quality drops sharply.

## Go / No-Go Launch Gates

- new user reaches first value in under 5 minutes
- Discover is not empty after X connect
- browser extension reply assist works reliably on supported X surfaces
- user can generate, edit, schedule, and publish in one session
- Auto-DM MVP works under realistic rate limits
- Growth Planner is personalized and real
- billing upgrade, cancellation, and webhook flows pass live validation
- critical failures are visible to the team through logs or diagnostics

## Recommended Immediate Execution Order

1. onboarding + seeded Discover
2. Auto-DM MVP
3. Growth Planner backend
4. extension reliability pass
5. Discover search + filters
6. WinnerLoop completion / narrowing
7. Thread Writer live preview
8. billing and operational hardening
9. mobile degradation cleanup

## Risks

- shipping with a weak first-run experience will hide real product strengths
- shipping without Auto-DM weakens the retention and ROI story against incumbents
- launching with brittle extension behavior damages trust in the main differentiator
- launching placeholder planner or automation surfaces lowers perceived product maturity
- missing observability will slow post-launch debugging and retention recovery

## Notes

- This document is intentionally execution-focused, not a PRD
- If scope must be cut, cut P2 before P1 and cut P1 before P0
- The product is feature-rich enough now that launch quality depends more on activation and reliability than on adding more surface area

---

# SnipRadar Assistant — RAG Chatbot Feature Plan
**Added:** 2026-03-14
**Type:** New feature execution plan

## What It Is

A conversational AI assistant embedded as the default landing screen for the SnipRadar X ecosystem. When a user logs into the X ecosystem, they land on an assistant chat interface (modeled after Claude.ai home screen) that:

- Greets them by name
- Shows 5 clickable suggestion chips about core SnipRadar features
- Answers any platform question using a RAG knowledge base
- Provides navigation deep links ("Go to Create → Drafts tab")
- Persists conversation history per session with a sidebar

## Why It Matters

- Solves the #1 churn reason: new users who don't know what to do first (40–50% of churn)
- No competitor (TweetHunter, Hypefury, Typefully, Blackmagic) has this
- Reduces support burden as the platform grows
- Higher feature discovery → higher retention

## Design

Modeled on Claude.ai home screen:
- **Empty state**: centered greeting + large input box + 5 suggestion chips below
- **Active chat**: messages scrollable above, input pinned to bottom
- **Left panel**: conversation history sidebar (recent sessions + New Chat button)
- **Colors**: clean white/light-gray, purple accent matching SnipRadar brand
- **Icons**: lucide-react only (Sparkles for nav item, feature-specific for chips)

## Architecture

| Layer | Choice | Reason |
|---|---|---|
| Vector store | Supabase pgvector (existing DB) | No new service; already used for research embeddings |
| Embedding model | `openai/text-embedding-3-small` via OpenRouter | Already in OPENROUTER_MODELS; $0.02/1M tokens |
| Chat model | `google/gemini-2.5-flash` via OpenRouter | Fast streaming, 1M context, $0.30/$2.50 per 1M |
| Streaming | SSE via Next.js route handler | Real-time typewriter effect for chat feel |
| Chunk strategy | ~500 tokens split on `##` headers, 50-token overlap | One chunk per feature sub-section |
| Retrieval | Top-5 cosine similarity, threshold 0.75 | Standard RAG; grounded, precise answers |
| Sessions | DB via Prisma (PostgreSQL) | Persistent history across devices |
| Default route | `/snipradar` → redirect `/snipradar/assistant` | New user lands on assistant first |

## Database Schema Additions

Add to `apps/web/prisma/schema.prisma`:

```prisma
model SnipRadarKbChunk {
  id          String    @id @default(uuid())
  content     String
  embedding   Unsupported("vector(1536)")?
  featureName String    @db.VarChar(100)
  section     String    @db.VarChar(100)
  chunkIndex  Int
  metadata    Json      @default("{}")       // navPath, relatedFeatures
  docVersion  String    @db.VarChar(20)      // "1.0.0" — bump to re-ingest
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([featureName])
  @@map("snipradar_kb_chunks")
}

model SnipRadarChatSession {
  id            String                  @id @default(uuid())
  userId        String
  title         String?                 @db.VarChar(200)
  lastMessageAt DateTime?
  createdAt     DateTime                @default(now())
  user          User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages      SnipRadarChatMessage[]
  @@index([userId])
  @@map("snipradar_chat_sessions")
}

model SnipRadarChatMessage {
  id         String               @id @default(uuid())
  sessionId  String
  role       String               @db.VarChar(20)   // "user" | "assistant"
  content    String
  sources    Json                 @default("[]")    // [{featureName, section}]
  createdAt  DateTime             @default(now())
  session    SnipRadarChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
  @@map("snipradar_chat_messages")
}
```

Add to User model: `snipRadarChatSessions SnipRadarChatSession[]`

**Supabase SQL to run manually** (before `prisma db push`):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- Run after prisma db push to add HNSW index:
CREATE INDEX snipradar_kb_chunks_embedding_idx
  ON snipradar_kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- Similarity search function:
CREATE OR REPLACE FUNCTION match_snipradar_kb_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.75
)
RETURNS TABLE (id TEXT, content TEXT, feature_name TEXT, section TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT id::TEXT, content, feature_name, section, metadata,
         1 - (embedding <=> query_embedding) AS similarity
  FROM snipradar_kb_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## OpenRouter Model Key

Add to `OPENROUTER_MODELS` in `apps/web/lib/openrouter-client.ts`:
```typescript
snipradarAssistant:
  process.env.OPENROUTER_SNIPRADAR_ASSISTANT_MODEL ?? 'google/gemini-2.5-flash',
```

Add to `.env.example` and `.env.local`:
```bash
OPENROUTER_SNIPRADAR_ASSISTANT_MODEL="google/gemini-2.5-flash"
```

## System Prompt

```
You are the SnipRadar Assistant — an expert guide for the SnipRadar X growth platform.

You help users understand features, navigate the platform, and improve their X growth workflow.

PLATFORM KNOWLEDGE:
---
{top_5_retrieved_chunks}
---

RESPONSE RULES:
- Answer only from the knowledge base above
- Keep answers concise and action-oriented (2–4 sentences for simple questions)
- Always include the navigation path: e.g. "Go to Create → Drafts tab"
- Use markdown: bold for feature names, bullet lists for steps
- Never invent features that don't exist
- Pricing questions → "Go to Settings → Billing"
- Tone: friendly, direct, like a knowledgeable teammate
```

## Suggestion Chips (5 default questions)

```
1. "How does Viral Radar work?"       → icon: Radar
2. "Schedule my first tweet"          → icon: Calendar
3. "Set up Reply Assist"              → icon: MessageCircle
4. "Understand my analytics"          → icon: BarChart2
5. "What's the Research Inbox?"       → icon: Inbox
```

## Knowledge Base Document Structure

File: `apps/web/lib/snipradar/knowledge-base.md`

23 feature sections, each with:
- What it is (1 sentence)
- Why use it
- Navigation path (exact route)
- Step-by-step how-to
- Pro tips
- Common questions

Features covered:
1. SnipRadar Assistant (self-referential)
2. Overview Dashboard
3. Viral Discover Feed
4. Research Inbox
5. Browser Extension — Install & Setup
6. Browser Extension — Reply Assist
7. Browser Extension — Remix
8. Browser Extension — Track Author
9. Relationships CRM
10. Create — Draft Composer
11. Create — Thread Builder
12. Create — Hook Generator
13. Create — Templates
14. Create — Research Copilot
15. Create — Predictor
16. Publish — Scheduler
17. Publish — Best Times
18. Publish — Automations (Auto-DM, WinnerLoop)
19. Analytics Dashboard
20. Style Trainer
21. Growth Planner
22. Billing & Plan Management
23. Getting Started — First 5 Minutes Guide

Estimated total: ~10,000 tokens → ~22 chunks → trivially small for pgvector.

## New Files Required

```
apps/web/prisma/schema.prisma                                      ← ADD 3 models + User relation
apps/web/lib/snipradar/assistant-kb.ts                            ← Ingestion + retrieval
apps/web/lib/snipradar/assistant-chat.ts                          ← Session + message service
apps/web/lib/snipradar/assistant-suggestions.ts                   ← 5 suggestion chips config
apps/web/lib/snipradar/knowledge-base.md                          ← RAG source document
apps/web/app/api/snipradar/assistant/chat/route.ts                ← Chat endpoint (+ SSE streaming)
apps/web/app/api/snipradar/assistant/sessions/route.ts            ← Sessions list
apps/web/app/api/snipradar/assistant/sessions/[sessionId]/route.ts ← Session detail
apps/web/app/api/snipradar/assistant/ingest/route.ts              ← Admin re-ingest
apps/web/app/(workspace)/snipradar/assistant/page.tsx             ← Page route
apps/web/components/snipradar/assistant/assistant-chat.tsx        ← Main chat component
apps/web/components/snipradar/assistant/assistant-sessions-sidebar.tsx
apps/web/components/snipradar/assistant/assistant-message-bubble.tsx
apps/web/components/snipradar/assistant/assistant-suggestion-chips.tsx
apps/web/components/snipradar/assistant/assistant-input.tsx
apps/web/components/ui/scroll-area.tsx                            ← Add shadcn component
```

## Modified Files

```
apps/web/lib/openrouter-client.ts              ← Add snipradarAssistant model key
apps/web/app/(workspace)/snipradar/page.tsx    ← Redirect to /snipradar/assistant
apps/web/components/layout/workspace-nav.tsx   ← Add "Assistant" as first X nav item
apps/web/.env.local + .env.example             ← Add OPENROUTER_SNIPRADAR_ASSISTANT_MODEL
```

## Implementation Phases

### Phase 1 — Foundation (Days 1–2)
Goal: RAG pipeline working end-to-end.

- [ ] Update Prisma schema (3 models)
- [ ] Run `prisma db push` + Supabase SQL (pgvector extension + HNSW index + match function)
- [ ] Add `snipradarAssistant` model key to openrouter-client
- [ ] Write `assistant-kb.ts` (chunk + embed + retrieve)
- [ ] Write the knowledge base markdown document (`knowledge-base.md`)
- [ ] Write `ingest/route.ts` admin endpoint
- [ ] Run first ingestion — verify 20+ chunks stored with embeddings in DB

Exit: `POST /api/snipradar/assistant/ingest` returns `{ chunksIngested: 22 }`

### Phase 2 — Chat API (Days 2–3)
Goal: API answers questions with KB-grounded responses.

- [ ] Write `assistant-chat.ts` (session + message CRUD)
- [ ] Write `chat/route.ts` (embed query → retrieve → build prompt → call Gemini → save + return)
- [ ] Write `sessions/route.ts` + `sessions/[sessionId]/route.ts`
- [ ] Write `assistant-suggestions.ts` (5 chips)
- [ ] Add rate limiting (20 req/min per user)

Exit: `POST /api/snipradar/assistant/chat` with `{"message":"How does Viral Radar work?"}` returns grounded answer with sources.

### Phase 3 — UI Shell (Days 3–5)
Goal: Chat UI renders, chips work, first response appears.

- [ ] Create `apps/web/app/(workspace)/snipradar/assistant/page.tsx`
- [ ] Build all 5 assistant components (chat, sidebar, bubble, chips, input)
- [ ] Add `react-markdown` dependency if not present
- [ ] Wire empty state → active chat state transition on first message
- [ ] Update default redirect `snipradar/page.tsx` → `/snipradar/assistant`
- [ ] Add "Assistant" as first nav item in workspace-nav with `Sparkles` icon + "New" badge

Exit: Landing on `/snipradar` shows welcome screen. Clicking a chip sends question. Answer renders.

### Phase 4 — History + Sessions (Day 5)
Goal: Chat history persists and sidebar works.

- [ ] Wire sidebar to `GET /api/snipradar/assistant/sessions`
- [ ] Wire session reload to `GET /api/snipradar/assistant/sessions/[sessionId]`
- [ ] Auto-generate session title from first user message (first 40 chars)
- [ ] New Chat button creates fresh session

Exit: Refresh page → session in sidebar → click to reopen → full history restores.

### Phase 5 — Streaming + Polish (Days 6–7)
Goal: Responses stream in real time. UI is Claude.ai quality.

- [ ] Switch chat route to SSE streaming (ReadableStream)
- [ ] Update frontend to consume token stream progressively
- [ ] Add "thinking" animated dot indicator
- [ ] Add copy-to-clipboard on assistant messages
- [ ] Add 👍/👎 feedback (store in message.metadata)
- [ ] Add `scroll-area.tsx` shadcn component for message list
- [ ] Mobile: sidebar collapses to bottom sheet on < 768px

Exit: Responses stream token-by-token. Fully functional on mobile.

### Phase 6 — KB Completeness (Ongoing)
Goal: All 23 sections documented; 95%+ of common questions answered accurately.

- [ ] Write all 23 KB sections
- [ ] Test 20 representative questions against live assistant
- [ ] Identify gaps → fill KB → re-ingest
- [ ] Add admin script: `scripts/ingest-kb.ts` (run via `pnpm ts-node scripts/ingest-kb.ts`)

Ongoing: update KB when features change; bump `docVersion` to trigger re-ingestion.

## Cost Estimate

At 1,000 DAU × 3 questions/user/day:

| Operation | Daily Volume | Model | Daily Cost |
|---|---|---|---|
| Embed queries | 3,000 | text-embedding-3-small | ~$0.001 |
| Chat completions (~400 avg tokens) | 3,000 | gemini-2.5-flash | ~$0.036 |
| **Total** | | | **~$0.04/day (~$1.20/month)** |

Effectively free at current scale.

## Billing Gate

- Free plan: 10 assistant questions/day
- Starter+: unlimited
- Gate via `usageTracking` table (same pattern as other SnipRadar features)

## Decisions (Locked 2026-03-14)

1. **Default route**: `/snipradar` always lands on `/snipradar/assistant` for ALL users — no conditional logic based on account age.

2. **KB maintenance ownership**: Ashutosh (product owner) updates `knowledge-base.md` whenever a new feature ships or an existing feature changes. Bump `docVersion` and re-run ingest.

3. **Navigation links**: When assistant references a feature, it navigates the user directly to that feature tab in the same tab using `useRouter().push()` — not a new tab.

4. **Feedback loop (👍/👎)**: Defer — will decide after the feature is built and in use. No auto-flagging logic in initial implementation.
