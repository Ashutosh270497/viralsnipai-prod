# Keyword Research Upgrade PRD (Creator-First, Cost-Efficient)

> Status: Draft for review and execution  
> Date: February 18, 2026  
> Product: Clippers (`/keywords`)

---

## 1. Objective

Build a production-grade Keyword Research system for creators that:
- produces trustworthy keyword opportunities (not vanity numbers),
- converts research directly into content actions,
- supports India-first localization and multilingual creators,
- remains materially cheaper than enterprise SEO tools while preserving quality.

---

## 2. Current Baseline in Codebase

Current implementation already has a strong foundation:
- Orchestrator and provider abstraction:
  - `apps/web/lib/keywords/keyword-research-orchestrator.ts`
  - `apps/web/lib/keywords/providers/interfaces.ts`
- Discovery and metrics providers:
  - `apps/web/lib/keywords/providers/youtube-discovery.provider.ts`
  - `apps/web/lib/keywords/providers/dataforseo-demand.provider.ts`
  - `apps/web/lib/keywords/providers/dataforseo-trend.provider.ts`
  - `apps/web/lib/keywords/providers/heuristic-competition.provider.ts`
- Localization:
  - `apps/web/lib/keywords/localization.ts`
- APIs/UI:
  - `apps/web/app/api/keywords/search/route.ts`
  - `apps/web/app/api/keywords/recommendations/route.ts`
  - `apps/web/app/(workspace)/keywords/page.tsx`

What this means: architecture is good; the main upgrade now is data depth, ranking quality, explainability, and workflow conversion.

---

## 3. External Benchmark Learnings (Online Research)

Top SaaS behavior patterns:
- Google Ads API is the canonical base for search demand and competition metrics.
- Ahrefs differentiates via clickstream-informed demand modeling and “searches vs clicks” understanding.
- Semrush differentiates with very large databases, intent layers, and workflow depth.
- vidIQ/Tubebuddy creator adoption comes from immediate, workflow-native scoring and guidance.

Implication for Clippers:
- We should not compete on “largest database.”
- We should compete on “fastest path from keyword -> publish-ready creator assets” with transparent confidence.

---

## 4. Product Principles

1. **Trust over false precision**
- Always expose source + confidence + freshness.

2. **Action over dashboards**
- Every keyword result must have “what to make next” output.

3. **Localization by design**
- English, Hinglish, Hindi and region-aware ranking logic.

4. **Cost-aware architecture**
- Progressive enrichment and caching to protect margins.

5. **Closed-loop learning**
- Improve recommendation quality using actual post outcomes.

---

## 5. Target Architecture (Industry Grade)

## 5.1 Pipeline

1. Input Layer
- Seed keyword or creator content context.
- Locale context (`country`, `language`, script detection).

2. Discovery Layer
- YouTube search/autocomplete expansions.
- Related variants and question expansions.

3. Metrics Layer
- Demand/volume (DataForSEO Google Ads).
- Trend signal (DataForSEO Trends + fallback).
- Competition signal (current heuristic, then calibrated model).

4. Intelligence Layer
- Intent classification.
- Topic clustering and semantic families.
- Platform fit scoring (`youtube`, `x`, `instagram`).
- Creator-fit and repurpose-readiness scoring.

5. Activation Layer
- One-click actions into title/script/thumbnail/draft workflows.
- Save to lists and campaign bundles.

6. Feedback Layer
- Collect downstream performance and retrain ranking features.

## 5.2 Data Contracts

Every response should include:
- `keyword`
- `demand` (volume + source + confidence)
- `trend`
- `competition`
- `opportunityScore`
- `platformFit`
- `repurposeReadinessScore`
- `intent`
- `clusterId/clusterName`
- `explainability` (top factors)
- `freshnessTimestamp`

---

## 6. Scoring Model v2

Current formula is good baseline; upgrade to weighted explainable scoring:

`Opportunity = f(Demand, Trend, CompetitionInverse, PlatformFit, CreatorFit, ContentGap, ConfidencePenalty)`

Recommended default weights:
- Demand: 0.22
- Trend: 0.15
- Competition Inverse: 0.20
- Platform Fit: 0.18
- Creator Fit: 0.15
- Content Gap: 0.10

Confidence penalty:
- If source confidence is medium/low, apply capped penalty and show warning.

Output must include factor contribution percentages for transparency.

---

## 7. UX Requirements

## 7.1 Result Experience
- Show 3 tabs:
  - `Opportunities`
  - `Clusters`
  - `Action Plan`
- Each keyword card includes:
  - score,
  - why it scored high/low,
  - “Create title/script/thread from this.”

## 7.2 Creator-Centric Simplicity
- Convert complex metrics into:
  - Demand: Low/Med/High + numeric,
  - Competition: Easy/Medium/Hard,
  - Trend: Rising/Stable/Falling,
  - Best Platform: YouTube/X/Instagram with confidence.

## 7.3 Explainability
- Must show:
  - source (`DataForSEO`, `YouTube API`, fallback),
  - data freshness,
  - confidence label.

---

## 8. Pricing Strategy (Go-to-Market)

Positioning:
- “Creator growth intelligence, not enterprise SEO bloat.”

