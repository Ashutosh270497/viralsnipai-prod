# ViralSnipAI Product Requirements

## Overview

ViralSnipAI is an AI creator SaaS platform for turning long-form video into short-form clips. The core workflow is:

1. Add a video source.
2. Choose clip goals.
3. Generate AI-ranked clips.
4. Review and edit clips.
5. Export platform-ready assets.

The product is built for creators, podcasters, founders, educators, agencies, and content teams that need repeatable short-form output without exposing internal model or rendering complexity.

## Current Product Scope

- AI clip discovery from uploaded long-form video/audio.
- OpenAI transcription for timing and word timestamps.
- Local candidate generation and boundary refinement.
- OpenRouter reasoning for reranking, virality scoring, metadata, caption intelligence, and prompt suggestions.
- Transcript-based clip editing.
- Caption generation, cleanup, translation, styling, and burn-in.
- Reframe/layout tools for 9:16, 1:1, 16:9, 4:5, and source/original formats.
- Export center with platform presets and high-quality render policy.
- Brand templates for reusable caption/layout/watermark/export defaults.
- Review/share foundations for agency/client approval.
- Social publishing foundation with mock/placeholder adapters unless real credentials are configured.
- Public API, API keys, workspace/team foundation, feedback, and quality analytics.

## Primary Personas

- Creator: turns podcasts, interviews, and tutorials into short clips.
- Agency editor: prepares branded clips for many clients.
- Founder/marketer: converts webinars, demos, and thought-leadership videos into distribution assets.
- Reviewer/client: reviews clips through share links and approves or comments.

## Key User Journeys

### Create Clips

1. User uploads a video or imports a supported source.
2. User selects clip length, count, intent, and optional creative direction.
3. ViralSnipAI transcribes the source, generates local candidates, reranks candidates, refines boundaries, creates previews, and stores analytics.
4. User reviews generated clips, previews them, approves/rejects, and edits as needed.

### Edit Clip

1. User selects a clip.
2. User previews the clip.
3. User edits transcript, captions, style, layout, or enhancements.
4. User saves changes and marks the clip export-ready.

### Export

1. User selects approved/export-ready clips.
2. User chooses platform preset, aspect ratio, captions, and export options.
3. Final MP4 renders from the original source asset, never from a preview file.

### Brand Templates

1. User creates a reusable brand template.
2. Template can apply caption style, layout preset, watermark/logo, CTA, overlays, and export defaults.
3. Default templates apply to future generated clips.

### Review And API

1. User shares token-protected review links.
2. Reviewer can view, comment, approve, or reject according to permission.
3. API users can create projects, upload assets, generate clips, inspect jobs/clips, and queue exports.

## Non-Functional Requirements

- Provider boundaries must stay explicit.
- Normal users must not see raw model IDs.
- Final clip timestamps must be locally owned.
- Old clips/projects must remain readable.
- Preview quality and final export quality must be separated.
- Final exports must render from original source media.
- Missing thumbnails/previews/metadata must degrade gracefully.
- UX should hide technical detail by default and expose it through debug/advanced panels.

## Validation References

- [Prelaunch QA](./VIRALSNIPAI_PRELAUNCH_QA.md)
- [Clip Flow QA](./VIRALSNIPAI_CLIP_FLOW_QA.md)
- [OpenRouter Model Routing](./OPENROUTER_MODEL_ROUTING.md)
- [Video Quality Policy](./VIDEO_QUALITY_POLICY.md)
- [Public API v1](./api/VIRALSNIPAI_PUBLIC_API_V1.md)
