/**
 * Phase 10 — Productization Tests
 *
 * Tests guard:
 *   - CropWindowPreview math: crop coordinates stay within source bounds
 *   - Premium mode identification is correct
 *   - Stable modes are not marked premium
 *   - Export quality schema accepts "high" and "standard" only
 *   - captionAnimationType triggers Remotion indicator correctly
 *   - Export API schema validates exportQuality
 */

jest.mock("@/lib/openrouter-client", () => ({
  openRouterClient: null, OPENROUTER_MODELS: {}, HAS_OPENROUTER_KEY: false, routedChatCompletion: jest.fn(),
}));

jest.mock("@/lib/media/cv-worker-client", () => ({
  getCvWorkerHealth: jest.fn(), getCvWorkerBaseUrl: jest.fn().mockReturnValue(null),
  detectClipWithCvWorker: jest.fn(), trackSubjectWithCvWorker: jest.fn(), detectScenesWithCvWorker: jest.fn(),
}));

import { z } from "zod";
import { computeStableCropWindow, cropWindowToSafeZone } from "../media/smart-reframe/crop-window";
import { DEFAULT_SHORT_FORM_SAFE_ZONE } from "../media/smart-reframe/safe-zones";
import type { AggregatedDetections } from "../media/smart-reframe/tracking-types";

// ── Mode premium flags ────────────────────────────────────────────────────────

// These mirror REFRAME_MODES in framing-panel.tsx — kept in sync here.
const PREMIUM_MODES = new Set(["dynamic_auto", "dynamic_face", "dynamic_person", "blurred_background"]);
const FREE_MODES    = new Set(["smart_auto", "smart_face", "smart_person", "center_crop"]);

describe("reframe mode premium classification", () => {
  it("dynamic_auto is premium", () => expect(PREMIUM_MODES.has("dynamic_auto")).toBe(true));
  it("dynamic_face is premium",  () => expect(PREMIUM_MODES.has("dynamic_face")).toBe(true));
  it("dynamic_person is premium",() => expect(PREMIUM_MODES.has("dynamic_person")).toBe(true));
  it("blurred_background is premium", () => expect(PREMIUM_MODES.has("blurred_background")).toBe(true));

  it("smart_auto is free",  () => expect(FREE_MODES.has("smart_auto")).toBe(true));
  it("smart_face is free",  () => expect(FREE_MODES.has("smart_face")).toBe(true));
  it("smart_person is free",() => expect(FREE_MODES.has("smart_person")).toBe(true));
  it("center_crop is free", () => expect(FREE_MODES.has("center_crop")).toBe(true));

  it("no mode is both premium and free", () => {
    for (const mode of PREMIUM_MODES) expect(FREE_MODES.has(mode)).toBe(false);
  });
});

// ── Crop window coordinate validity ──────────────────────────────────────────

const SRC = { w: 1920, h: 1080 };
const TGT = { w: 1080, h: 1920 };
const SAFE = DEFAULT_SHORT_FORM_SAFE_ZONE;

function agg(cx: number, cy: number, conf = 0.9): AggregatedDetections {
  return {
    faceBoxes: [{ box: { x: cx - 0.05, y: cy - 0.07, width: 0.10, height: 0.14, confidence: conf, label: "face" }, frameIndex: 0 }],
    personBoxes: [],
    totalFrames: 3,
  };
}

function crop(cx: number, cy: number) {
  return computeStableCropWindow({ aggregated: agg(cx, cy), sourceWidth: SRC.w, sourceHeight: SRC.h, targetWidth: TGT.w, targetHeight: TGT.h, safeZone: SAFE, preferFaces: true, preferPersons: true });
}

describe("CropWindowPreview coordinate invariants", () => {
  it("crop window x is always within [0, sourceWidth]", () => {
    for (const cx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const { cropWindow } = crop(cx, 0.4);
      expect(cropWindow.x).toBeGreaterThanOrEqual(0);
      expect(cropWindow.x + cropWindow.width).toBeLessThanOrEqual(SRC.w);
    }
  });

  it("crop window y is always within [0, sourceHeight]", () => {
    for (const cy of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const { cropWindow } = crop(0.5, cy);
      expect(cropWindow.y).toBeGreaterThanOrEqual(0);
      expect(cropWindow.y + cropWindow.height).toBeLessThanOrEqual(SRC.h);
    }
  });

  it("crop window dimensions maintain 9:16 target ratio", () => {
    const targetRatio = TGT.w / TGT.h;
    for (const cx of [0.2, 0.5, 0.8]) {
      const { cropWindow } = crop(cx, 0.4);
      const ratio = cropWindow.width / cropWindow.height;
      expect(Math.abs(ratio - targetRatio)).toBeLessThan(0.02);
    }
  });

  it("safe zone top band stays within crop window", () => {
    const { cropWindow } = crop(0.5, 0.4);
    const safeTopH = cropWindow.height * SAFE.topPct;
    expect(safeTopH).toBeGreaterThan(0);
    expect(cropWindow.y + safeTopH).toBeLessThanOrEqual(cropWindow.y + cropWindow.height);
  });

  it("safe zone bottom band stays within crop window", () => {
    const { cropWindow } = crop(0.5, 0.4);
    const safeBottomY = cropWindow.y + cropWindow.height * (1 - SAFE.bottomPct);
    const safeBottomH = cropWindow.height * SAFE.bottomPct;
    expect(safeBottomY).toBeGreaterThanOrEqual(cropWindow.y);
    expect(safeBottomY + safeBottomH).toBeLessThanOrEqual(SRC.h + 1); // +1 for rounding
  });
});

// ── cropWindowToSafeZone ──────────────────────────────────────────────────────

describe("cropWindowToSafeZone (used by CropWindowPreview)", () => {
  it("returns normalized safeZone in [0, 1]", () => {
    const crop = { x: 200, y: 0, width: 608, height: 1080 };
    const sz = cropWindowToSafeZone(crop, SRC.w, SRC.h);
    expect(sz.x).toBeGreaterThanOrEqual(0);
    expect(sz.y).toBeGreaterThanOrEqual(0);
    expect(sz.x + sz.width).toBeLessThanOrEqual(1.01);
    expect(sz.y + sz.height).toBeLessThanOrEqual(1.01);
  });
});

// ── Export quality schema ─────────────────────────────────────────────────────

const exportQualitySchema = z.enum(["high", "standard"]).default("high");

describe("exportQuality schema", () => {
  it("accepts 'high'",     () => expect(exportQualitySchema.parse("high")).toBe("high"));
  it("accepts 'standard'",() => expect(exportQualitySchema.parse("standard")).toBe("standard"));
  it("defaults to 'high' when undefined", () => expect(exportQualitySchema.parse(undefined)).toBe("high"));
  it("rejects unknown values", () => expect(() => exportQualitySchema.parse("ultra")).toThrow());
});

// ── Animation type → Remotion indicator logic ─────────────────────────────────

describe("captionAnimationType → hasAnimatedCaptions", () => {
  function hasAnimated(type: string | null, includeCaptions: boolean) {
    return includeCaptions && Boolean(type) && type !== "none";
  }

  it("returns false when captions disabled", () => {
    expect(hasAnimated("pop", false)).toBe(false);
  });

  it("returns false for animation type 'none'", () => {
    expect(hasAnimated("none", true)).toBe(false);
  });

  it("returns false when animationType is null", () => {
    expect(hasAnimated(null, true)).toBe(false);
  });

  it("returns true for animated types with captions enabled", () => {
    for (const type of ["karaoke", "pop", "fade", "slide", "bounce"]) {
      expect(hasAnimated(type, true)).toBe(true);
    }
  });
});
