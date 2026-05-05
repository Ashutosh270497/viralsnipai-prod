# ViralSnipAI Waitlist Landing PRD (X Hype Launch)

## 1) Goal
Launch a high-conversion landing page for X traffic with:
- clear product hype narrative,
- waitlist capture form,
- early-bird offer: **50% off for first 3 months** for eligible paid users.

Success target:
- Waitlist conversion rate: >= 12%
- Cost-per-waitlist from X: within paid target
- Early paid conversion (waitlist -> paid): >= 8%

---

## 2) Product Positioning (from current platform capabilities)
Primary positioning:
- **AI Creator OS** for idea-to-publish workflow.

Core value pillars:
1. Discover what to create: Niche Discovery, Keyword Research, Competitors.
2. Create faster: Script Generator, Title Generator, Thumbnail Generator, Hooksmith.
3. Plan and distribute: Content Calendar, X Radar (drafts, scheduling, analytics).
4. Repurpose at scale: RepurposeOS (ingest, clip extraction, captions, exports).

Proof features currently in codebase:
- Dashboard + usage insights
- Niche discovery quiz + recommendations
- Keyword opportunity scoring + recommendations + history/saved
- Competitor tracking + channel analytics + async sync
- AI scripts + revision + comments + version restore
- AI titles with scoring and A/B suggestion
- Thumbnail generation flow
- Content calendar generation + auto-scheduling
- X Radar: account connect, viral fetch/analyze, draft generation, scheduling/posting
- Repurpose pipeline: ingest, highlights, chapter segmentation, trim/split/search, export
- Brand kit + projects management

---

## 3) Target Audience
Primary:
- Solo creators and creator-operators publishing on YouTube + X + Reels/Shorts.

Secondary:
- Small content teams/agencies handling multiple creator accounts.

Top pains to mirror in copy:
- Too many tools, broken workflow handoffs.
- Idea-to-publish takes too long.
- No reliable way to turn long-form into consistent short-form output.
- Growth strategy disconnected from production execution.

---

## 4) Offer & Pricing Logic
Offer shown on landing:
- **“Join waitlist now -> Get 50% off for 3 months when you upgrade.”**

Eligibility rules:
1. Only waitlist signups within campaign window qualify.
2. Discount valid once per user/account.
3. Applied only on first paid subscription activation.
4. Duration fixed to 3 billing cycles (or 90 days).
5. Not stackable with other promo codes.

Offer metadata to store:
- campaign_id: `x_waitlist_50off_q1`
- discount_percent: `50`
- discount_months: `3`
- eligible_until: timestamp

---

## 5) Landing Page Structure
Recommended section order:
1. Hero
2. Social proof + outcomes
3. “How it works” 4-step workflow
4. Feature stack by pillar
5. Early-bird waitlist section (main CTA)
6. FAQ (discount + launch + access)
7. Sticky mobile CTA

### Hero Copy (suggested)
Headline:
- **Stop juggling 10 creator tools. Run your full growth workflow in one AI OS.**

Subhead:
- Discover ideas, generate scripts/titles/thumbnails, repurpose into short clips, and schedule posts from one workspace.

Primary CTA:
- `Join Waitlist — Get 50% Off`

Secondary CTA:
- `See Product Walkthrough`

Trust line:
- `Early access cohort opens soon • Limited seats • 50% off for first 3 months`

### Feature Pillars (landing cards)
1. Demand Intelligence
- Niche Discovery
- Keyword Research
- Competitor Tracking

2. AI Creation Engine
- Script Generator
- Title Generator
- Thumbnail Generator
- Hooksmith

3. Distribution Control
- Content Calendar
- X Radar (viral analysis + drafts + scheduler)

4. RepurposeOS Pipeline
- Auto highlights
- Captioning + chapter segmentation
- Multi-clip export workflow

---

## 6) Waitlist Form Spec
Form fields:
- `name` (required)
- `email` (required, validated)
- `primaryPlatform` (required; youtube/x/instagram/tiktok/multi)
- `monthlyContentGoal` (optional; numeric or range)
- `teamSize` (optional; solo/2-5/6-20/20+)
- `biggestBottleneck` (optional text)
- `consentMarketing` (required checkbox)

