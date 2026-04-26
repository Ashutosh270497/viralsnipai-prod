# V1 Launch Readiness Notes

ViralSnipAI V1 stays focused on one path: upload or import a long video, detect short clips, edit captions and style, export branded MP4s, and manage usage/billing.

## Scope Guardrails

- V1 navigation should only expose Dashboard, Projects, Create Clip, Exports, Brand Kit, Billing, Settings, and Help.
- V2/V3 surfaces remain behind `apps/web/config/features.ts`.
- Direct visits to hidden routes show a launch-gated coming-soon state instead of exposing unfinished modules.

## V1 Workflow Updates

- Clip results now show preview media, title, timestamps, duration, virality score, score explanation, transcript snippet, caption status, render status, export status, and Preview/Edit/Export/Download actions.
- Caption editing supports subtitle preview toggle, text correction, style preset, font, color, position, background, hook overlays, and `.srt`/`.vtt` downloads.
- Export controls support rendering with burned captions or clean output using the existing `includeCaptions` API field.
- Processing UX now names the expected stages: upload, audio extraction, transcription, scene detection, highlight scoring, caption generation, preview rendering, and ready.
- Usage limits are surfaced from the same server policy used by upload/export APIs.

## Security Notes

- Do not commit `.env`, `.env.local`, or production credentials.
- Keep examples placeholder-only. This change intentionally does not edit `.env` or `.env.example`.
- If any real API keys were ever pasted into committed files, rotate them in the provider dashboard and treat repo history as exposed.
- OpenRouter, storage, billing, OAuth, and database credentials should be rotated before production launch if there is any doubt about prior exposure.
