# Caption Animation System

The caption system is now animation-ready while preserving the existing editable caption workflow. Caption text and timing remain stored separately from burned-in export output.

## Caption Style Shape

`ClipCaptionStyleConfig` now includes:

- `maxWordsPerLine`
- `align`
- `animation.type`: `none`, `karaoke`, `pop`, `fade`, `slide`, `bounce`
- `animation.wordHighlight`
- `animation.speed`: `slow`, `normal`, `fast`
- `safeZoneAware`

The legacy `karaoke` boolean is still normalized into the new animation config for compatibility.

## Edit Flow

1. Users edit caption text and SRT timing before render.
2. Users select preset, font, color, stroke, background, position, max words, and animation settings.
3. The caption style config is saved separately from burned-in output.
4. Export reads the latest caption text and style config.

## Rendering

`apps/web/lib/captions/caption-renderer.ts` defines the renderer abstraction:

- `ffmpeg_static`: supported now.
- `remotion_animated`: reserved for future animated caption rendering.

The current FFmpeg renderer burns static captions. If animation is selected, the config is preserved and the renderer logs a static fallback warning instead of failing export.

## FFmpeg vs Remotion

FFmpeg is reliable for:

- static subtitles,
- text styling through ASS/SRT conversion,
- one-pass crop, captions, and encoding.

Remotion is the better future path for:

- karaoke word highlighting,
- pop/bounce captions,
- fade/slide transitions,
- branded animated templates.

## Fallback Behavior

Unsupported animations do not block export. The app:

- stores animation settings,
- previews static styling where available,
- burns static captions during FFmpeg export,
- logs a warning for future debugging.

## Deployment Notes

- No Prisma migration is required because caption style remains JSON.
- No new credentials are required.
- Keep final exports sourced from the original uploaded video, not preview files.
