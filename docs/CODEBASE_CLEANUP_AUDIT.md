# Codebase Cleanup Audit

Audit date: 2026-05-10

Scope: audit-only. No source code was deleted, moved, renamed, or refactored as part of this report.

## 1. Executive Summary

The repository contains a working ViralSnipAI V1 flow, plus several secondary product areas, older UI surfaces, migration utilities, QA scripts, and legacy AI helpers. Static tools report many unused files, but a large portion of that output is false-positive noise from Next.js app routes, dynamic route exports, tests, scripts, and secondary routable products.

Summary:

| Metric | Result |
| --- | --- |
| Strong safe-delete candidates | 14 |
| Dependency cleanup candidates reviewed | 16 |
| Quarantine / owner confirmation candidates | 20+ groups |
| DI bindings with unknown active route usage | 6 bindings |
| Circular dependencies found | 1 |
| Production risk level | Medium |
| Cleanup confidence level | High for Batch 1 only; medium/low for product-area removals |

Command results observed:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm dlx knip --production --include files,dependencies,devDependencies,exports,types,duplicates` | Failed with findings | Knip could not fully load `apps/web/jest.config.js` because Next expected an app/pages directory from the config context. It still reported many candidates. Treat output as advisory only. |
| `pnpm dlx ts-prune` | Passed with large output | Reported many false positives for Next.js routes, configs, tests, and exports. Useful for spotting orphan helpers only. |
| `pnpm dlx depcheck` | Failed with findings | Root depcheck flagged `inversify` and `reflect-metadata` as unused, but web imports them. Web depcheck also found unused packages and missing `k6`/DI deps due workspace placement. |
| `pnpm dlx madge apps/web --extensions ts,tsx --ts-config apps/web/tsconfig.json --circular` | Failed | Found one circular dependency: `lib/ffmpeg.ts > lib/media/source-quality-analysis.ts`. |
| `pnpm --filter web build` | Passed | Same lint hook warnings and fluent-ffmpeg dynamic require warning. |
| `pnpm --filter web lint` | Passed | Warnings only. |
| `pnpm --filter web run repurpose:boundary-check` | Passed | Provider boundary check passed after rerun outside sandbox restriction. |
| `pnpm --filter web test:unit` | Failed | 8 suites failed, mostly stale tests/mocks and environment issues. Details are in Section 11. |

Recommended cleanup approach:

1. Start with Batch 1 only: generated metadata, orphan old repurpose components, and unused internal type exports.
2. Run validation after every small deletion batch.
3. Do not delete SnipRadar, browser extension, translation/voice/composite services, or secondary product routes until product ownership is confirmed.
4. Fix stale tests before relying on test output as a cleanup gate.
5. Separate active ViralSnipAI V1 architecture from legacy/secondary feature architecture before deeper removals.

## 2. Safe To Delete Candidates

Only include these if the team accepts the listed validation command immediately after deletion.

| path | type | reason | proof | risk level | validation command required after deletion |
| --- | --- | --- | --- | --- | --- |
| `apps/web/public/.DS_Store` | file | macOS Finder metadata, not an application asset. | Static metadata file under `public`; not imported or referenced. | Low | `pnpm --filter web build` |
| `apps/web/public/uploads/.DS_Store` | file | macOS Finder metadata inside runtime uploads area. | Static metadata file; runtime upload paths must stay, but `.DS_Store` is not needed. | Low | `pnpm --filter web build` |
| `packages/jobs/dist/tsconfig.tsbuildinfo` | file | Generated TypeScript incremental build metadata. | Package source is `packages/jobs/src/index.ts`; build info is not source. | Low | `pnpm --filter web build` |
| `packages/types/dist/tsconfig.tsbuildinfo` | file | Generated TypeScript incremental build metadata. | Package source is `packages/types/src/index.ts`; build info is not source. | Low | `pnpm --filter web build` |
| `packages/jobs/package.json` dependency `@clippers/types` | dependency | `packages/jobs` does not import `@clippers/types`. | `rg "@clippers/types" packages/jobs` returns only package metadata. | Low | `pnpm install && pnpm --filter web build` |
| `packages/types/src/index.ts` export `HookGenerationPayload` | export | No repo usage found. | `rg "HookGenerationPayload"` only finds declaration. | Low-Medium | `pnpm --filter web build && pnpm --filter web test:unit` |
| `packages/types/src/index.ts` export `ScriptGenerationPayload` | export | No repo usage found. | `rg "ScriptGenerationPayload"` only finds declaration. | Low-Medium | `pnpm --filter web build && pnpm --filter web test:unit` |
| `packages/types/src/index.ts` export `HighlightGenerationPayload` | export | No repo usage found. | `rg "HighlightGenerationPayload"` only finds declaration. | Low-Medium | `pnpm --filter web build && pnpm --filter web test:unit` |
| `packages/types/src/index.ts` export `CaptionGenerationPayload` | export | No repo usage found. | `rg "CaptionGenerationPayload"` only finds declaration. | Low-Medium | `pnpm --filter web build && pnpm --filter web test:unit` |
| `apps/web/components/repurpose/repurpose-sub-nav.tsx` | file | Old repurpose navigation component appears orphaned after 5-stage UX refactor. | `rg "RepurposeSubNav|repurpose-sub-nav"` finds only the component file. | Low-Medium | `pnpm --filter web build && pnpm --filter web lint` |
| `apps/web/components/repurpose/clip-list.tsx` | file | Old large drag/drop clip list appears replaced by current editor/review UI. | `rg "ClipList|components/repurpose/clip-list"` finds only the component file. | Medium | `pnpm --filter web build && pnpm --filter web lint && pnpm --filter web test:unit` |
| `apps/web/components/repurpose/caption-editor-dialog.tsx` | file | Only used by the old `clip-list.tsx`. | `rg "CaptionEditorDialog|caption-editor-dialog"` finds only itself plus `clip-list.tsx`. | Medium | Delete with `clip-list.tsx`, then run `pnpm --filter web build && pnpm --filter web lint` |
| `apps/web/hooks/use-export-progress.ts` | file | No imports found. | `rg "useExportProgress|use-export-progress"` finds only the hook file. | Low-Medium | `pnpm --filter web build && pnpm --filter web lint` |
| `apps/web/hooks/use-progress-tracker.ts` | file | No imports found. | `rg "useProgressTracker|use-progress-tracker"` finds only the hook file. | Low-Medium | `pnpm --filter web build && pnpm --filter web lint` |

Do not include `apps/web/lib/upload-serving/range-request.ts` in this list. Although knip flagged it, it is actively imported by `apps/web/app/api/uploads/[...path]/route.ts`.

## 3. Keep - Active Production Code

| path | why it must stay | active feature depending on it |
| --- | --- | --- |
| `packages/jobs` | Render/ingest queues import `enqueueRender` and `processJobs`. | Render queue, YouTube ingest queue, voice translation queue. |
| `packages/types/src/index.ts` export `EXPORT_PRESETS` | Used by the repurpose export panel. | Export preset UI. |
| `packages/types/src/index.ts` export `HighlightSuggestion` | Still imported by legacy direct Gemini/OpenAI helper paths. | Legacy AI helper compatibility; quarantine before deleting. |
| `apps/web/lib/ai/model-policy.ts` | Active internal model routing for clip generation and prompt helper. | Fast/Balanced/Best Quality routing. |
| `apps/web/lib/ai/providers/openai-transcription-provider.ts` | Required provider boundary: OpenAI transcription/timing only. | Source transcription and word timestamps. |
| `apps/web/lib/ai/providers/openrouter-reasoning-provider.ts` | Required provider boundary: OpenRouter reasoning only. | Reranking, virality, metadata, prompt helper. |
| `apps/web/scripts/repurpose-provider-boundary-check.ts` | Prevents provider boundary regressions. | Required prelaunch QA. |
| `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` | Main clipping pipeline orchestration. | Source -> Goals -> Generate. |
| `apps/web/lib/domain/services/ClipCandidateGenerationService.ts` | Local candidate timestamp generation. | V1 clip generation. |
| `apps/web/lib/domain/services/ClipRerankingService.ts` | OpenRouter candidate reranking with local timestamp ownership. | V1 clip quality. |
| `apps/web/lib/domain/services/ClipBoundaryRefinementService.ts` | Local deterministic final boundary refinement. | V1 clip accuracy. |
| `apps/web/lib/ffmpeg.ts` | Core preview/export/rendering helpers. | Preview generation, thumbnails, exports. |
| `apps/web/lib/media/source-quality-analysis.ts` | Source quality and render-mode selection. | Low-quality warning and blur-background mode. |
| `apps/web/lib/media/video-quality-policy.ts` | Prevents preview settings from being used as final export settings. | Export quality safety. |
| `apps/web/app/api/uploads/[...path]/route.ts` | Authenticated upload serving with range support. | Preview MP4 loading, thumbnails, downloads. |
| `apps/web/lib/upload-serving/range-request.ts` | Used by upload serving route and tested. | HTTP Range parsing/path safety. |
| `apps/web/public/service-worker.js` | Prevents repeated `/service-worker.js` 404s. | Browser/runtime polish. |
| `apps/web/components/repurpose/safe-thumbnail-image.tsx` | Prevents Next Image fill/style runtime crashes on old thumbnails. | Old clip compatibility. |
| `apps/web/components/repurpose/source-quality-notice.tsx` | User-facing source quality warning. | Editor/review/export UX. |
| `apps/web/components/repurpose/use-clip-update-queue.ts` | Prevents stale-version 409 conflicts. | Editor save/caption/preview stability. |
| `apps/web/components/repurpose/ai-prompt-generator-dialog.tsx` | Active optional goal suggestion UX. | Goals screen prompt helper. |
| `apps/web/components/repurpose/create-clip-wizard.tsx` | Active 5-stage Source -> Goals -> Generate -> Review -> Export UI. | V1 launch flow. |
| `apps/web/app/(workspace)/repurpose/editor/page.tsx` | Active clip editor route. | Review/Edit workflow. |
| `apps/web/app/(workspace)/repurpose/export/page.tsx` | Active export center route. | Export queue/final render. |
| `apps/web/lib/render-queue.ts` | Active queue adapter around `@clippers/jobs`. | Final export jobs. |
| `apps/web/app/api/repurpose/captions/route.ts` | Active caption generation endpoint. | Captions tab/editor. |
| `apps/web/app/api/clips/[id]/route.ts` | Active clip update endpoint with optimistic locking. | Editor save/review status. |

## 4. Quarantine / Needs Owner Confirmation

These areas look stale relative to the ViralSnipAI V1 launch path, but they are not safe to delete without owner confirmation because they are still routable, scripted, imported, or plausibly roadmap work.

| path | why it looks stale | why it may still be needed | exact question to ask owner | recommended action |
| --- | --- | --- | --- | --- |
| `apps/web/app/(workspace)/snipradar` | Separate product surface outside ViralSnipAI clip flow. | It is routable and built; feature flags and scripts exist. | Is SnipRadar part of this product launch, a V2 module, or a separate product to remove? | Quarantine as secondary product until owner decides. |
| `apps/web/app/api/snipradar` | Outside core clip-generation flow. | API routes are active Next routes. | Should SnipRadar APIs remain deployed? | Keep until product scope is confirmed. |
| `apps/web/components/snipradar` | Not part of V1 clip flow. | Used by SnipRadar pages. | Is SnipRadar UI still supported? | Keep or remove as one product batch only. |
| `apps/web/lib/snipradar` | Not part of V1 clip flow. | Used by SnipRadar API/pages/scripts. | Is this a retained secondary module? | Keep or isolate into separate package/app. |
| `apps/browser-extension` | Not used by the web app build. | `manifest.json` references the files; may be a companion extension. | Is the browser extension still shipped or planned? | Quarantine; do not delete without product decision. |
| `apps/web/app/api/x-radar` | Old naming overlaps SnipRadar/X workflows. | Still routable. | Is `x-radar` legacy, or does OAuth/callback still depend on it? | Confirm before deleting. |
| `apps/web/scripts/snipradar-smoke.js` | Outside core clip flow. | QA script for SnipRadar. | Should SnipRadar smoke tests remain in CI? | Keep if SnipRadar remains; otherwise delete with SnipRadar batch. |
| `apps/web/scripts/snipradar-auth-e2e.js` | Outside core clip flow. | Auth E2E for SnipRadar. | Is this still used by QA? | Quarantine. |
| `apps/web/scripts/load/snipradar-api-load.js` | Outside core clip flow. | Load testing script. | Do we still load test SnipRadar? | Quarantine. |
| `apps/web/scripts/load/snipradar-api.k6.js` | Missing `k6` dependency/tool in depcheck. | Useful if external k6 CLI is used. | Should k6 be a documented external prerequisite or a dev dependency? | Keep only if load tests are retained. |
| `apps/web/scripts/test-x-api.ts` | Dev-only X API script, not referenced by package scripts. | May be a manual ops diagnostic. | Is this still used to validate X credentials? | Delete or move to `docs/archive` after owner confirms. |
| `apps/web/scripts/encrypt-x-tokens.ts` | Specific to X/SnipRadar token migration. | May be needed once for production data. | Has token encryption migration completed in all environments? | Archive after verified complete. |
| `apps/web/scripts/backfill-subscriptions.ts` | One-time billing data migration. | May be needed for existing customers. | Has subscription backfill completed in production? | Archive after migration completed and documented. |
| `apps/web/lib/google-gemini.ts` | Legacy direct Gemini highlight helper, percentage-era shape. | Still imports `HighlightSuggestion`; may be used by older non-V1 features. | Is any active feature allowed to call Gemini directly now? | Quarantine; remove after provider-boundary review. |
| `apps/web/lib/openai.ts` legacy highlight exports | Contains legacy `generateLegacyPercentageHighlights` and direct generation helpers. | Some non-repurpose features may still use script/hook generation. | Which exports are still product-supported? | Split supported OpenAI utility from stale highlight logic. |
| `apps/web/lib/domain/services/ChapterSegmentationService.ts` | DI-bound but no active route resolution found. | Roadmap feature for chapter segmentation. | Is chapter segmentation part of V1/V2? | Quarantine binding/service until owner confirms. |
| `apps/web/lib/application/use-cases/SegmentChaptersUseCase.ts` | DI-bound but no active `container.get` usage found. | Roadmap feature. | Should chapter segmentation remain? | Quarantine. |
| `apps/web/lib/domain/services/NaturalLanguageSearchService.ts` | DI-bound but no active route resolution found. | Could support future clip search. | Is natural language clip search in launch scope? | Quarantine. |
| `apps/web/lib/application/use-cases/SearchClipsUseCase.ts` | DI-bound but no active route resolution found. | Could support future clip search. | Is clip search still planned? | Quarantine. |
| `apps/web/lib/domain/services/CompositeClipService.ts` | DI-bound but no active route resolution found. | May support future stitching/composite clips. | Is composite clip creation still supported? | Quarantine. |
| `apps/web/lib/application/use-cases/CreateCompositeClipUseCase.ts` | DI-bound but no active route resolution found. | May support future stitching/composite clips. | Is composite creation in roadmap? | Quarantine. |
| Secondary workspace routes like `competitors`, `content-calendar`, `hooksmith`, `imagen`, `keywords`, `niche-discovery`, `transcribe`, `veo`, `voicer` | Not part of ViralSnipAI V1 clip flow. | They are active Next route trees and may be product modules. | Which workspace modules are part of the paid product? | Decide product scope before deletion. |

## 5. Refactor But Do Not Delete

| path | issue | better architecture direction | priority |
| --- | --- | --- | --- |
| `apps/web/lib/ffmpeg.ts` and `apps/web/lib/media/source-quality-analysis.ts` | Madge found a circular dependency. | Move shared render preset dimensions/types into a pure `lib/media/render-types.ts` or `render-policy.ts`. | High |
| `apps/web/app/(workspace)/repurpose/editor/page.tsx` | Very large page file at 1,922 lines after editor UX work. | Split into `EditorShell`, `ClipQueuePanel`, `SelectedClipHeader`, `VideoPreviewPanel`, `EditorTabs`, and `InspectorPanel`. | High |
| `apps/web/components/repurpose/transcript-editor.tsx` | 1,979-line component with dense UI/business state. | Split segment editor, word editor, quick actions, search, and low-precision UI. | High |
| `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` | 1,193-line orchestration use case. | Keep orchestration but extract materialization, transcript preparation, analytics assembly, and preview persistence helpers. | High |
| `apps/web/lib/ffmpeg.ts` | 1,510-line infrastructure helper handling many render modes. | Split probing, trimming, preview rendering, final export rendering, filters, and thumbnails. | High |
| `apps/web/prisma/schema.prisma` | 1,892-line schema covering many product areas. | Group models by bounded context with comments; ensure migrations match launch schema. | Medium |
| `apps/web/lib/openrouter-client.ts` | Mixes legacy routed client behavior with newer model policy architecture. | Keep one modern policy-based OpenRouter client and move legacy paths behind explicit adapters. | High |
| `apps/web/lib/infrastructure/di/container.ts` | Container binds active and unknown services together. | Split active ViralSnipAI V1 bindings from optional modules, or lazy-bind module-specific containers. | Medium |
| `apps/web/app/api/**` route handlers | Many routes contain direct Prisma or business logic. | Route handlers should validate/authenticate and delegate to use cases/repositories. | Medium |
| `apps/web/lib/services/**` and `apps/web/lib/domain/services/**` | Duplicate service naming and mixed domain/infrastructure concerns. | Reserve `domain/services` for pure domain logic; move provider/API code to infrastructure. | Medium |
| Test suites under `apps/web/lib/**/__tests__` | Several tests fail from stale mocks or old expectations. | Update tests to current schema, current billing prices, current OpenRouter behavior, and Jest runtime. | High |

## 6. Dependency Cleanup Recommendations

| package | dependency/devDependency | current usage | recommendation | risk |
| --- | --- | --- | --- | --- |
| `@dnd-kit/core` | dependency | Only used by orphan `apps/web/components/repurpose/clip-list.tsx`. | Remove after deleting old `clip-list.tsx`. | Low-Medium |
| `@dnd-kit/sortable` | dependency | Only used by orphan `clip-list.tsx`. | Remove after deleting old `clip-list.tsx`. | Low-Medium |
| `@dnd-kit/utilities` | dependency | Only used by orphan `clip-list.tsx`. | Remove after deleting old `clip-list.tsx`. | Low-Medium |
| `@radix-ui/react-tooltip` | dependency | Only used by `apps/web/components/ui/tooltip.tsx`; no imports of that primitive found. | Delete primitive and dependency if owner confirms no tooltip usage is planned. | Low-Medium |
| `@next-auth/prisma-adapter` | dependency | No imports found in code search. | Verify auth config, then remove if unused. | Medium |
| `@tanstack/react-query-devtools` | dependency | No imports found. | Remove or wire into dev-only provider intentionally. | Low |
| `@uploadthing/react` | dependency | No imports found; upload flow uses local route/storage. | Remove if UploadThing is not a planned storage provider. | Medium |
| `uploadthing` | dependency | No imports found. | Remove with `@uploadthing/react` if not planned. | Medium |
| `@clippers/types` in `packages/jobs` | dependency | No package import usage. | Remove from `packages/jobs/package.json`. | Low |
| `inversify` | root dependency | Imported by web DI/services, but declared at root. | Move into `apps/web/package.json`; keep root only if shared packages also need it. | Medium |
| `reflect-metadata` | root dependency | Imported by `apps/web/lib/infrastructure/di/container.ts`, but declared at root. | Move into `apps/web/package.json`; keep root only if shared packages need it. | Medium |
| `tailwindcss-animate` | dependency | Used by `apps/web/tailwind.config.ts`. | Keep. Static tools incorrectly flag it. | Low |
| `mime-types` | dependency | Used by `apps/web/app/api/uploads/[...path]/route.ts`. | Keep. Static tools incorrectly flag it. | Low |
| `@types/mime-types` | devDependency | Supports `mime-types` usage. | Keep unless TypeScript confirms package types are no longer needed. | Low |
| `k6` | missing external tool | Referenced by `apps/web/scripts/load/snipradar-api.k6.js`. | If the script stays, document external k6 install or add as a dev tool if supported. | Medium |
| ESLint/Jest/PostCSS deps flagged by depcheck | devDependency | Used by config/tooling or may be required by Next/Jest. | Do not remove based on depcheck alone. Verify configs first. | Medium |

## 7. Script Cleanup Recommendations

| script | current purpose | keep/delete/quarantine | reason |
| --- | --- | --- | --- |
| `apps/web/scripts/repurpose-provider-boundary-check.ts` | Validates OpenAI/OpenRouter/local timestamp boundaries. | Keep | Required by current QA and passed. |
| `apps/web/scripts/repurpose-smoke.js` | Browser/API smoke for repurpose flow. | Keep | Relevant to V1 launch validation. |
| `apps/web/scripts/remotion-render-smoke.ts` | Render/export smoke. | Keep | Relevant if Remotion/final render path remains. |
| `apps/web/scripts/backfill-subscriptions.ts` | Subscription migration/backfill. | Quarantine | Keep until production billing migration is confirmed complete. |
| `apps/web/scripts/encrypt-x-tokens.ts` | X token migration utility. | Quarantine | Only needed if SnipRadar/X accounts remain. |
| `apps/web/scripts/snipradar-smoke.js` | SnipRadar smoke test. | Quarantine | Depends on SnipRadar product decision. |
| `apps/web/scripts/snipradar-auth-e2e.js` | SnipRadar auth E2E test. | Quarantine | Depends on SnipRadar product decision. |
| `apps/web/scripts/test-x-api.ts` | Manual X API diagnostic. | Quarantine/Delete | No package script reference found; keep only if ops uses it. |
| `apps/web/scripts/load/snipradar-api-load.js` | SnipRadar load test. | Quarantine | Depends on SnipRadar product decision. |
| `apps/web/scripts/load/snipradar-api.k6.js` | SnipRadar k6 load test. | Quarantine | Needs external `k6`; depends on SnipRadar decision. |
| Other test/QA scripts flagged by knip | Various migration/smoke utilities. | Case-by-case | Knip treats package scripts and manual scripts as unused; do not bulk delete. |

## 8. DI Container Cleanup Recommendations

| binding | used by | active/stale/unknown | recommendation |
| --- | --- | --- | --- |
| `GenerateAutoHighlightsUseCase` | `app/api/repurpose/auto-highlights`, `app/api/v1/clip-projects/[id]/generate-clips` | Active | Keep. |
| `GenerateCaptionsUseCase` | `app/api/repurpose/captions` | Active | Keep. |
| `UpdateClipUseCase` | `app/api/clips/[id]` | Active | Keep. |
| `UpdateProjectClipOrderUseCase` | `app/api/projects/[id]/clip-order` | Active | Keep while clip ordering remains. |
| `QueueExportUseCase` | `app/api/exports`, `app/api/repurpose/exports/jobs`, public API exports | Active | Keep. |
| `TrimClipUseCase` | `app/api/clips/[id]/trim` | Active | Keep. |
| `SplitClipUseCase` | `app/api/clips/[id]/split` | Active | Keep. |
| `ExportCaptionsUseCase` | `app/api/clips/[id]/captions/export` | Active | Keep. |
| `IngestYouTubeVideoUseCase` | YouTube ingest queue/routes | Active | Keep if YouTube ingest is launch scope. |
| `TranslateTranscriptUseCase` | `app/api/translations/transcript` | Active | Keep if translation UI remains. |
| `TranslationService` | `TranslateTranscriptUseCase` | Active | Keep if translation remains. |
| `TranslateVideoVoiceUseCase` | `app/api/voice-translations/translate` | Active | Keep if voice translation remains. |
| `VoiceTranslationService` | `TranslateVideoVoiceUseCase` | Active/Secondary | Keep if voice translation remains; otherwise quarantine with feature. |
| `TextToSpeechService` | Voice translation path | Active/Secondary | Keep if voice translation remains; otherwise quarantine with feature. |
| `SearchClipsUseCase` | No active `container.get` found outside tests. | Unknown | Ask owner; delete binding/service only if clip search is out of scope. |
| `NaturalLanguageSearchService` | Search use case. | Unknown | Quarantine with `SearchClipsUseCase`. |
| `SegmentChaptersUseCase` | No active `container.get` found outside tests. | Unknown | Ask owner; quarantine if chapters are V2. |
| `ChapterSegmentationService` | Chapter use case. | Unknown | Quarantine with chapter feature. |
| `CreateCompositeClipUseCase` | No active `container.get` found outside tests. | Unknown | Ask owner; quarantine if composite clips are V2. |
| `CompositeClipService` | Composite use case and type references. | Unknown | Quarantine with composite feature. |
| `VideoStitchingService` | Composite/video stitching path. | Unknown | Keep only if composite/stitching remains. |
| `AIAnalysisService` | Injected into highlight generation path. | Active/Legacy | Keep for now, then audit methods to remove legacy highlight behavior safely. |

## 9. SOLID / Clean Architecture Gaps

Route handlers too heavy:

- Several `app/api/**` handlers validate input, authorize, query Prisma, call providers, and format responses in one file.
- Recommended direction: route handlers should authenticate/validate only, then delegate to use cases.

Business logic in UI:

- The repurpose editor page is 1,922 lines and still coordinates clip selection, state merging, captions, saving, review status, warnings, tabs, and layout.
- Recommended direction: keep UI components declarative and move mutation orchestration to hooks/use cases.

Infrastructure mixed with domain logic:

- `ffmpeg.ts` owns probing, filter construction, preview rendering, final rendering, thumbnail work, and quality policy integration.
- `openrouter-client.ts` still carries legacy routed model behavior alongside the newer model-policy architecture.
- Recommended direction: isolate provider clients, policy resolution, and feature-specific adapters.

Direct Prisma usage outside repositories:

- Direct Prisma usage exists in many API routes, billing/auth helpers, project routes, social/SnipRadar routes, and some use cases.
- The repository pattern exists but is applied inconsistently.
- Recommended direction: migrate active ViralSnipAI V1 paths first: projects, clips, assets, exports, captions, feedback.

Provider coupling:

- Provider boundary check passes, but legacy helpers like `google-gemini.ts` and direct OpenAI helper exports still exist.
- Recommended direction: forbid direct reasoning-provider calls in active repurpose paths except through model policy/provider interfaces.

Large files needing decomposition:

| file | lines |
| --- | ---: |
| `apps/web/components/repurpose/transcript-editor.tsx` | 1,979 |
| `apps/web/app/(workspace)/repurpose/editor/page.tsx` | 1,922 |
| `apps/web/prisma/schema.prisma` | 1,892 |
| `apps/web/lib/ffmpeg.ts` | 1,510 |
| `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts` | 1,193 |
| `apps/web/components/repurpose/caption-overlay-studio.tsx` | 729 |
| `apps/web/lib/openrouter-client.ts` | 643 |

Duplicate utilities / unclear ownership:

- There are both `lib/services/*` and `lib/domain/services/*` service trees.
- Caption generation appears in both legacy and newer service paths.
- Product areas such as SnipRadar, script generator, media CV, and repurpose share the same app package, which makes static cleanup tools noisy.

Test reliability gaps:

- Unit tests currently fail from outdated billing expectations, missing runtime globals, stale repository mocks, old OpenRouter assumptions, missing module aliases, and ESM/Jest compatibility.
- Cleanup should not rely solely on unit tests until those are fixed.

## 10. Recommended Cleanup Plan

### Batch 1: safe deletion

1. Delete `.DS_Store` files.
2. Delete tracked `dist/tsconfig.tsbuildinfo` files under `packages/jobs` and `packages/types`.
3. Remove unused `@clippers/types` dependency from `packages/jobs`.
4. Remove unused shared type exports if the package is internal-only:
   - `HookGenerationPayload`
   - `ScriptGenerationPayload`
   - `HighlightGenerationPayload`
   - `CaptionGenerationPayload`
5. Delete confirmed orphan old repurpose UI files:
   - `apps/web/components/repurpose/repurpose-sub-nav.tsx`
   - `apps/web/components/repurpose/clip-list.tsx`
   - `apps/web/components/repurpose/caption-editor-dialog.tsx`
6. Delete orphan hooks:
   - `apps/web/hooks/use-export-progress.ts`
   - `apps/web/hooks/use-progress-tracker.ts`

Validation after Batch 1:

```bash
pnpm install
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web run repurpose:boundary-check
```

### Batch 2: dependency cleanup

1. Remove DnD dependencies only after deleting old clip list:
   - `@dnd-kit/core`
   - `@dnd-kit/sortable`
   - `@dnd-kit/utilities`
2. Remove UploadThing packages if owner confirms UploadThing is not planned:
   - `@uploadthing/react`
   - `uploadthing`
3. Remove `@tanstack/react-query-devtools` if no dev provider will use it.
4. Verify and remove `@next-auth/prisma-adapter` only if auth config does not use it.
5. Move `inversify` and `reflect-metadata` into `apps/web/package.json` if web owns the DI container.

Validation after Batch 2:

```bash
pnpm install
pnpm --filter web build
pnpm --filter web lint
```

### Batch 3: script cleanup

1. Ask owner whether SnipRadar/X scripts remain supported.
2. Archive one-time migration scripts after production completion is confirmed.
3. Either document `k6` as an external tool or remove the k6 script with SnipRadar cleanup.

Validation after Batch 3:

```bash
pnpm --filter web build
pnpm --filter web lint
```

### Batch 4: architecture refactor

1. Break the `ffmpeg.ts` / `source-quality-analysis.ts` cycle.
2. Split large editor/transcript components.
3. Split `GenerateAutoHighlightsUseCase` into smaller orchestration helpers.
4. Move active V1 route Prisma calls behind repositories.
5. Separate SnipRadar/secondary product modules from ViralSnipAI V1 module boundaries.
6. Replace legacy OpenRouter/OpenAI direct helper paths with policy-based adapters where still needed.

Validation after Batch 4:

```bash
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test:unit
pnpm --filter web run repurpose:boundary-check
pnpm --filter web run repurpose:smoke
```

### Batch 5: final validation

1. Fix stale tests and repository mocks.
2. Run browser QA for Source -> Goals -> Generate -> Review/Edit -> Export.
3. Confirm final exports use original source media.
4. Confirm provider boundary script passes.

## 11. Validation Commands

Run these after each cleanup batch, with the full set after architecture cleanup:

```bash
pnpm install
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test:unit
pnpm --filter web run repurpose:boundary-check
pnpm --filter web run repurpose:smoke
```

Current observed validation state:

| Command | Current status | Action needed |
| --- | --- | --- |
| `pnpm --filter web build` | Passes | Keep as primary cleanup gate. |
| `pnpm --filter web lint` | Passes with hook warnings | Fix warnings separately; not cleanup blockers. |
| `pnpm --filter web run repurpose:boundary-check` | Passes | Keep as mandatory provider-boundary gate. |
| `pnpm --filter web test:unit` | Fails | Fix stale tests before using as a hard cleanup gate. |

Current unit test failure groups:

| test area | failure summary | cleanup relevance |
| --- | --- | --- |
| Billing canonical plans | Test expects Plus INR 499, current code returns 799. | Update test or pricing fixture; do not change pricing blindly. |
| Translation API tests | `Request is not defined`. | Jest runtime/polyfill issue. |
| Prisma repository tests | Mocks stale versus schema/include changes. | Update mocks to current Prisma model shape. |
| TranslationService tests | Expected OpenAI behavior, current service requires OpenRouter configuration. | Update provider assumptions. |
| AIAnalysisService tests | Missing module `@/lib/ai/highlights`. | Stale test or missing module alias. |
| GenerateAutoHighlightsUseCase tests | Jest cannot parse ESM `nanoid/index.browser.js`. | Jest transform/module mapping issue. |
