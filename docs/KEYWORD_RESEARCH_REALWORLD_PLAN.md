# Keyword Research: Real-World Hardening Plan

## Objective
Build a production-grade keyword research system for ViralSnipAI that is reliable, transparent, and uniquely tied to the repurposing workflow.

## Current Phase 1 (implemented now)
- Added locale-aware query input (`country`, `language`) in keyword search flow.
- Added data quality metadata (`source`, `confidence`, `warnings`) to responses.
- Added production-safe behavior:
  - No silent fake/mock data fallback in production.
  - Returns explicit 503 provider-unavailable errors instead.
- Added UI visibility for source and warnings so users can trust what they are seeing.

## Gaps to solve next
1. Replace YouTube `totalResults` proxy with true demand metrics provider.
2. Add trend provider and trend-aware scoring.
3. Add confidence scoring by source completeness.
4. Add platform-specific keyword outputs (YouTube, Instagram, X).
5. Add closed-loop performance feedback from posted content.

## Phase 2: Provider Abstraction
Create provider interfaces:
- `KeywordDiscoveryProvider`
- `KeywordVolumeProvider`
- `KeywordTrendProvider`
- `KeywordCompetitionProvider`

Implement a unified service:
- `KeywordResearchOrchestrator`
- merges provider results,
- computes normalized metrics,
- stores source-level provenance.

### Phase 2 status (implemented)
- Added provider contracts under `apps/web/lib/keywords/providers/interfaces.ts`.
- Added default providers:
  - `YouTubeDiscoveryProvider`
  - `YouTubeProxyDemandProvider`
  - `ProxyTrendProvider`
  - `HeuristicCompetitionProvider`
- Added orchestrator:
  - `apps/web/lib/keywords/keyword-research-orchestrator.ts`
- Refactored `POST /api/keywords/search` to use orchestrator rather than inline logic.
- Preserved API compatibility while adding explicit source/provenance metadata.

## Phase 3: India-First Localization
- Regional/language routing by market.
- Hinglish/Hindi keyword normalization.
- Script-aware deduplication and clustering.
- Region-specific opportunity scoring.

### Phase 3 status (implemented)
- Added locale utilities in `apps/web/lib/keywords/localization.ts`:
  - script detection,
  - locale-aware normalization,
  - locale variant generation,
  - dedupe + keyword root clustering.
- Orchestrator now produces localization metadata and related keyword clusters.
- Added region-aware opportunity boost logic in competition provider:
  - India + Hindi scenarios get localized weighting.
- API now returns localization fields and cluster data while preserving prior contract.
- Workspace keyword UI now surfaces locale context and quality warnings.

## Phase 4: ViralSnipAI Moat
- Learn from your own outcomes:
  - keyword -> generated asset -> published post -> real performance.
- Build creator-specific recommendations:
  - winning intent + format + platform combinations.
- Add "Repurpose Readiness" score to prioritize easiest high-impact keyword opportunities.

### Phase 4 status (implemented - foundation)
- Added personalized recommendation endpoint:
  - `GET /api/keywords/recommendations`
- Recommendation engine now learns from each user’s keyword history:
  - performance-weighted keyword scoring,
  - dominant intent detection,
  - high-signal token extraction,
  - candidate generation from historical related keywords + pattern expansions,
  - locale-aware variant expansion and dedupe.
- Added creator-profile output metadata:
  - confidence level,
  - dominant intent,
  - pattern tokens,
  - locale context.
- Added workspace UI integration:
  - "Personalized Opportunities" loader,
  - scored keyword recommendations with rationale + seed provenance.

### Remaining moat steps
- Connect recommendations to actual post-publish performance from X/YouTube integrations.
- Add repurpose-readiness scoring tied to script/title/thumbnail workflows.
- Introduce platform-specific recommendation heads (YouTube vs X vs Instagram).

### Phase 4 status (advanced update)
- Added real outcome signal ingestion in recommendations:
  - reads posted draft performance (`actualImpressions`, likes, retweets, replies),
  - converts outcomes into weighted token signals,
  - blends those with keyword history patterns.
- Added cross-platform readiness outputs in keyword analysis:
  - `platformFit` scores (`youtube`, `x`, `instagram`),
  - `repurposeReadinessScore`.
- Added provider auto-selection for demand + trend:
  - uses DataForSEO providers when credentials exist,
  - gracefully degrades to proxy providers with explicit warnings when unavailable.

## Required env for real provider mode
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`

Without these, the system remains functional using transparent proxy fallbacks.

## Product UX Principles
- Always show source and freshness.
- Never show silent synthetic numbers in production.
- Prefer directional confidence over false precision.
- Keep creator-facing metrics simple:
  - demand,
  - competition,
  - trend,
  - platform fit,
  - opportunity.

## Suggested Delivery Order
1. Provider abstraction + stable contracts.
2. Volume/trend provider integration.
3. New scoring model and confidence bands.
4. Platform-specific recommendations.
5. Closed-loop optimization.
