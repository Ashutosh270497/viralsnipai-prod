/**
 * Smart Reframe — Vision API Detection Provider
 *
 * Uses the existing OpenRouter client (already configured in the project) to
 * analyze sampled frames for face/person bounding boxes.
 *
 * Model: google/gemini-3.1-flash-lite-preview (multimodal, cheap, fast)
 * Fallback: FallbackDetectionProvider returns empty arrays — never throws.
 */

import { promises as fs } from "fs";
import { logger } from "@/lib/logger";
import { openRouterClient } from "@/lib/openrouter-client";
import type { FrameDetectionProvider, FrameDetectionResult, DetectionBox } from "./tracking-types";

// Model preference for vision detection. Cheap multimodal model is ideal.
const VISION_DETECTION_MODEL =
  process.env.SMART_REFRAME_VISION_MODEL ?? "google/gemini-3.1-flash-lite-preview";

const DETECTION_TIMEOUT_MS = 12_000;

const VISION_PROMPT = `You are a precise video frame analyzer. Look at this video frame and detect all visible human faces and full-body persons.

Return a JSON object with this exact structure (no markdown, no explanation, only JSON):
{
  "faces": [
    { "x": 0.25, "y": 0.10, "width": 0.15, "height": 0.22, "confidence": 0.92 }
  ],
  "persons": [
    { "x": 0.15, "y": 0.05, "width": 0.35, "height": 0.85, "confidence": 0.88 }
  ]
}

Rules:
- All coordinates are normalized 0.0 to 1.0 relative to the full image dimensions.
- x, y are the top-left corner of the bounding box.
- confidence is your certainty from 0.0 to 1.0.
- If no face is visible, set "faces" to an empty array [].
- If no person is visible, set "persons" to an empty array [].
- Only include detections with confidence >= 0.40.
- For multiple faces/persons, list all of them.`;

/**
 * Fallback provider — always returns empty detections.
 * Used when the Vision API is unavailable or disabled.
 */
export class FallbackDetectionProvider implements FrameDetectionProvider {
  async detect(_framePath: string): Promise<FrameDetectionResult> {
    return { faces: [], persons: [] };
  }
}

/**
 * Vision API detection provider using OpenRouter.
 * Reads the frame as a base64 JPEG and asks the model for bounding boxes.
 * Never throws — returns empty arrays on any failure.
 */
export class VisionApiDetectionProvider implements FrameDetectionProvider {
  async detect(framePath: string): Promise<FrameDetectionResult> {
    if (!openRouterClient) {
      return { faces: [], persons: [] };
    }

    let base64: string;
    try {
      const buffer = await fs.readFile(framePath);
      base64 = buffer.toString("base64");
    } catch {
      logger.warn("smart-reframe: could not read frame file", { framePath });
      return { faces: [], persons: [] };
    }

    try {
      const abortController = new AbortController();
      const timer = setTimeout(() => abortController.abort(), DETECTION_TIMEOUT_MS);

      const response = await openRouterClient.chat.completions.create(
        {
          model: VISION_DETECTION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: VISION_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
          max_tokens: 512,
          temperature: 0,
        },
        { signal: abortController.signal as AbortSignal }
      ).finally(() => clearTimeout(timer));

      const raw = response.choices?.[0]?.message?.content ?? "";
      return parseDetectionResponse(raw);
    } catch (error) {
      logger.warn("smart-reframe: vision API detection failed", {
        framePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return { faces: [], persons: [] };
    }
  }
}

// ── Response parsing ──────────────────────────────────────────────────────────

function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseBox(raw: unknown, label: DetectionBox["label"]): DetectionBox | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const x = clamp01(r.x);
  const y = clamp01(r.y);
  const width = clamp01(r.width);
  const height = clamp01(r.height);
  const confidence = clamp01(r.confidence);

  // Discard degenerate boxes
  if (width < 0.01 || height < 0.01) return null;

  return { x, y, width, height, confidence, label };
}

function parseDetectionResponse(raw: string): FrameDetectionResult {
  try {
    // Strip any markdown fences
    const json = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(json);

    const faces: DetectionBox[] = (Array.isArray(parsed.faces) ? parsed.faces as unknown[] : [])
      .map((b) => parseBox(b, "face"))
      .filter((b): b is DetectionBox => b !== null);

    const persons: DetectionBox[] = (Array.isArray(parsed.persons) ? parsed.persons as unknown[] : [])
      .map((b) => parseBox(b, "person"))
      .filter((b): b is DetectionBox => b !== null);

    return { faces, persons };
  } catch {
    return { faces: [], persons: [] };
  }
}

/**
 * Create the appropriate detection provider based on environment config.
 * Never throws.
 */
export function createDetectionProvider(): FrameDetectionProvider {
  if (!openRouterClient) {
    logger.info("smart-reframe: OpenRouter unavailable, using fallback detector");
    return new FallbackDetectionProvider();
  }
  return new VisionApiDetectionProvider();
}
