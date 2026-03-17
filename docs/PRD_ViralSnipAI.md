# ViralSnipAI Product Requirements

## Overview
ViralSnipAI is an end-to-end SaaS workspace that compresses the lifecycle of turning long-form recordings into short-form, branded content. Users ideate hooks/scripts with Hooksmith, process video with RepurposeOS, and maintain consistent branding via the Brand Kit. The platform targets marketing and creator teams that need fast, repeatable repurposing without agency overhead.

## Personas
- **Content Lead** – Plans campaigns, requests hooks/scripts, approves exports.
- **Video Editor** – Uploads raw recordings, generates clips, tweaks captions.
- **Growth Marketer** – Configures brand kit, checks export readiness, downloads final assets.

## Core User Journeys
1. **Ideation (Hooksmith)**
   - Input: Topic, optional source URL, audience, tone.
   - Output: 8–10 hooks, selectable for script generation.
   - Follow-up: Save scripts to a project, edit/fine-tune, share with team.

2. **Repurposing (RepurposeOS)**
   - Input: Long-form video upload or recording.
   - Processing: Auto-detect highlight clips, build transcripts, burn captions.
   - Output: Preview clips, queue exports for different aspect ratios.

3. **Brand Governance (Brand Kit)**
   - Configure: Primary color, font, logo, caption style, watermark toggle.
   - Apply: Rendering pipeline applies watermark + caption styling on previews/exports.

4. **Visual Ideation (Imagen + Veo)**
   - Input: Text prompt (typed or via microphone), style hint, desired aspect ratio, optional reference image.
   - Processing: Google Nano Banana model renders 1–4 still variations; Veo 3.1 produces 6–30s cinematic clips with aspect ratio and duration controls.
   - Output: Downloadable assets for thumbnails, ads, social placements, and short-form video teasers.

## Functional Requirements
- **Auth**: Email magic link, Google OAuth, instant demo login.
- **Projects**: CRUD, attach scripts/assets/clips/exports.
- **AI**: Hook + script generation via OpenAI (mock fallback). Transcript via Whisper (mock optional).
- **Uploads**: Local disk in dev (`/uploads`), abstracted storage interface for S3.
- **Media processing**: FFmpeg utilities for clip slicing, subtitles burn-in, export presets.
- **Job queue**: In-memory queue that serializes renders in the app process.
- **Exports**: 1080p presets (9:16, 1:1, 16:9). Track status (`queued`, `processing`, `done`, `failed`).
- **Testing**: Playwright smoke flows (demo auth and end-to-end repurpose pipeline).

## Non-Functional Requirements
- **Performance**: Clip detection + caption generation return within a few seconds for demo assets.
- **Reliability**: Queue retries on failure (manual re-queue). Exports stored atomically.
- **Security**: Auth-protected APIs, user-specific data isolation.
- **DX**: pnpm workspace, Prisma schema, seed script, Husky pre-commit, ESLint/Prettier.
- **Deployability**: Variables defined via `.env`. Storage driver switchable. MySQL via Docker Compose.

## Acceptance Criteria
1. `pnpm dev` boots → landing page accessible, demo login flows to dashboard.
2. Users can create project, upload video, get transcript (mock), and auto-generate clips.
3. Hooksmith produces hooks + saves script to project.
4. Captions generate and preview clip updates with burn-in.
5. Export queue produces mp4 in `/uploads/exports` with status `done` and watermark if configured.
6. Brand kit updates reflect in future previews/exports.
7. README documents setup, storage, troubleshooting.
