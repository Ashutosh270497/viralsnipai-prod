# ViralSnipAI Launch Versions

Last updated: 2026-04-25

## Positioning

ViralSnipAI turns long videos into viral-ready short clips with AI hooks, captions, and branded exports.

The product is intentionally split into V1, V2, and V3 so launch stays focused. Existing code is not deleted; non-launch modules are hidden behind feature flags until they are ready.

## Feature Flag Source Of Truth

Central config:

- `apps/web/config/features.ts`

Primary launch flags:

```env
NEXT_PUBLIC_V1_CORE_ENABLED=true
NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false
NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false
```

Production default:

- V1 is enabled.
- V2 is disabled.
- V3 is disabled.

## V1 Launch Scope

V1 is the focused AI video repurposing product.

Included:

- Landing page
- Auth
- Onboarding
- Dashboard
- Projects
- Create Clip workflow
- Video upload
- AI clip detection
- Caption generation and editing
- Brand Kit
- Export/download
- Billing with free/plus/pro packaging direction
- Basic usage limits
- Settings

Visible V1 sidebar:

- Dashboard
- Projects
- Create Clip
- Exports
- Brand Kit
- Billing
- Settings

## Why V1 Is Focused Only On Video Repurposing

The current codebase contains several strong but broad product directions. Launching all of them at once would create a confusing first impression, more QA surface, and higher provider/integration risk.

V1 focuses on one buyer promise:

> Upload a long video and leave with branded, captioned short clips ready to publish.

This scope is easier to explain, easier to test, and easier to monetize. It also keeps the main workflow close to the product positioning instead of spreading attention across creator research, X automation, and advanced media generation before the core loop is stable.

## V2 Roadmap

V2 adds creator growth tools around the core clip workflow.

Planned V2 modules:

- Viral hook generator per clip
- Platform caption generator
- Clip ranking dashboard
- Content calendar
- YouTube title generator
- Thumbnail ideas
- Basic creator analytics

Feature group:

```env
NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=true
```

Optional individual overrides:

```env
NEXT_PUBLIC_FEATURE_VIRAL_HOOK_GENERATOR_ENABLED=true
NEXT_PUBLIC_FEATURE_PLATFORM_CAPTION_GENERATOR_ENABLED=true
NEXT_PUBLIC_FEATURE_CLIP_RANKING_DASHBOARD_ENABLED=true
NEXT_PUBLIC_FEATURE_CONTENT_CALENDAR_ENABLED=true
NEXT_PUBLIC_FEATURE_YOUTUBE_TITLE_GENERATOR_ENABLED=true
NEXT_PUBLIC_FEATURE_THUMBNAIL_IDEAS_ENABLED=true
NEXT_PUBLIC_FEATURE_BASIC_CREATOR_ANALYTICS_ENABLED=true
```

## V3 Roadmap

V3 adds the broader automation operating system.

Planned V3 modules:

- SnipRadar
- X automation
- Auto scheduling
- Competitor tracking
- Relationship CRM
- API/webhooks
- Imagen
- Veo
- Voice cloning
- Advanced analytics
- Advanced automation

Feature group:

```env
NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=true
```

Optional individual overrides:

```env
NEXT_PUBLIC_FEATURE_SNIPRADAR_ENABLED=true
NEXT_PUBLIC_FEATURE_X_AUTOMATION_ENABLED=true
NEXT_PUBLIC_FEATURE_AUTO_SCHEDULING_ENABLED=true
NEXT_PUBLIC_FEATURE_COMPETITOR_TRACKING_ENABLED=true
NEXT_PUBLIC_FEATURE_RELATIONSHIP_CRM_ENABLED=true
NEXT_PUBLIC_FEATURE_API_WEBHOOKS_ENABLED=true
NEXT_PUBLIC_FEATURE_IMAGEN_ENABLED=true
NEXT_PUBLIC_FEATURE_VEO_ENABLED=true
NEXT_PUBLIC_FEATURE_ADVANCED_AUTOMATION_ENABLED=true
NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS_ENABLED=true
NEXT_PUBLIC_FEATURE_VOICE_CLONING_ENABLED=true
```

## Hidden In V1

These modules stay hidden by default during V1:

- SnipRadar
- X automation
- Auto scheduling
- Competitor tracking
- Relationship CRM
- API/webhooks
- Imagen
- Veo
- Keyword research
- Advanced analytics
- Voice cloning
- Content calendar
- YouTube title generator
- Thumbnail ideas
- Standalone creator-growth surfaces

## Implementation Rules

- Do not delete non-V1 code just to simplify launch.
- Gate non-V1 navigation and entry points through `apps/web/config/features.ts`.
- Existing routes should remain safe if accessed directly while hidden.
- New V2/V3 work must declare a launch-version feature name before it appears in navigation.
- Production env should keep V2/V3 group flags false until the corresponding release is intentionally activated.