Packaging recommendation:
1. Free
- limited searches/day,
- limited saved lists,
- no bulk exports.

2. Creator Pro ($19-$39/mo target band)
- high monthly searches,
- clustering,
- opportunity scoring,
- action generation.

3. Studio ($79-$149/mo target band)
- team seats,
- bulk APIs,
- advanced trend alerts,
- workspace integrations.

Cost control:
- 7-day cache for discovery outputs,
- 30-day cache for demand,
- 24-hour cache for trend,
- batch provider calls,
- enrich top-ranked subset only.

---

## 9. Execution Plan (Phased)

## Phase 1: Discovery Depth and Data Freshness (1-1.5 weeks)
- Add richer expansion strategies (question, intent, alphabet soup).
- Add freshness stamps and cache policy by signal type.
- Add quotas/guardrails and partial-response handling.

Deliverables:
- Expanded keyword graph generation.
- `freshnessTimestamp` + cache metadata in APIs.

## Phase 2: Scoring v2 + Explainability (1 week)
- Implement weighted scoring model with factor attribution.
- Add confidence penalty and clearer warnings.

Deliverables:
- `scoreBreakdown` in response payload.
- Updated UI explanation cards.

## Phase 3: Cluster Intelligence + Workflow Activation (1-1.5 weeks)
- Build cluster pages and “keyword packs.”
- Add one-click handoff to title/script/thumbnail/X draft generators.

Deliverables:
- Cluster-first UI and action buttons.
- Persisted campaign/list management.

## Phase 4: Closed-Loop Learning (1.5-2 weeks)
- Ingest downstream post performance across connected modules.
- Compute creator-fit features from outcomes.
- Retrain ranking heuristics on rolling windows.

Deliverables:
- `creatorFit` and `feedbackWeight` in scoring.
- Performance-informed recommendations endpoint update.

## Phase 5: Reliability/Scale Hardening (1 week)
- Latency budgets and p95 dashboards.
- Queueing for heavy research requests.
- Background refresh for hot keywords.

Deliverables:
- SLOs + alerts,
- resilience tests,
- load-tested read path.

## Phase 6: Monetization + Packaging (0.5-1 week)
- Plan limits and credit policy.
- Usage metering and paywall integration.
- GTM-ready pricing table and in-product upgrade prompts.

Deliverables:
- SKU-gated features,
- usage analytics,
- upgrade funnel events.

---

## 10. Engineering Standards

- Contract validation with Zod for all keyword endpoints.
- Idempotent writes for saved keywords and recommendation snapshots.
- Cursor pagination for large result sets.
- Structured logs with request IDs and provider timing.
- Feature flags for phased rollout and safe deploy.

---

## 11. Success Metrics

Product KPIs:
- Keyword -> content action conversion rate.
- 7-day creator retention on keyword workflow.
- % of recommendations that reach publish flow.
- Recommendation acceptance rate.

Quality KPIs:
- p95 API latency for `/api/keywords/search` and `/api/keywords/recommendations`.
- Provider failure fallback success rate.
- Confidence-to-outcome calibration error.

Business KPIs:
- COGS per 1,000 keyword analyses.
- Free -> paid conversion from keyword feature usage.
- ARPU uplift among users who use keyword + creation workflows.

---

## 12. Risks and Mitigations

Risk: Over-reliance on one external provider.  
Mitigation: Keep provider abstraction, maintain fallback providers, and track confidence.

Risk: Users distrust numbers.  
Mitigation: Expose source/freshness/confidence and explain score factors.

Risk: Cost spikes with bulk usage.  
Mitigation: progressive enrichment, batching, and cache tiers.

Risk: Feature becomes “another SEO tool.”  
Mitigation: keep workflow integration as primary product differentiator.

---

## 13. Definition of Done (PRD Complete State)

1. Users can discover high-quality keyword opportunities with transparent confidence.
2. Users can convert opportunities to content actions in one click.
3. Recommendations improve over time using real performance data.
4. System meets performance and reliability targets under expected load.
5. Feature supports creator-friendly pricing with healthy backend margins.

---

## 14. Reference Sources (Online)

- Google Ads API: Keyword Planning overview  
  https://developers.google.com/google-ads/api/docs/keyword-planning/overview
- Google Ads API: Generate historical metrics  
  https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics
- YouTube Data API: `search.list`  
  https://developers.google.com/youtube/v3/docs/search/list
- DataForSEO Google Ads Search Volume endpoint  
  https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/
- DataForSEO Google Ads pricing  
  https://dataforseo.com/pricing/keywords-data/google-ads
- DataForSEO Trends API pricing  
  https://dataforseo.com/pricing/keywords-data/dataforseo-trends-api-pricing
- Ahrefs KD metric explanation  
  https://help.ahrefs.com/en/articles/72265-what-does-kd-stand-for-in-keywords-explorer
- Ahrefs Clicks metric explanation  
  https://help.ahrefs.com/en/articles/624151-what-does-clicks-stand-for-in-keywords-explorer
- Semrush Keyword Overview KB  
  https://www.semrush.com/kb/257-keyword-overview
- vidIQ Keyword Research help  
  https://support.vidiq.com/en/articles/9421214-keywords-research