Hidden fields:
- `campaignId` (default `x_waitlist_50off_q1`)
- `source` (`x`)
- `utm_*` params
- `offer` (`50off_3months`)

Submit states:
- idle -> loading -> success/error

Success message:
- “You’re on the list. If approved for early cohort, your 50% discount for 3 months is reserved.”

---

## 7) Backend Data Model (Prisma)
Add model:

```prisma
model WaitlistLead {
  id                 String   @id @default(cuid())
  email              String
  name               String
  primaryPlatform    String
  monthlyContentGoal String?
  teamSize           String?
  biggestBottleneck  String?  @db.Text
  consentMarketing   Boolean  @default(false)

  campaignId         String
  source             String
  utmSource          String?
  utmMedium          String?
  utmCampaign        String?
  utmContent         String?
  utmTerm            String?

  offerCode          String?
  offerPercent       Int?
  offerMonths        Int?
  offerEligibleUntil DateTime?

  status             String   @default("new") // new | reviewed | invited | converted | rejected
  notes              String?  @db.Text

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([email, campaignId])
  @@index([campaignId, createdAt])
  @@index([status])
}
```

---

## 8) API Contract
Endpoint:
- `POST /api/waitlist`

Request:
```json
{
  "name": "Ashutosh",
  "email": "ashu@example.com",
  "primaryPlatform": "x",
  "monthlyContentGoal": "20",
  "teamSize": "solo",
  "biggestBottleneck": "Turning long videos into daily posts",
  "consentMarketing": true,
  "campaignId": "x_waitlist_50off_q1",
  "source": "x",
  "utmSource": "twitter",
  "utmMedium": "organic",
  "utmCampaign": "waitlist_launch"
}
```

Response success:
```json
{
  "success": true,
  "message": "Added to waitlist",
  "offer": {
    "code": "EARLY50",
    "percent": 50,
    "months": 3
  }
}
```

Validation rules:
- Email strict validation.
- Reject if `consentMarketing` is false.
- Deduplicate by `(email, campaignId)`.
- Sanitize optional text fields.

---

## 9) Abuse / Quality Controls
- Rate-limit by IP + email (basic).
- Honeypot field for bots.
- Optional CAPTCHA if bot traffic rises.
- Log lead source + UTM for spend attribution.

---

## 10) Analytics Events
Track at minimum:
- `waitlist_page_view`
- `waitlist_cta_click`
- `waitlist_form_submit_started`
- `waitlist_form_submit_success`
- `waitlist_form_submit_failed`

Event properties:
- campaignId, source, utm params, platform, teamSize.

---

## 11) X (Twitter) Hype Content Pack
Post 1 (problem -> promise):
- “Creators are stuck with fragmented tools: one for ideas, one for scripts, one for clips, one for scheduling. We built ViralSnipAI as one AI Creator OS. Waitlist is open. Early users get 50% off for 3 months.”

Post 2 (workflow):
- “From niche/keywords -> script/title/thumbnail -> short clips -> X drafts + scheduling. One pipeline. Join the early cohort: 50% off for 3 months.”

Post 3 (urgency):
- “We’re accepting a limited early-access cohort from X. If you join now and get approved, you lock 50% off for your first 3 months.”

---

## 12) Build Checklist (One-Go Execution)
1. Add `WaitlistLead` Prisma model + migration.
2. Add `POST /api/waitlist` route with zod validation.
3. Add waitlist section to landing page with form + success/error UX.
4. Add UTM capture (URL params -> hidden fields).
5. Add events tracking.
6. Add admin query page or export endpoint for leads.
7. QA: duplicate email, invalid email, consent false, API failure.

---

## 13) Acceptance Criteria
- User can submit waitlist form from landing page.
- Duplicate campaign signup is blocked gracefully.
- Lead is stored with offer metadata and UTM source.
- Success state clearly confirms 50%/3-month offer.
- Mobile and desktop UX both usable.

