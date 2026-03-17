# ViralSnipAI — Master Implementation Document

> **Version:** 2.2 — March 2026
> **Models:** Verified against OpenRouter live catalog — March 2026
> **For use with:** OpenAI Codex · Claude Code · Any AI coding agent
> **Contains:** Part A — PRD Audit (Cleaned) · Part B — OpenRouter Migration Plan · Part C — PRD Audit Execution Plan

---

## Table of Contents

- [Part A — PRD Audit Report (Cleaned for Current Codebase)](#part-a--prd-audit-report-cleaned-for-current-codebase)
  - [A1. Executive Summary](#a1-executive-summary)
  - [A2. Strategy & Positioning](#a2-strategy--positioning)
  - [A3. Feature Completeness & Gaps](#a3-feature-completeness--gaps)
  - [A4. Technical Architecture Risks](#a4-technical-architecture-risks)
  - [A5. Monetization & Pricing](#a5-monetization--pricing)
  - [A6. Implementation Status Accuracy](#a6-implementation-status-accuracy)
  - [A7. PRD Quality & Missing Specs](#a7-prd-quality--missing-specs)
  - [A8. Summary Scorecard](#a8-summary-scorecard)
  - [A9. Prioritised Action Items](#a9-prioritised-action-items)
- [Part B — OpenRouter Migration Plan](#part-b--openrouter-migration-plan)
  - [B1. Why OpenRouter](#b1-why-openrouter)
  - [B2. Migration Scope](#b2-migration-scope)
  - [B3. Verified Model Tier Framework](#b3-verified-model-tier-framework)
  - [B4. Feature-to-Model Registry](#b4-feature-to-model-registry)
  - [B5. Architecture — Unified LLM Client](#b5-architecture--unified-llm-client)
  - [B6. Implementation Phases](#b6-implementation-phases)
  - [B7. Environment Variable Changes](#b7-environment-variable-changes)
  - [B8. Cost Analysis](#b8-cost-analysis)
  - [B9. Fallback & Reliability Strategy](#b9-fallback--reliability-strategy)
  - [B10. Testing Plan](#b10-testing-plan)
  - [B11. PRD Audit Issues Resolved by Migration](#b11-prd-audit-issues-resolved-by-migration)
- [Part C — PRD Audit Execution Plan](#part-c--prd-audit-execution-plan)
  - [C1. Current Baseline](#c1-current-baseline)
  - [C2. Execution Principles](#c2-execution-principles)
  - [C3. Phase Overview](#c3-phase-overview)
  - [C4. Phase-by-Phase Plan](#c4-phase-by-phase-plan)
  - [C5. Recommended Execution Order](#c5-recommended-execution-order)
  - [C6. Suggested Working Rhythm](#c6-suggested-working-rhythm)
  - [C7. What We Should Execute Next](#c7-what-we-should-execute-next)

---

# Part A — PRD Audit Report (Cleaned for Current Codebase)

> This version reframes Part A as a current-state executive audit. It keeps the strategic findings that still matter, removes stale implementation claims, and separates unresolved risks from issues already addressed in code.

---

## A1. Executive Summary

ViralSnipAI has evolved beyond the state implied by the original audit. The product surface is materially richer now, especially in SnipRadar, the browser extension, Content Calendar handoffs, and operational fallback states. The main weakness is no longer "missing product breadth" so much as **missing product-operating clarity**.

The biggest still-valid concerns are:

- **Positioning risk**: the YouTube + X dual ecosystem still needs clearer beachhead positioning while the full flywheel remains deferred
- **Infrastructure risk**: FFmpeg execution architecture is still under-specified for a Vercel-centered stack
- **PRD quality risk**: privacy/compliance, accessibility, observability, performance targets, and status taxonomy are still not specified tightly enough
- **Monetization risk**: annual pricing, limit design, and Studio packaging are still under-defined

The biggest corrections to the original audit are:

- the AI model-name critique was directionally wrong; the issue is not whether the models exist, but whether the repo uses a consistent provider-compatible invocation path
- the product already implements many empty/recovery states the audit treated as absent
- Research Inbox already had search in the codebase and now also has bulk triage actions
- Content Calendar already had script/title/thumbnail handoffs and now also continues into RepurposeOS

**Bottom line:** Part A should be treated as a strong strategic audit, not as a literal snapshot of current implementation status.

---

## A2. Strategy & Positioning

### Still Valid

#### 🔴 CRITICAL — Dual Ecosystem Still Dilutes the Front-Door Value Proposition

The product still serves two creator jobs-to-be-done under one umbrella:

- long-form creators trying to repurpose YouTube content
- X-native creators trying to grow through research, drafting, scheduling, and engagement

Without a visible cross-ecosystem flywheel in the launch story, the front door still risks feeling like two products sharing infrastructure instead of one sharply positioned product.

**Recommendation:**
- Define a launch beachhead persona explicitly
- Treat the second ecosystem as expansion leverage, not primary homepage positioning

#### 🟡 MEDIUM — X-to-Content Flywheel Still Matters Strategically

The argument for the shared ecosystem still depends on a cross-surface loop. If that remains deferred, the positioning should say so clearly rather than implying a unified closed-loop product from day one.

**Recommendation:**
- Keep the flywheel in the long-term vision
- Do not over-market it as a launch differentiator until it is in scope again

#### 🟡 MEDIUM — No Explicit Out-of-Scope Platform Statement

TikTok, Instagram Reels, and LinkedIn are still materially absent from the product definition. That can be correct, but the PRD should state it explicitly to avoid future scope drift.

**Recommendation:**
- Add a short "Out of Scope for v1" section

---

## A3. Feature Completeness & Gaps

### Still Valid

#### 🔴 CRITICAL — Activation / Onboarding Is Still Under-Specified

The PRD still does not clearly define:

- the activation event
- the "aha moment"
- the onboarding checklist
- the instrumentation needed to tell whether new users reached value

This is still one of the highest-leverage missing specifications.

**Recommendation:**
- Define one activation event per ecosystem
- Add onboarding success metrics and lifecycle triggers

#### 🟡 MEDIUM — Browser Extension Composer Reliability Remains a Product Risk

Even though the extension is now materially more capable than the original audit assumed, X composer integration remains a fragile surface by nature. The PRD should explicitly define acceptable degraded states.

**Recommendation:**
- Document same-page insertion as the preferred path
- Document copy/paste fallback as the degraded path
- Define what "production ready" means for extension composer behavior

#### ✅ Resolved — Research Inbox Bulk Operations Are Implemented

Research Inbox now supports multi-select cleanup and review workflows:
- bulk archive / restore
- bulk status updates
- bulk label add / replace
- bulk delete

#### 🟡 MEDIUM — Mobile / Responsive Support Is Still Under-Specified

The current product has several desktop-heavy experiences, particularly in RepurposeOS and parts of SnipRadar. The PRD still needs a support matrix that distinguishes:

- mobile supported
- mobile degraded
- desktop only

**Recommendation:**
- Add supported breakpoints and explicit degradation rules

#### 🟡 MEDIUM — No Unified User-Facing Activity / Job Status Surface

Background jobs now exist across more product areas than when the original audit was written. That makes the lack of a unified activity log even more visible.

**Recommendation:**
- Add a platform-wide activity feed / job status component to the PRD

### Findings That Need Correction

#### ✅ Corrected — Empty / Error States Are Not Absent in Code

The original audit overstated this. The PRD specification is still incomplete, but the codebase already implements many empty, loading, and fallback states across SnipRadar and Repurpose flows.

**Correct reading:**
- the **spec** is incomplete
- the **implementation** is ahead of the spec

#### ✅ Corrected — Research Inbox Search Already Exists

The current gap is not basic search. The real gap is bulk action support and long-term information architecture.

#### ✅ Resolved — Content Calendar Now Continues into RepurposeOS

The current codebase supports direct per-idea continuation from Content Calendar into RepurposeOS by creating a seeded project and carrying the idea context into the ingest workflow.

---

## A4. Technical Architecture Risks

### Still Valid

#### 🔴 CRITICAL — FFmpeg + Serverless Architecture Is Still a Hard PRD Gap

This remains the clearest architecture risk. If FFmpeg is invoked on serverless paths without a documented execution strategy, the product has a production fragility that the PRD does not acknowledge.

**Recommendation:**
- Document the actual execution path clearly:
  - Inngest worker
  - dedicated compute
  - media API
- Treat this as a launch-blocking documentation gap if unresolved

#### 🟡 MEDIUM — X API Unit Economics Remain a Product-Level Concern

SnipRadar is now deeper and broader, which increases the need for a real call-volume and margin model around X usage.

**Recommendation:**
- Add per-active-user X API call estimates
- Define thresholds for when heavy features need gating or packaging changes

#### 🟡 MEDIUM — No Unified Operational Status Surface

With more background work now happening across features, the lack of a shared user-visible operations surface is more notable, not less.

### Findings That Need Correction

#### ✅ Corrected — Model Names Were Not the Real Issue

The original model-name critique should be reframed.

The real risk is:

- scattered direct-provider usage
- inconsistent model routing
- provider-specific API parameter compatibility
- no central model/task registry

That is exactly why Part B exists.

**Correct reading:**
- the issue is **LLM orchestration quality**
- not whether the named models themselves are real

---

## A5. Monetization & Pricing

### Still Valid

#### 🔴 CRITICAL — Annual Pricing Is Still Missing

This remains one of the cleanest monetization gaps.

#### 🟡 MEDIUM — Credits and Count-Based Limits Are Still Mixed

The product still appears to mix credits, per-feature quotas, and plan-based restrictions. That increases both UX friction and implementation complexity.

#### 🟡 MEDIUM — Studio Tier Is Still Under-Defined

Seat billing, collaboration boundaries, and workspace-specific value still need explicit definition.

### Needs Nuance

#### 🟡 MEDIUM — Free Tier Might Be Too Restrictive, But This Should Be Framed as an Activation Hypothesis

The original audit treated this as already proven. The better framing is:

- current free-tier design may be too tight to reach activation
- that needs validation through onboarding and conversion instrumentation

**Recommendation:**
- treat this as a pricing/activation experiment, not a settled fact

---

## A6. Implementation Status Accuracy

### Still Valid

#### 🟡 CONCERN — "Complete" Is Still Overused

This remains the most useful status-quality criticism. For a product of this breadth, "Complete" should imply:

- acceptance criteria met
- empty/error states handled
- observability in place
- operational hardening done
- QA coverage finished

#### 🟡 CONCERN — Status Definitions Need a Real Taxonomy

The product now has enough surface area that "implemented", "complete", "production ready", and "deferred" need precise definitions.

#### 🟡 CONCERN — Automation Features Need Explicit Safeguards

Winner Loop, browser extension actions, and other automations should have documented guardrails such as:

- rate limits
- cooldowns
- kill switches
- fallback states

### Findings That Need Correction

#### ✅ Corrected — Status Definitions Now Have a Real Taxonomy

Phase 1 added a shared taxonomy to the PRD and code-level source of truth:

- `Scaffolded`
- `Built`
- `QA Complete`
- `Production Ready`
- `Deferred`

The remaining work is cultural consistency: old wording and inflated status claims still need ongoing cleanup in future planning docs.

---

## A7. PRD Quality & Missing Specs

### Still Valid

#### 🟡 MEDIUM — Experience Standards Need Ongoing Remediation Against the New Baseline

Phase 4 now defines:

- a responsive support matrix
- a `WCAG 2.1 AA` minimum accessibility baseline
- p50/p95 latency targets and long-running job expectations
- an explicit observability stack and alert-owner model

The remaining work is not standards definition. It is remediation and enforcement across the highest-traffic surfaces.

### Needs Correction / Reframing

#### ⚪ Doc Hygiene — Roadmap Numbering Gap Should Be Treated as Source-PRD Hygiene, Not a Current Product Risk

If the numbering gap still exists in the source PRD, fix it. If the source PRD has already been cleaned, remove this finding from future audits. This is a documentation hygiene issue, not a strategic or implementation risk.

#### ✅ Corrected — Privacy / Compliance Baseline Now Exists

Phase 1 added a real PRD privacy baseline plus aligned support docs and public legal copy. The remaining gap is not "missing entirely" anymore; it is future refinement if the product needs stronger legal or enterprise compliance depth.

---

## A8. Summary Scorecard

| Area | Score | Primary Risk |
|---|---|---|
| Strategy & Positioning | 6/10 | Dual ecosystem still needs a sharper launch persona |
| Feature Completeness | 7.5/10 | Product breadth is strong; activation, bulk ops, mobile support remain under-specified |
| Technical Architecture | 7/10 | FFmpeg execution path and X unit economics still need explicit architecture treatment |
| Monetization | 6/10 | No annual pricing; packaging and limit model still need tightening |
| Implementation Status | 6/10 | Status labels still overstate maturity without a clear taxonomy |
| PRD Quality | 5.5/10 | Missing privacy, a11y, monitoring, performance, and operating standards |
| **Overall** | **6.5/10** | **Strong product surface, but PRD still needs operating discipline before launch** |

---

## A9. Prioritised Action Items

### P0 — Must Fix Before Launch

1. Document the actual FFmpeg execution architecture and verify it is not implicitly relying on unsupported serverless paths
2. Define activation events, onboarding success criteria, and funnel instrumentation for both ecosystems
3. Add a Privacy & Compliance section covering retention, deletion, consent, and account removal behavior
4. Add a formal status taxonomy: `Scaffolded` → `Built` → `QA Complete` → `Production Ready` → `Deferred`
5. Define a platform-wide user-visible activity / job status surface

### P1 — Should Fix Before Launch

6. Add annual pricing tiers and the annual-discount model
7. Unify credit, quota, and plan-limit language into one documented limits framework
8. Apply the responsive support matrix to the highest-traffic surfaces and close the top mobile-degraded gaps
9. Add X API cost and rate-limit modeling to the PRD
10. Run an accessibility remediation pass against the `WCAG 2.1 AA` baseline
11. Wire the performance and observability standards into rollout checklists and alert handling

### P2 — Post-Launch / Strategic

12. Fully specify the Studio tier or mark it out of scope for v1
15. Keep the feature-flag lifecycle policy current as new gated surfaces are introduced
16. Revisit the X-to-content flywheel once the beachhead persona and cross-ecosystem positioning are explicit

---


# Part B — OpenRouter Migration Plan

> All model IDs in this section are verified against the OpenRouter live catalog as of March 2026.

---

## B1. Why OpenRouter

### Current Pain Points

| Problem | Impact |
|---|---|
| 4+ separate API keys (OpenAI, Google, ElevenLabs) | Multiple billing accounts, dashboards, secrets |
| Model strings not in OpenRouter format across codebase | Potential `model not found` errors in production |
| No unified rate limit handling | Each provider has different error codes and retry semantics |
| No cost visibility across features | Cannot identify which feature drives most spend |
| Vendor lock-in per file | Changing a model requires touching many scattered files |

### What OpenRouter Provides

- **Single API key** — one billing account, one dashboard, one `.env` secret
- **OpenAI-compatible interface** — same SDK, change only `baseURL` and model string
- **300+ models across 60+ providers** — Anthropic, OpenAI, Google, DeepSeek, Mistral, Meta Llama and more
- **Per-request cost metadata** — activity log in dashboard + cost header per call
- **Automatic fallback routing** — primary + fallback model per call
- **No minimum spend** — pure pay-as-you-go

### What Stays on Direct Provider APIs

| Service | Reason |
|---|---|
| **ElevenLabs TTS** | Audio / voice synthesis — OpenRouter is LLM text only |
| **OpenAI TTS** (`tts-1`, `tts-1-hd`) | Audio endpoint — not an LLM completion |
| **Google Imagen** | Image generation — direct API required |
| **Google Veo** | Video generation — no equivalent on OpenRouter |

> **Rule:** If the output is audio, image, or video → stay direct. If the output is text or JSON → route through OpenRouter.

---

## B2. Migration Scope

### In Scope (All Text / JSON LLM Calls)

- All script generation, revision, and section regeneration
- All hook, title, content calendar, and thread generation
- Virality scoring and text-based highlight detection
- SnipRadar: draft generation, rewrite, predict, variants, style trainer, research copilot
- SnipRadar: growth coach, growth planner, profile audit, analytics summary, winner loop derivatives
- Browser extension: Reply Assist, Remix, Quick Draft
- Niche discovery analysis, keyword intelligence, competitor analytics, auto-schedule

### Out of Scope (Stays Direct)

- ElevenLabs voice cloning and synthesis (`/voicer`, `/api/voicer/`)
- OpenAI TTS synthesis for Script Generator (`/api/scripts/[id]/synthesize`)
- Google Imagen image generation (`/api/imagen`)
- Google Veo video generation (`/api/veo`)
- DataForSEO (keyword demand/trend — not an LLM)
- YouTube Data API, X API v2

---

## B3. Verified Model Tier Framework

> All model IDs below are confirmed available on OpenRouter as of March 2026.
> Pricing sourced from OpenRouter provider pages and verified third-party sources.

### Tier Definitions

| Tier | Name | Use When | Primary Model | Verified ID |
|---|---|---|---|---|
| **T1** | Fast & Cheap | Classification, scoring, short transforms, high-frequency calls | Gemini 2.5 Flash-Lite | `google/gemini-2.5-flash-lite` |
| **T1-alt** | OpenAI Fast | T1 tasks where OpenAI instruction-following is preferred | GPT-5 Mini | `openai/gpt-5-mini` |
| **T2** | Balanced | Style-aware rewrites, standard generation, moderate context | Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` |
| **T3** | Premium | Long-form generation, complex reasoning, flagship features | Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` |
| **T3-alt** | Gemini Premium | T3 tasks where cost matters most; strong on structured output | Gemini 2.5 Pro | `google/gemini-2.5-pro` |
| **T4** | Power (reserve) | Only if T3 quality is insufficient — use sparingly | Claude Opus 4.6 | `anthropic/claude-opus-4.6` |

### Verified Pricing (March 2026)

| Model | OpenRouter ID | Input $/1M | Output $/1M | Context |
|---|---|---|---|---|
| Gemini 2.5 Flash-Lite | `google/gemini-2.5-flash-lite` | ~$0.10 | ~$0.40 | Large |
| GPT-5 Mini | `openai/gpt-5-mini` | ~$0.40 | ~$1.60 | 128K |
| Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` | $1.00 | $5.00 | 200K |
| GPT-5.1 | `openai/gpt-5.1` | ~$2.00 | ~$8.00 | 128K |
| Gemini 2.5 Pro | `google/gemini-2.5-pro` | $1.25 | $10.00 | 1.05M |
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4.6` | $3.00 | $15.00 | 1M |
| Gemini 3 Pro Preview | `google/gemini-3-pro-preview` | $2.00 | $12.00 | 1.05M |
| Claude Opus 4.6 | `anthropic/claude-opus-4.6` | ~$15.00 | ~$75.00 | 200K |

> ⚠️ OpenRouter applies a **5.5% platform fee** on top of all model pricing. Always verify current rates at [openrouter.ai/models](https://openrouter.ai/models) before budgeting.

### Decision Criteria

Ask these four questions to assign a tier to any new feature:

1. **Output length** — < 500 tokens → T1/T2 · > 1,000 tokens → T3
2. **Call frequency** — Called per-keystroke or per-second → T1. Called once per user action → T2/T3
3. **Latency tolerance** — < 2s required → T1. Can wait 5–10s → T3
4. **Quality bar** — Draft the user will edit → T2. Final output user acts on → T3

---

## B4. Feature-to-Model Registry

### 4.1 YouTube Creator Platform

| Feature | Tier | Primary Model ID | Fallback Model ID | Rationale |
|---|---|---|---|---|
| Niche Discovery (quiz analysis) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Nuanced reasoning + user goal context |
| Keyword Intelligence (scoring/classification) | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | JSON classification, called frequently |
| Keyword Recommendations | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Personalised suggestions, short output |
| Content Calendar (idea generation) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Generates 7–30 ideas with full metadata |
| Script Generate (full script) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Core value prop — quality is what users pay for |
| Script Revise (engage / shorten / custom) | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Transform task, not net-new generation |
| Script Section Regenerate | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Single section; fast response expected |
| Title Generator (5–10 variants) | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Short creative copywriting — Haiku excels |
| Thumbnail Prompt Enhancement | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Very short prompt rewrite |
| Hooksmith — Hook variants (8–10) | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Hooks are short; creativity > raw intelligence |
| Hooksmith — Script seed from hook | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Brief outline seed, not a full script |
| RepurposeOS — Prompt Generator | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Short structured helper output |
| RepurposeOS — Highlight Detection (text) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Core repurpose accuracy; errors waste user time |
| RepurposeOS — Highlight Detection (video native) | DIRECT | `gemini-2.0-flash` via Google API | — | OpenRouter Gemini video input support unverified — stay direct |
| Caption Generation | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Structured transform, high frequency per clip |
| Virality Scoring | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Scoring with brief reasoning |
| Competitor Analytics (pattern analysis) | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Analytical summary, not creative |
| Auto-Schedule (slot assignment) | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Deterministic JSON output |

### 4.2 X Growth Platform — SnipRadar

| Feature | Tier | Primary Model ID | Fallback Model ID | Rationale |
|---|---|---|---|---|
| Draft Generate | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Tweets are short; style matching needs moderate quality |
| Draft Rewrite | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Short style-aware transform |
| Variant Lab (3–5 variants) | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Bulk short variants; Haiku handles volume well |
| Virality Predictor | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Objective-weighted scoring with brief reasoning |
| Viral Tweet Analysis | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Pattern classification, high frequency |
| Hook Generator (X) | T1 | `google/gemini-2.5-flash-lite` | `anthropic/claude-haiku-4.5` | Very short output, multiple formats |
| Thread Writer | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | 5–10 tweets; Haiku quality sufficient |
| Template Remix | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Structured fill-in, very short output |
| Style Trainer (profile analysis) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Style profile quality affects all downstream generation |
| Research Copilot (RAG synthesis) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Complex multi-doc synthesis — quality is product-critical |
| AI Growth Coach | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | User-facing recommendation; quality builds trust |
| Growth Planner (multi-week plan) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Flagship strategic feature; warrants T3 |
| Profile Audit (score + recommendations) | T3 | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-pro` | Users act on audit; inaccurate audit = churn |
| Analytics AI Summary | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Summary of metrics, moderate length |
| Winner Loop Derivatives | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Derivative generation from known winner post |

### 4.3 Browser Extension

| Feature | Tier | Primary Model ID | Fallback Model ID | Rationale |
|---|---|---|---|---|
| Reply Assist | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Must respond < 3s inline; Flash-Lite is the fastest option |
| Remix | T2 | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | Needs style awareness; slightly higher quality than pure reply |
| Quick Draft (popup) | T1 | `google/gemini-2.5-flash-lite` | `openai/gpt-5-mini` | Low-latency popup context |

---

## B5. Architecture — Unified LLM Client

Three new files replace all scattered provider instantiations. Changing any model in future = one line in `model-registry.ts`.

### File 1 — `apps/web/lib/ai/openrouter-client.ts`

```typescript
import OpenAI from 'openai';

export const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralsnipai.com',
    'X-Title': 'ViralSnipAI',
  },
});
```

---

### File 2 — `apps/web/lib/ai/model-registry.ts`

```typescript
// ─── Verified OpenRouter model IDs — March 2026 ────────────────────────────
// Always check openrouter.ai/models for updated IDs before changing tiers.

export const MODEL_REGISTRY = {

  // ── YouTube Creator ────────────────────────────────────────────────────────
  NICHE_DISCOVERY:             'anthropic/claude-sonnet-4.6',   // T3
  KEYWORD_INTELLIGENCE:        'google/gemini-2.5-flash-lite',  // T1
  KEYWORD_RECOMMENDATIONS:     'anthropic/claude-haiku-4.5',    // T2
  CONTENT_CALENDAR:            'anthropic/claude-sonnet-4.6',   // T3
  SCRIPT_GENERATE:             'anthropic/claude-sonnet-4.6',   // T3
  SCRIPT_REVISE:               'anthropic/claude-haiku-4.5',    // T2
  SCRIPT_SECTION_REGEN:        'anthropic/claude-haiku-4.5',    // T2
  TITLE_GENERATE:              'anthropic/claude-haiku-4.5',    // T2
  THUMBNAIL_PROMPT_ENHANCE:    'google/gemini-2.5-flash-lite',  // T1
  HOOKSMITH_HOOKS:             'anthropic/claude-haiku-4.5',    // T2
  HOOKSMITH_SCRIPT_SEED:       'anthropic/claude-haiku-4.5',    // T2
  REPURPOSE_PROMPT_GENERATE:   'google/gemini-2.5-flash-lite',  // T1
  REPURPOSE_HIGHLIGHT_DETECT:  'anthropic/claude-sonnet-4.6',   // T3
  CAPTION_GENERATE:            'google/gemini-2.5-flash-lite',  // T1
  VIRALITY_SCORE:              'anthropic/claude-haiku-4.5',    // T2
  COMPETITOR_ANALYTICS:        'anthropic/claude-haiku-4.5',    // T2
  AUTO_SCHEDULE:               'google/gemini-2.5-flash-lite',  // T1

  // ── SnipRadar / X ─────────────────────────────────────────────────────────
  SNIPRADAR_DRAFT_GENERATE:    'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_REWRITE:           'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_VARIANTS:          'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_PREDICT:           'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_VIRAL_ANALYZE:     'google/gemini-2.5-flash-lite',  // T1
  SNIPRADAR_HOOK_GENERATE:     'google/gemini-2.5-flash-lite',  // T1
  SNIPRADAR_THREAD_GENERATE:   'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_TEMPLATE_REMIX:    'google/gemini-2.5-flash-lite',  // T1
  SNIPRADAR_STYLE_TRAIN:       'anthropic/claude-sonnet-4.6',   // T3
  SNIPRADAR_RESEARCH_QUERY:    'anthropic/claude-sonnet-4.6',   // T3
  SNIPRADAR_COACH:             'anthropic/claude-sonnet-4.6',   // T3
  SNIPRADAR_GROWTH_PLAN:       'anthropic/claude-sonnet-4.6',   // T3
  SNIPRADAR_PROFILE_AUDIT:     'anthropic/claude-sonnet-4.6',   // T3
  SNIPRADAR_ANALYTICS_SUMMARY: 'anthropic/claude-haiku-4.5',    // T2
  SNIPRADAR_WINNER_DERIVATIVE: 'anthropic/claude-haiku-4.5',    // T2

  // ── Browser Extension ──────────────────────────────────────────────────────
  EXTENSION_REPLY_ASSIST:      'google/gemini-2.5-flash-lite',  // T1
  EXTENSION_REMIX:             'anthropic/claude-haiku-4.5',    // T2
  EXTENSION_QUICK_DRAFT:       'google/gemini-2.5-flash-lite',  // T1

} as const;

export type ModelRegistryKey = keyof typeof MODEL_REGISTRY;

// ─── Fallbacks: if primary returns rate_limit / overloaded / model not found ─
export const MODEL_FALLBACKS: Partial<Record<ModelRegistryKey, string>> = {
  // T3 fallbacks → Gemini 2.5 Pro (cheaper than Sonnet, strong quality)
  NICHE_DISCOVERY:             'google/gemini-2.5-pro',
  CONTENT_CALENDAR:            'google/gemini-2.5-pro',
  SCRIPT_GENERATE:             'google/gemini-2.5-pro',
  REPURPOSE_HIGHLIGHT_DETECT:  'google/gemini-2.5-pro',
  SNIPRADAR_STYLE_TRAIN:       'google/gemini-2.5-pro',
  SNIPRADAR_RESEARCH_QUERY:    'google/gemini-2.5-pro',
  SNIPRADAR_COACH:             'google/gemini-2.5-pro',
  SNIPRADAR_GROWTH_PLAN:       'google/gemini-2.5-pro',
  SNIPRADAR_PROFILE_AUDIT:     'google/gemini-2.5-pro',

  // T1/T2 fallbacks → gpt-5-mini
  KEYWORD_INTELLIGENCE:        'openai/gpt-5-mini',
  EXTENSION_REPLY_ASSIST:      'openai/gpt-5-mini',
  EXTENSION_QUICK_DRAFT:       'openai/gpt-5-mini',
  SNIPRADAR_VIRAL_ANALYZE:     'openai/gpt-5-mini',
  SNIPRADAR_HOOK_GENERATE:     'openai/gpt-5-mini',
  CAPTION_GENERATE:            'openai/gpt-5-mini',
  SNIPRADAR_DRAFT_GENERATE:    'openai/gpt-5-mini',
  SNIPRADAR_REWRITE:           'openai/gpt-5-mini',
  SNIPRADAR_VARIANTS:          'openai/gpt-5-mini',
};
```

---

### File 3 — `apps/web/lib/ai/llm.ts`

```typescript
import { openRouterClient } from './openrouter-client';
import { MODEL_REGISTRY, MODEL_FALLBACKS, ModelRegistryKey } from './model-registry';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

interface LLMCallOptions {
  feature: ModelRegistryKey;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

interface LLMResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callLLM(options: LLMCallOptions): Promise<LLMResult> {
  const { feature, messages, temperature = 0.7, maxTokens, responseFormat } = options;
  const model = MODEL_REGISTRY[feature];

  try {
    const res = await openRouterClient.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });
    return {
      content: res.choices[0].message.content ?? '',
      model,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    const fallback = MODEL_FALLBACKS[feature];
    if (fallback && isRetryable(err)) {
      const res2 = await openRouterClient.chat.completions.create({
        model: fallback,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });
      return {
        content: res2.choices[0].message.content ?? '',
        model: fallback,
        inputTokens: res2.usage?.prompt_tokens ?? 0,
        outputTokens: res2.usage?.completion_tokens ?? 0,
      };
    }
    throw err;
  }
}

// ─── Streaming variant — for Script Generator, Growth Planner ────────────────
export async function streamLLM(options: LLMCallOptions) {
  const { feature, messages, temperature = 0.7, maxTokens } = options;
  return openRouterClient.chat.completions.create({
    model: MODEL_REGISTRY[feature],
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });
}

// ─── Usage in streaming API route ────────────────────────────────────────────
// import { streamLLM } from '@/lib/ai/llm';
// import { OpenAIStream, StreamingTextResponse } from 'ai'; // Vercel AI SDK
//
// export async function POST(req: Request) {
//   const stream = await streamLLM({ feature: 'SCRIPT_GENERATE', messages: [...] });
//   return new StreamingTextResponse(OpenAIStream(stream));
// }

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes('rate_limit') || m.includes('overloaded') || m.includes('model not found');
  }
  return false;
}
```

---

## B6. Implementation Phases

### Phase 0 — Preparation (1–2 days)

**Goal:** Validate all registry models respond before touching production code.

- [ ] Create OpenRouter account at [openrouter.ai](https://openrouter.ai)
- [ ] Add `OPENROUTER_API_KEY` to `.env.local` and Vercel project settings
- [ ] Verify each model in the registry via OpenRouter Playground or `GET https://openrouter.ai/api/v1/models`
- [ ] Set monthly spend cap in OpenRouter dashboard (recommended: start at $100/mo)
- [ ] Create the 3 new files: `openrouter-client.ts`, `model-registry.ts`, `llm.ts`
- [ ] Write integration test confirming T1, T2, and T3 model each return valid completions

---

### Phase 1 — Browser Extension (2–3 days) — **Start Here**

> The extension currently uses `OPENAI_SNIPRADAR_EXTENSION_MODEL` pointing at an unverified model string. This is the highest-risk live issue — fix first.

| File to Change | Change |
|---|---|
| `apps/web/lib/ai/snipradar-extension.ts` | Replace `new OpenAI(...)` with `callLLM({ feature: 'EXTENSION_REPLY_ASSIST', ... })` |
| `app/api/snipradar/extension/reply/route.ts` | Remove `OPENAI_SNIPRADAR_EXTENSION_MODEL` env check — model from registry |
| `app/api/snipradar/extension/remix/route.ts` | Replace with `callLLM({ feature: 'EXTENSION_REMIX', ... })` |
| `app/api/snipradar/extension/draft/route.ts` | Replace with `callLLM({ feature: 'EXTENSION_QUICK_DRAFT', ... })` |

**Remove from `.env` after this phase:**
```
OPENAI_SNIPRADAR_EXTENSION_MODEL
OPENAI_SNIPRADAR_EXTENSION_TIMEOUT_MS
```

**Test:** Fire Reply Assist and Remix from the browser extension against live x.com. Confirm latency < 3s.

---

### Phase 2 — SnipRadar Core (3–4 days)

| File | Feature Key |
|---|---|
| `app/api/snipradar/drafts/route.ts` | `SNIPRADAR_DRAFT_GENERATE` |
| `app/api/snipradar/rewrite/route.ts` | `SNIPRADAR_REWRITE` |
| `app/api/snipradar/drafts/variants/route.ts` | `SNIPRADAR_VARIANTS` |
| `app/api/snipradar/drafts/predict/route.ts` | `SNIPRADAR_PREDICT` |
| `app/api/snipradar/viral/analyze/route.ts` | `SNIPRADAR_VIRAL_ANALYZE` |
| `app/api/snipradar/hooks/generate/route.ts` | `SNIPRADAR_HOOK_GENERATE` |
| `app/api/snipradar/threads/generate/route.ts` | `SNIPRADAR_THREAD_GENERATE` |
| `app/api/snipradar/style/route.ts` | `SNIPRADAR_STYLE_TRAIN` |
| `app/api/snipradar/research/query/route.ts` | `SNIPRADAR_RESEARCH_QUERY` |
| `app/api/snipradar/coach/route.ts` | `SNIPRADAR_COACH` |
| `app/api/snipradar/growth-planner/route.ts` | `SNIPRADAR_GROWTH_PLAN` + use `streamLLM()` |
| `app/api/snipradar/profile-audit/route.ts` | `SNIPRADAR_PROFILE_AUDIT` |
| `app/api/snipradar/metrics/route.ts` | `SNIPRADAR_ANALYTICS_SUMMARY` |
| `app/api/snipradar/winners/automations/route.ts` | `SNIPRADAR_WINNER_DERIVATIVE` |

---

### Phase 3 — YouTube Creator Core (3–4 days)

| File | Feature Key |
|---|---|
| `app/api/niche-discovery/analyze/route.ts` | `NICHE_DISCOVERY` |
| `app/api/keywords/search/route.ts` | `KEYWORD_INTELLIGENCE` |
| `app/api/keywords/recommendations/route.ts` | `KEYWORD_RECOMMENDATIONS` |
| `app/api/content-calendar/generate/route.ts` | `CONTENT_CALENDAR` |
| `app/api/scripts/generate/route.ts` | `SCRIPT_GENERATE` + use `streamLLM()` |
| `app/api/scripts/[scriptId]/revise/route.ts` | `SCRIPT_REVISE` |
| `app/api/scripts/[scriptId]/regenerate-section/route.ts` | `SCRIPT_SECTION_REGEN` |
| `app/api/titles/generate/route.ts` | `TITLE_GENERATE` |
| `app/api/thumbnails/generate/route.ts` (prompt only) | `THUMBNAIL_PROMPT_ENHANCE` |
| `app/api/hooksmith/hooks/route.ts` | `HOOKSMITH_HOOKS` |
| `app/api/hooksmith/script/route.ts` | `HOOKSMITH_SCRIPT_SEED` |
| `app/api/repurpose/generate-prompts/route.ts` | `REPURPOSE_PROMPT_GENERATE` |
| `app/api/repurpose/auto-highlights/route.ts` | `REPURPOSE_HIGHLIGHT_DETECT` |
| `app/api/repurpose/captions/route.ts` | `CAPTION_GENERATE` |
| `apps/web/lib/services/virality.service.ts` | `VIRALITY_SCORE` |
| `app/api/competitors/[id]/analytics/route.ts` | `COMPETITOR_ANALYTICS` |
| `app/api/content-calendar/[id]/auto-schedule/route.ts` | `AUTO_SCHEDULE` |

---

### Phase 4 — Cleanup & Validation (2 days)

- [ ] Audit all remaining `new OpenAI(...)` and `new GoogleGenerativeAI(...)` — confirm only TTS, Imagen, Veo remain
- [ ] Remove `GOOGLE_AI_API_KEY` from `.env` if Gemini text calls are fully migrated (keep for Imagen/Veo)
- [ ] Run full Playwright E2E suite across both ecosystems
- [ ] Verify OpenRouter dashboard shows activity for all migrated features
- [ ] Update PRD Section 3 Tech Stack to list OpenRouter as the LLM gateway
- [ ] Confirm no unformatted model name strings remain in any API call site

---

## B7. Environment Variable Changes

### Before

```bash
# Multiple provider keys
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
OPENAI_SNIPRADAR_EXTENSION_MODEL=gpt-5-mini    # Remove — now in registry
OPENAI_SNIPRADAR_EXTENSION_TIMEOUT_MS=10000    # Remove — handled by callLLM
```

### After

```bash
# ── Single LLM gateway ────────────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-...

# ── Non-LLM services (stay direct) ───────────────────────────────────────────
OPENAI_API_KEY=sk-...        # Only for TTS (tts-1, tts-1-hd) in Script Generator
ELEVENLABS_API_KEY=...       # Voice cloning and Voicer workspace
GOOGLE_AI_API_KEY=AIza...    # Only for Imagen + Veo (image/video generation)
```

**Keys fully removed after migration:**
- `OPENAI_SNIPRADAR_EXTENSION_MODEL`
- `OPENAI_SNIPRADAR_EXTENSION_TIMEOUT_MS`

---

## B8. Cost Analysis

### Per-Feature Savings (per 1,000 calls)

| Feature | Old Model (assumed) | Old $/1K calls | New Model | New $/1K calls | Saving |
|---|---|---|---|---|---|
| Reply Assist (extension) | `gpt-4o` | ~$12 | `gemini-2.5-flash-lite` | ~$0.30 | **~97%** |
| Hook Generation | `gpt-4o` | ~$8 | `gemini-2.5-flash-lite` | ~$0.30 | **~96%** |
| Caption Generation | `gpt-4` | ~$20 | `gemini-2.5-flash-lite` | ~$0.30 | **~98%** |
| Viral Analysis | `gpt-4o` | ~$8 | `gemini-2.5-flash-lite` | ~$0.30 | **~96%** |
| Title Generator | `gpt-4o` | ~$7 | `claude-haiku-4.5` | ~$2 | **~71%** |
| Script Revise | `gpt-4o` | ~$7 | `claude-haiku-4.5` | ~$2 | **~71%** |
| Script Generate | `gpt-4` | ~$25 | `claude-sonnet-4.6` | ~$9 | **~64%** |
| Growth Planner | `gpt-4` | ~$25 | `claude-sonnet-4.6` | ~$9 | **~64%** |
| Profile Audit | `gpt-4` | ~$20 | `claude-sonnet-4.6` | ~$9 | **~55%** |

### Platform-Wide Estimate: **65–97% reduction on high-frequency tasks · 55–65% on long-form tasks**

The biggest wins are on T1 tasks (Reply Assist, captions, hooks, viral scoring) — `gemini-2.5-flash-lite` at ~$0.10/M input vs. `gpt-4o` at ~$2.50/M input is a **25x cost reduction** on those calls.

---

## B9. Fallback & Reliability Strategy

### Model-Level Fallbacks
Handled automatically by `callLLM()` via `MODEL_FALLBACKS`. Triggers on: `rate_limit`, `overloaded`, `model not found` errors.

### OpenRouter Outage
`callLLM()` will throw after both primary and fallback fail. For critical user-facing features (Script Generate, Growth Planner), surface a user-friendly error toast — do not silently retry forever.

### Cost Guardrails — Configure in OpenRouter Dashboard
- Set a **monthly hard spend limit** (suggested: $200/mo to start)
- Set a **daily soft alert** at 50% of expected daily spend
- Enable **email alerts** on unusual spend spikes

### Existing Guards Remain
`apps/web/lib/snipradar/request-guards.ts` rate limits operate at the user/feature level independently of routing — these are unaffected by the migration.

---

## B10. Testing Plan

### Unit Tests — Mock `callLLM` per Service

```typescript
jest.mock('@/lib/ai/llm', () => ({
  callLLM: jest.fn().mockResolvedValue({
    content: '{"hooks":["Hook 1","Hook 2"]}',
    model: 'google/gemini-2.5-flash-lite',
    inputTokens: 100,
    outputTokens: 50,
  }),
  streamLLM: jest.fn(),
}));
```

### Integration Regression Checklist (run after each phase)

| Phase | Key Tests |
|---|---|
| Phase 1 | Reply Assist inline panel responds < 3s on live x.com · Remix generates relevant post · Quick Draft works from popup |
| Phase 2 | Draft generation uses style profile · Predictor returns score · Growth Planner generates multi-week plan |
| Phase 3 | Script generates all 5 sections fully · Hooksmith returns 8+ hooks · Highlight detection identifies clips from transcript |
| Phase 4 | No unformatted model strings in API call sites · TTS and Imagen still function via direct APIs · OpenRouter dashboard shows activity for all 35+ features |

### Full Regression Checklist

- [ ] Script Generator: full script generates with all 5 sections populated
- [ ] Script TTS: audio synthesis still works (uses OpenAI direct — unaffected)
- [ ] RepurposeOS: file upload → highlight detection → clips list populated
- [ ] Browser extension: save, reply, remix all function on x.com
- [ ] SnipRadar scheduler: scheduled post goes through correctly
- [ ] Keyword Research: search returns results with opportunity scores
- [ ] Content Calendar: ideas generated with virality scores for date range
- [ ] Growth Planner: full plan rendered in UI

---

## B11. PRD Audit Issues Resolved by Migration

| Audit Finding | How Migration Resolves It |
|---|---|
| Model strings not in OpenRouter format | `MODEL_REGISTRY` uses verified, live OpenRouter IDs — all unformatted strings eliminated |
| No cost visibility across features | OpenRouter dashboard provides per-model, per-feature cost breakdown — optionally persist `costUsd` to `UsageLog` |
| No unified rate limit handling | `callLLM()` centralises retry logic and error normalisation — provider error codes abstracted away |
| Vendor lock-in per feature | Changing any model = one-line edit in `model-registry.ts` — no provider SDK refactoring |
| Extension Reply Assist high latency | `gemini-2.5-flash-lite` cuts estimated latency from 4–6s to ~1s inline |
| Multiple API keys to manage | Single `OPENROUTER_API_KEY` replaces all LLM provider keys |

---

## Summary

| Area | Decision |
|---|---|
| **Gateway** | OpenRouter — single key, OpenAI-compatible, 300+ models |
| **3 new files** | `openrouter-client.ts` · `model-registry.ts` · `llm.ts` |
| **T1 (fast/cheap)** | `google/gemini-2.5-flash-lite` — Reply Assist, captions, hooks, viral scoring |
| **T1-alt** | `openai/gpt-5-mini` — T1 fallback and OpenAI-preference tasks |
| **T2 (balanced)** | `anthropic/claude-haiku-4.5` — drafts, rewrites, titles, threads, virality |
| **T3 (premium)** | `anthropic/claude-sonnet-4.6` — scripts, style training, planning, audits |
| **T3-alt fallback** | `google/gemini-2.5-pro` — cheaper T3 fallback ($1.25/M vs $3/M) |
| **Stays direct** | ElevenLabs TTS · OpenAI TTS · Google Imagen · Google Veo |
| **Migration order** | Extension (P1) → SnipRadar (P2) → YouTube (P3) → Cleanup (P4) |
| **Timeline** | ~10–13 working days |
| **Expected savings** | 65–97% on high-frequency tasks · 55–65% on long-form tasks |

---

*Last updated: March 2026 · Companion to ViralSnipAI PRD v1.1*
*Model IDs verified against OpenRouter live catalog — always confirm at [openrouter.ai/models](https://openrouter.ai/models) before deploying*

---

# Part C — PRD Audit Execution Plan

> This execution plan translates the still-open Part A audit findings into a phase-wise delivery sequence. It excludes work already closed after the audit, such as Razorpay billing foundation, annual billing support, pricing-tier alignment, and baseline Privacy / Terms pages.

## C1. Current Baseline

### Already Addressed Since Part A

- Annual billing foundation now exists through Razorpay subscriptions
- Pricing tiers are aligned to `starter` / `creator` / `studio`
- Auth to billing flow is implemented
- Basic legal surfaces exist at `/privacy` and `/terms`
- Phase 1 operating-foundation artifacts now exist for:
  - FFmpeg runtime documentation
  - delivery-status taxonomy
  - privacy/compliance baseline
  - feature-flag lifecycle policy
- Phase 4 experience-standard artifacts now exist for:
  - responsive support matrix
  - accessibility baseline
  - performance budgets / SLAs
  - observability stack and alert ownership

### Partially Implemented

| Item | Current State | Gap Remaining |
|---|---|---|
| Privacy / compliance | PRD baseline, support doc, and public legal pages now exist | Enterprise/legal expansion is still future work if required |
| Plan / quota clarity | Billing tiers are centralized | Quota enforcement and user-facing limits are still spread across multiple feature paths |
| Onboarding | Activation checkpoints and funnel instrumentation now exist across creator and SnipRadar workflows | Deeper conversion analytics and benchmark reporting can expand later if needed |
| Feature flags | Registry and lifecycle policy now exist | Future feature gates outside `feature-flags.ts` should be folded into the same governance model |

### Fully Pending

- None from the original audit scope. Remaining work is now iterative hardening and future product expansion rather than missing core audit deliverables.

## C2. Execution Principles

1. Close **source-of-truth and operating-model gaps first**, then build UI and workflow polish on top of them.
2. Pair every PRD-only item with at least one **code or config artifact** where possible, so the plan does not become documentation-only theater.
3. Use one status language across docs and implementation:
   - `Scaffolded`
   - `Built`
   - `QA Complete`
   - `Production Ready`
   - `Deferred`
4. Treat cross-product items as platform work, not ecosystem-specific work, unless the requirement is truly isolated.

## C3. Phase Overview

| Phase | Focus | Primary Outcome | Est. Duration |
|---|---|---|---|
| Phase 1 | Operating foundation | PRD and architecture become deployable source of truth | 2–4 days |
| Phase 2 | Activation and telemetry | Clear activation metrics, onboarding instrumentation, and cost model | 3–5 days |
| Phase 3 | Operations UX | Unified user-facing activity / job status surface | 4–6 days |
| Phase 4 | Experience standards | Responsive support matrix, accessibility baseline, and performance / observability standards | Implemented |
| Phase 5 | Commercial hardening | Unified limits framework and Studio packaging definition | Implemented |
| Phase 6 | Workflow completion | Bulk Inbox actions and Content Calendar → RepurposeOS continuation | Implemented |

## C4. Phase-by-Phase Plan

### Phase 1 — Operating Foundation

**Goal:** remove ambiguity in how the platform is supposed to operate in production.

**Scope**
- Document the real FFmpeg execution path for RepurposeOS and adjacent media flows
- Add formal status taxonomy and release-readiness definitions
- Expand privacy / compliance spec beyond public legal pages
- Define feature-flag governance

**Deliverables**
- Update `docs/MASTER_PRD.md` with:
  - status taxonomy
  - privacy / compliance section
  - feature-flag governance section
- Update infrastructure docs with the actual FFmpeg execution path and failure model:
  - `docs/architecture/ARCHITECTURE.md`
  - `docs/REPURPOSE_OS_ARCHITECTURE_PRD.md`
- Add flag inventory and owner / removal policy notes tied to:
  - `apps/web/lib/feature-flags.ts`
  - `.env.example`

**Acceptance Criteria**
- PRD explicitly states where FFmpeg runs, what queue / worker path is used, and what happens on failure
- Every roadmap / feature status uses the same taxonomy
- Privacy section covers:
  - OAuth tokens
  - third-party AI providers
  - storage retention
  - deletion and account removal behavior
- Every feature flag has:
  - owner
  - default
  - kill-switch behavior
  - removal condition

**Dependencies**
- None. This phase should run first.

### Phase 2 — Activation, Funnel, and Cost Instrumentation

**Goal:** define and instrument what successful user activation actually means.

**Status:** Implemented

**Scope**
- Define one activation event per ecosystem
- Define the onboarding checklist and aha moment
- Add instrumentation to record funnel progress
- Add X API unit-economics model and guardrails

**Deliverables**
- PRD updates for:
  - activation event definitions
  - onboarding success metrics
  - X API cost model
- Code instrumentation across:
  - `apps/web/app/api/onboarding/route.ts`
  - `apps/web/lib/analytics/metrics.ts`
  - `apps/web/lib/snipradar/events.ts`
  - relevant first-value surfaces in SnipRadar and YouTube workflows
- Dashboard or internal metrics additions for:
  - onboarding started
  - onboarding completed
  - first content idea created
  - first script generated
  - first X account connected
  - first tracked account / reply assist / scheduled post

**Delivered in code**
- Activation source of truth and idempotent checkpoint logging in `apps/web/lib/analytics/activation.ts`
- Creator checkpoint instrumentation across signup, onboarding, content calendar, scripts, titles, and thumbnails
- SnipRadar checkpoint instrumentation across X connect, tracked accounts, reply assist, and scheduling workflows
- Dashboard activation summary UI in `apps/web/components/dashboard/activation-progress-card.tsx`
- SnipRadar activation and X API guardrail surface in `apps/web/components/snipradar/activation-card.tsx`
- X API cost model baseline in `apps/web/lib/snipradar/x-unit-economics.ts` and `docs/X_API_UNIT_ECONOMICS.md`

**Acceptance Criteria**
- Each ecosystem has:
  - activation event
  - aha moment
  - success threshold
  - drop-off checkpoints
- Instrumentation exists for all critical funnel steps
- X API cost model includes:
  - estimated calls per active user
  - heavy-feature thresholds
  - gating / packaging recommendations

**Dependencies**
- Phase 1 status definitions should be finalized first.

### Phase 3 — Unified Activity / Job Status Surface

**Goal:** give users one place to understand what the system is doing on their behalf.

**Status:** Implemented

**Scope**
- Design a common cross-product status vocabulary
- Add a user-facing activity feed / job center
- Pull in long-running and recent work from:
  - dashboard content generation
  - Repurpose ingest / processing
  - transcript jobs
  - SnipRadar scheduler / winner / audit actions where relevant

**Deliverables**
- Shared status model and UI spec
- New activity surface, likely as:
  - dashboard panel expansion, or
  - dedicated workspace page / sheet
- Normalized job states for background tasks

**Delivered in code**
- Shared normalized operations model in `apps/web/lib/activity-center.ts`
- Unified user-facing workspace page at `apps/web/app/(workspace)/activity/page.tsx`
- Shared UI surface in `apps/web/components/activity/activity-center-panel.tsx`
- Dashboard preview added to `apps/web/app/(workspace)/dashboard/page.tsx`
- Workspace navigation access from both ecosystems in `apps/web/components/layout/workspace-nav.tsx`
- Cross-product coverage for:
  - Creator Studio generation completions
  - RepurposeOS ingest, export, and voice translation work
  - transcript jobs
  - SnipRadar scheduler drafts, scheduler runs, profile audits, and research-index refreshes

**Likely Repo Surfaces**
- `apps/web/lib/analytics/metrics.ts`
- `apps/web/components/dashboard/recent-activity-list.tsx`
- `apps/web/app/(workspace)/dashboard/page.tsx`
- `apps/web/app/api/repurpose/ingest/[jobId]/route.ts`
- `apps/web/app/api/transcribe/jobs/route.ts`
- queue-related helpers under `apps/web/lib/*queue*.ts`

**Acceptance Criteria**
- Users can see:
  - what is queued
  - what is processing
  - what succeeded
  - what failed
  - what action to take next
- Background-task statuses use one shared vocabulary instead of feature-specific wording only

**Dependencies**
- Phase 1 status taxonomy
- Phase 2 instrumentation is helpful but not required to start

### Phase 4 — Experience Standards: Responsive, Accessibility, Performance, Observability

**Status:** Implemented

**Goal:** turn broad quality concerns into enforceable platform standards.

**Scope**
- Add mobile / responsive support matrix
- Define minimum accessibility baseline
- Define performance budgets / SLAs
- Define monitoring / observability stack

**Deliverables**
- PRD sections covering:
  - breakpoint support matrix
  - desktop-only exceptions
  - WCAG 2.1 AA baseline
  - key latency / job-time targets
  - monitoring stack and alert ownership
- Prioritized remediation list for highest-traffic surfaces:
  - marketing / pricing
  - dashboard
  - SnipRadar overview / create / inbox
  - key RepurposeOS entry flows

**Acceptance Criteria**
- Every major surface is labeled as:
  - mobile supported
  - mobile degraded
  - desktop only
- Accessibility section defines minimum compliance target and core checks
- Performance standards include at least:
  - API p50 / p95 targets for user-facing reads
  - job-time expectations for long-running tasks
- Observability section names:
  - error tracking
  - performance monitoring
  - product analytics

**Dependencies**
- None, but it fits best after Phase 1.

**Implemented artifacts**
- `apps/web/lib/platform/responsive-support-matrix.ts`
- `apps/web/lib/platform/accessibility-standards.ts`
- `apps/web/lib/platform/performance-standards.ts`
- `apps/web/lib/platform/observability-standards.ts`
- `docs/EXPERIENCE_STANDARDS.md`
- updates to `docs/MASTER_PRD.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/REPURPOSE_OS_ARCHITECTURE_PRD.md`

### Phase 5 — Commercial Hardening

**Goal:** make packaging, quotas, and enterprise value legible and enforceable.

**Scope**
- Unify limit language across pricing, dashboard, and feature gates
- Move toward one documented limits framework
- Fully define Studio tier

**Deliverables**
- Centralized limits matrix and documentation
- Reconciliation plan for:
  - `apps/web/lib/billing/plans.ts`
  - `apps/web/types/dashboard.ts`
  - feature-specific gating logic in routes / services
- Studio tier definition including:
  - seats
  - collaboration boundaries
  - admin controls
  - API / webhook entitlements
  - support level

**Acceptance Criteria**
- Users do not see conflicting messages about credits, quotas, or unlimited usage
- Studio is either:
  - fully defined, or
  - explicitly reduced in scope for v1
- Billing and product-limit language match

**Dependencies**
- Billing foundation is already in place

**Implementation Status**
- Shared commercial catalog now lives in `apps/web/lib/billing/commercial-model.ts`
- Pricing, billing, and dashboard usage derive from the same plan model through `apps/web/lib/billing/plans.ts`
- Route-level enforcement now uses reconciled entitlements for scripts, TTS, titles, thumbnails, content calendar, niche discovery, and competitor tracking
- Human-readable packaging reference added in `docs/COMMERCIAL_LIMITS_MATRIX.md`
- Studio is now defined as admin-managed team operations with API/webhook access and priority support, without claiming self-serve RBAC as GA

### Phase 6 — Workflow Completion

**Goal:** close the remaining product workflow gaps called out in the audit.

**Scope**
- Add Research Inbox bulk operations
- Add direct Content Calendar → RepurposeOS continuation where strategically relevant

**Deliverables**
- Bulk actions for Inbox:
  - bulk archive
  - bulk delete
  - bulk status / label updates
- Clear continuation action from Content Calendar into RepurposeOS entry flow

**Likely Repo Surfaces**
- `apps/web/app/(workspace)/snipradar/inbox/page.tsx`
- `apps/web/app/api/snipradar/inbox/route.ts`
- `apps/web/app/api/snipradar/inbox/[id]/route.ts`
- `apps/web/components/content-calendar/idea-detail-modal.tsx`
- related content-sync utilities

**Acceptance Criteria**
- Inbox supports multi-select and batch operations without forcing item-by-item cleanup
- Content ideas that are ready for downstream production can enter RepurposeOS in one intentional handoff

**Dependencies**
- None. This can be built after Phase 5, or partially in parallel if needed.

**Implementation Status**
- Research Inbox now supports:
  - multi-select
  - bulk archive / restore
  - bulk status updates
  - bulk label add / replace
  - bulk delete
- Content Calendar idea detail now includes a `Send to RepurposeOS` action that:
  - creates a repurpose project
  - routes into `/repurpose?projectId=...`
  - seeds ingest guidance from the original idea title, niche, description, and keywords

## C5. Recommended Execution Order

### Immediate Sequence

1. Phases 1–6 from the audit remediation plan are now implemented.
2. Treat future work as product hardening or roadmap expansion, not unresolved audit debt.
4. Phase 5 — Commercial Hardening
5. Phase 6 — Workflow Completion
6. Phase 4 — Experience Standards remediation pass across shipped surfaces

### Why This Order

- Phase 1 prevents the rest of the work from being built on ambiguous operating assumptions.
- Phase 2 gives the metrics needed to evaluate pricing, onboarding, and growth decisions.
- Phase 3 makes system behavior legible once instrumentation exists.
- Phase 5 should happen before broader pricing / packaging changes go live.
- Phase 6 closes concrete workflow gaps after platform decisions are settled.
- Phase 4 includes standards plus remediation; it benefits from knowing which surfaces are already committed.

## C6. Suggested Working Rhythm

- **Sprint 1**
  - Phase 1 complete
  - Phase 2 complete
- **Sprint 2**
  - Phase 3 complete
  - Phase 4 complete
- **Sprint 3**
  - Phase 5 complete
  - Phase 6 started
- **Sprint 4**
  - Phase 6 complete

## C7. What We Should Execute Next

If we proceed phase-by-phase from this point, the correct next build is:

**Phase 6 — Workflow Completion**

Start with this order:

1. Add Inbox bulk actions across archive, delete, and status updates
2. Add multi-select UX and batch endpoints so cleanup is not item-by-item
3. Add the deliberate Content Calendar → RepurposeOS continuation
4. Validate the handoff and activity surfaces now that phases 1–5 are in place

That sequence uses the new operating standards from Phases 1–5 so the final workflow gaps are closed on top of stable platform, telemetry, UX, and commercial foundations.
