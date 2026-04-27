/**
 * Smart Reframe Phase 1 — Unit Tests
 *
 * Tests guard the core invariants:
 *   - No detection falls back to center crop
 *   - Face detection beats person detection
 *   - Crop window always stays within source bounds
 *   - Vertical output never stretches video (maintains target ratio)
 *   - Caption safe zone is respected
 *   - Fallback reason is populated when appropriate
 */

// Mock openrouter-client so the test environment doesn't need the OpenAI web shim
jest.mock("@/lib/openrouter-client", () => ({
  openRouterClient: null,
  OPENROUTER_MODELS: {},
  HAS_OPENROUTER_KEY: false,
  routedChatCompletion: jest.fn(),
}));

const mockDetectClipWithCvWorker = jest.fn();
let mockCvWorkerBaseUrl: string | null = null;

jest.mock("@/lib/media/cv-worker-client", () => ({
  detectClipWithCvWorker: (...args: unknown[]) => mockDetectClipWithCvWorker(...args),
  getCvWorkerBaseUrl: () => mockCvWorkerBaseUrl,
  trackSubjectWithCvWorker: jest.fn(),
}));

import {
  computeStableCropWindow,
  cropWindowToSafeZone,
  FACE_TARGET_Y_RATIO,
  MIN_CONFIDENCE_FACE,
  MIN_CONFIDENCE_PERSON,
} from "../media/smart-reframe/crop-window";
import {
  generateDynamicCropPathFromDetections,
  smoothCropPath,
} from "../media/smart-reframe";
import { DEFAULT_SHORT_FORM_SAFE_ZONE } from "../media/smart-reframe/safe-zones";
import { FallbackDetectionProvider } from "../media/smart-reframe/vision-api-detector";
import {
  buildViralityFactorsPatch,
  applySmartReframeToPlan,
  generateStableSmartReframePlan,
} from "../media/smart-reframe/smart-reframe.service";
import type { AggregatedDetections, DetectionBox } from "../media/smart-reframe/tracking-types";
import type { ClipReframePlan } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SRC = { w: 1920, h: 1080 };   // 16:9 landscape
const TGT = { w: 1080, h: 1920 };   // 9:16 portrait

afterEach(() => {
  mockCvWorkerBaseUrl = null;
  mockDetectClipWithCvWorker.mockReset();
});

function emptyAgg(): AggregatedDetections {
  return { faceBoxes: [], personBoxes: [], totalFrames: 0 };
}

function faceAgg(cx: number, cy: number, conf = 0.9): AggregatedDetections {
  const box: DetectionBox = {
    x: cx - 0.05,
    y: cy - 0.07,
    width: 0.10,
    height: 0.14,
    confidence: conf,
    label: "face",
  };
  return {
    faceBoxes: [{ box, frameIndex: 0 }],
    personBoxes: [],
    totalFrames: 3,
  };
}

function personAgg(cx: number, cy: number, conf = 0.85): AggregatedDetections {
  const box: DetectionBox = {
    x: cx - 0.15,
    y: cy - 0.30,
    width: 0.30,
    height: 0.65,
    confidence: conf,
    label: "person",
  };
  return {
    faceBoxes: [],
    personBoxes: [{ box, frameIndex: 0 }],
    totalFrames: 3,
  };
}

function runCrop(agg: AggregatedDetections, preferFaces = true, preferPersons = true) {
  return computeStableCropWindow({
    aggregated: agg,
    sourceWidth: SRC.w,
    sourceHeight: SRC.h,
    targetWidth: TGT.w,
    targetHeight: TGT.h,
    safeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
    preferFaces,
    preferPersons,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeStableCropWindow — strategy selection", () => {
  it("falls back to center_crop when no detection and populates fallbackReason", () => {
    const plan = runCrop(emptyAgg());
    expect(plan.strategy).toBe("center_crop");
    expect(plan.confidence).toBe(0);
    expect(plan.fallbackReason).toBeTruthy();
  });

  it("selects face_tracking when face detected", () => {
    const plan = runCrop(faceAgg(0.5, 0.4));
    expect(plan.strategy).toBe("face_tracking");
    expect(plan.confidence).toBeGreaterThan(0);
    expect(plan.faceDetections).toBe(1);
  });

  it("face detection beats person detection", () => {
    const agg: AggregatedDetections = {
      faceBoxes: [{ box: { x: 0.3, y: 0.1, width: 0.1, height: 0.14, confidence: 0.9, label: "face" }, frameIndex: 0 }],
      personBoxes: [{ box: { x: 0.1, y: 0.0, width: 0.4, height: 0.85, confidence: 0.95, label: "person" }, frameIndex: 0 }],
      totalFrames: 3,
    };
    const plan = runCrop(agg);
    expect(plan.strategy).toBe("face_tracking");
  });

  it("falls back to person_tracking when no face detected", () => {
    const plan = runCrop(personAgg(0.5, 0.5));
    expect(plan.strategy).toBe("person_tracking");
    expect(plan.personDetections).toBe(1);
  });

  it("falls back to center_crop when face below confidence threshold", () => {
    const plan = runCrop(faceAgg(0.5, 0.4, MIN_CONFIDENCE_FACE - 0.01));
    expect(plan.strategy).toBe("center_crop");
  });

  it("falls back to center_crop when person below confidence threshold", () => {
    const plan = runCrop(personAgg(0.5, 0.5, MIN_CONFIDENCE_PERSON - 0.01), false, true);
    expect(plan.strategy).toBe("center_crop");
  });

  it("only face detection used when preferPersons=false", () => {
    const plan = runCrop(personAgg(0.5, 0.5), false, false);
    expect(plan.strategy).toBe("center_crop");
  });
});

describe("computeStableCropWindow — crop window bounds", () => {
  it("crop window x is always >= 0", () => {
    // Face at far left edge
    const plan = runCrop(faceAgg(0.05, 0.4));
    expect(plan.cropWindow.x).toBeGreaterThanOrEqual(0);
  });

  it("crop window right edge is always <= sourceWidth", () => {
    // Face at far right edge
    const plan = runCrop(faceAgg(0.95, 0.4));
    expect(plan.cropWindow.x + plan.cropWindow.width).toBeLessThanOrEqual(SRC.w);
  });

  it("crop window y is always >= 0", () => {
    const plan = runCrop(faceAgg(0.5, 0.02));
    expect(plan.cropWindow.y).toBeGreaterThanOrEqual(0);
  });

  it("crop window bottom edge is always <= sourceHeight", () => {
    const plan = runCrop(faceAgg(0.5, 0.98));
    expect(plan.cropWindow.y + plan.cropWindow.height).toBeLessThanOrEqual(SRC.h);
  });

  it("center crop window is exactly centered", () => {
    const plan = runCrop(emptyAgg());
    const cx = plan.cropWindow.x + plan.cropWindow.width / 2;
    // For landscape→portrait, center crop should have x center at 50% of source
    expect(Math.abs(cx / SRC.w - 0.5)).toBeLessThan(0.02);
  });

  it("crop window dimensions maintain target aspect ratio", () => {
    const plan = runCrop(faceAgg(0.7, 0.3));
    const ratio = plan.cropWindow.width / plan.cropWindow.height;
    const targetRatio = TGT.w / TGT.h;
    expect(Math.abs(ratio - targetRatio)).toBeLessThan(0.02);
  });

  it("output never stretches — crop width <= sourceWidth", () => {
    const plan = runCrop(faceAgg(0.5, 0.4));
    expect(plan.cropWindow.width).toBeLessThanOrEqual(SRC.w);
  });

  it("output never stretches — crop height <= sourceHeight", () => {
    const plan = runCrop(faceAgg(0.5, 0.4));
    expect(plan.cropWindow.height).toBeLessThanOrEqual(SRC.h);
  });
});

describe("computeStableCropWindow — off-center subjects", () => {
  it("face at left shifts crop left (x < center)", () => {
    const centerPlan = runCrop(emptyAgg());
    const leftPlan = runCrop(faceAgg(0.25, 0.4));
    expect(leftPlan.cropWindow.x).toBeLessThanOrEqual(centerPlan.cropWindow.x);
  });

  it("face at right shifts crop right (x > center)", () => {
    const centerPlan = runCrop(emptyAgg());
    const rightPlan = runCrop(faceAgg(0.75, 0.4));
    expect(rightPlan.cropWindow.x).toBeGreaterThanOrEqual(centerPlan.cropWindow.x);
  });

  it("different face positions produce different crop windows", () => {
    const leftPlan = runCrop(faceAgg(0.2, 0.4));
    const rightPlan = runCrop(faceAgg(0.8, 0.4));
    expect(leftPlan.cropWindow.x).not.toBe(rightPlan.cropWindow.x);
  });
});

describe("cropWindowToSafeZone", () => {
  it("safeZone center maps back to the crop center", () => {
    const crop = { x: 200, y: 0, width: 608, height: 1080 };
    const sz = cropWindowToSafeZone(crop, SRC.w, SRC.h);
    const cx = sz.x + sz.width / 2;
    const cy = sz.y + sz.height / 2;
    const expectedCx = (200 + 608 / 2) / SRC.w;
    const expectedCy = (0 + 1080 / 2) / SRC.h;
    expect(Math.abs(cx - expectedCx)).toBeLessThan(0.01);
    expect(Math.abs(cy - expectedCy)).toBeLessThan(0.01);
  });

  it("safeZone x is always in [0, 1]", () => {
    const crop = { x: 0, y: 0, width: 608, height: 1080 };
    const sz = cropWindowToSafeZone(crop, SRC.w, SRC.h);
    expect(sz.x).toBeGreaterThanOrEqual(0);
    expect(sz.x + sz.width).toBeLessThanOrEqual(1);
  });
});

describe("FallbackDetectionProvider", () => {
  it("returns empty arrays — never throws", async () => {
    const provider = new FallbackDetectionProvider();
    const result = await provider.detect("/nonexistent/frame.jpg");
    expect(result.faces).toEqual([]);
    expect(result.persons).toEqual([]);
  });
});

describe("buildViralityFactorsPatch", () => {
  const basePlan: ClipReframePlan = {
    ratio: "9:16",
    mode: "speaker_focus",
    anchor: "center",
    confidence: "medium",
    safeZone: { x: 0.18, y: 0.08, width: 0.64, height: 0.84 },
    reasoning: "original",
  };

  it("stores smartReframe in metadata", () => {
    const smartPlan = runCrop(faceAgg(0.3, 0.4));
    const patch = buildViralityFactorsPatch(
      { hookStrength: 80, emotionalPeak: 60, storyArc: 70, pacing: 75, transcriptQuality: 85, reframePlans: [basePlan] },
      smartPlan
    );
    expect(patch.metadata?.smartReframe).toBeDefined();
    expect((patch.metadata?.smartReframe as typeof smartPlan).strategy).toBe("face_tracking");
  });

  it("updates the 9:16 plan safeZone", () => {
    const smartPlan = runCrop(faceAgg(0.3, 0.4));
    const patch = buildViralityFactorsPatch(
      { hookStrength: 0, emotionalPeak: 0, storyArc: 0, pacing: 0, transcriptQuality: 0, reframePlans: [basePlan] },
      smartPlan
    );
    const updated916 = patch.reframePlans?.find((p) => p.ratio === "9:16");
    expect(updated916).toBeDefined();
    // New safeZone should be different from the default center
    const originalCx = 0.18 + 0.64 / 2;
    const newCx = updated916!.safeZone.x + updated916!.safeZone.width / 2;
    expect(Math.abs(newCx - originalCx)).toBeGreaterThan(0.05);
  });

  it("handles null existing viralityFactors gracefully", () => {
    const smartPlan = runCrop(emptyAgg());
    expect(() => buildViralityFactorsPatch(null, smartPlan)).not.toThrow();
  });

  it("does not mutate non-9:16 plans", () => {
    const planA: ClipReframePlan = { ...basePlan, ratio: "1:1" };
    const planB: ClipReframePlan = { ...basePlan, ratio: "16:9" };
    const smartPlan = runCrop(faceAgg(0.4, 0.3));
    const patch = buildViralityFactorsPatch(
      { hookStrength: 0, emotionalPeak: 0, storyArc: 0, pacing: 0, transcriptQuality: 0, reframePlans: [planA, planB] },
      smartPlan
    );
    const p1 = patch.reframePlans?.find((p) => p.ratio === "1:1");
    const p2 = patch.reframePlans?.find((p) => p.ratio === "16:9");
    expect(p1?.safeZone).toEqual(planA.safeZone);
    expect(p2?.safeZone).toEqual(planB.safeZone);
  });
});

describe("captions — final export does not use previewPath", () => {
  it("smartReframePlan contains sourcePath metadata, not previewPath", () => {
    const plan = runCrop(faceAgg(0.5, 0.4));
    // SmartReframePlan has no previewPath field — just source dims + crop window
    expect((plan as any).previewPath).toBeUndefined();
    expect(plan.sourceWidth).toBeDefined();
    expect(plan.sourceHeight).toBeDefined();
  });
});

describe("dynamic smart reframe path", () => {
  function movingFaceAgg(): AggregatedDetections {
    return {
      totalFrames: 5,
      faceBoxes: [0.35, 0.42, 0.5, 0.58, 0.65].map((cx, frameIndex) => ({
        frameIndex,
        box: {
          x: cx - 0.05,
          y: 0.32,
          width: 0.1,
          height: 0.14,
          confidence: 0.9,
          label: "face" as const,
        },
      })),
      personBoxes: [],
    };
  }

  it("generates a dynamic cropPath that stays inside source bounds", () => {
    const result = generateDynamicCropPathFromDetections({
      aggregated: movingFaceAgg(),
      clipStartMs: 0,
      clipEndMs: 4000,
      sourceWidth: SRC.w,
      sourceHeight: SRC.h,
      targetWidth: TGT.w,
      targetHeight: TGT.h,
      safeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
      mode: "dynamic_auto",
      smoothness: "medium",
    });

    expect(result.cropPath.length).toBe(5);
    expect(result.strategy).toBe("face_tracking");
    for (const keyframe of result.cropPath) {
      expect(keyframe.x).toBeGreaterThanOrEqual(0);
      expect(keyframe.y).toBeGreaterThanOrEqual(0);
      expect(keyframe.x + keyframe.width).toBeLessThanOrEqual(SRC.w);
      expect(keyframe.y + keyframe.height).toBeLessThanOrEqual(SRC.h);
    }
  });

  it("smoothing reduces sudden crop jumps", () => {
    const rough = [
      { timeMs: 0, x: 0, y: 0, width: 608, height: 1080, confidence: 0.9, detectionType: "face" as const },
      { timeMs: 500, x: 900, y: 0, width: 608, height: 1080, confidence: 0.9, detectionType: "face" as const },
    ];
    const smoothed = smoothCropPath(rough, { sourceWidth: SRC.w, sourceHeight: SRC.h, smoothness: "high" });
    expect(smoothed[1].x).toBeLessThan(rough[1].x);
  });

  it("interpolates short missing detections", () => {
    const agg: AggregatedDetections = {
      totalFrames: 3,
      faceBoxes: [
        { frameIndex: 0, box: { x: 0.25, y: 0.3, width: 0.1, height: 0.14, confidence: 0.9, label: "face" } },
        { frameIndex: 2, box: { x: 0.42, y: 0.3, width: 0.1, height: 0.14, confidence: 0.9, label: "face" } },
      ],
      personBoxes: [],
    };
    const result = generateDynamicCropPathFromDetections({
      aggregated: agg,
      clipStartMs: 0,
      clipEndMs: 1500,
      sourceWidth: SRC.w,
      sourceHeight: SRC.h,
      targetWidth: TGT.w,
      targetHeight: TGT.h,
      safeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
      mode: "dynamic_auto",
    });
    expect(result.cropPath[1].detectionType).toBe("interpolated");
  });

  it("keeps one primary subject instead of switching to a larger late subject", () => {
    const agg: AggregatedDetections = {
      totalFrames: 4,
      faceBoxes: [
        0, 1, 2, 3
      ].map((frameIndex) => ({
        frameIndex,
        box: { x: 0.22, y: 0.3, width: 0.1, height: 0.14, confidence: 0.82, label: "face" as const },
      })),
      personBoxes: [
        { frameIndex: 3, box: { x: 0.7, y: 0.1, width: 0.24, height: 0.7, confidence: 0.95, label: "person" } },
      ],
    };
    const result = generateDynamicCropPathFromDetections({
      aggregated: agg,
      clipStartMs: 0,
      clipEndMs: 3000,
      sourceWidth: SRC.w,
      sourceHeight: SRC.h,
      targetWidth: TGT.w,
      targetHeight: TGT.h,
      safeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
      mode: "dynamic_auto",
    });
    expect(result.strategy).toBe("face_tracking");
    expect(result.primaryTrackLength).toBe(4);
  });
});

describe("local CV worker stable smart reframe", () => {
  it("uses CV worker detections before falling back to OpenRouter/frame sampling", async () => {
    mockCvWorkerBaseUrl = "http://localhost:8010";
    mockDetectClipWithCvWorker.mockResolvedValue({
      frames: [
        {
          timeMs: 0,
          faces: [{ x: 0.2, y: 0.25, width: 0.1, height: 0.14, confidence: 0.91, label: "face" }],
          persons: [],
        },
      ],
      provider: "mediapipe",
      sampledFrames: 1,
      modelVersions: { face: "mediapipe-face-detector", person: "yolo-onnx" },
    });

    const plan = await generateStableSmartReframePlan({
      sourcePath: "/tmp/source.mp4",
      clipStartMs: 0,
      clipEndMs: 1000,
      sourceWidth: SRC.w,
      sourceHeight: SRC.h,
      targetWidth: TGT.w,
      targetHeight: TGT.h,
      mode: "smart_face",
      captionSafeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
    });

    expect(mockDetectClipWithCvWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: "/tmp/source.mp4",
        detectFaces: true,
        detectPersons: false,
      }),
      expect.objectContaining({ timeoutMs: 45000 })
    );
    expect(plan.strategy).toBe("face_tracking");
    expect(plan.faceDetections).toBe(1);
  });

  it("respects SMART_REFRAME_DETECTOR_PROVIDER=fallback by skipping local CV and API detection", async () => {
    const previous = process.env.SMART_REFRAME_DETECTOR_PROVIDER;
    process.env.SMART_REFRAME_DETECTOR_PROVIDER = "fallback";
    mockCvWorkerBaseUrl = "http://localhost:8010";

    try {
      const plan = await generateStableSmartReframePlan({
        sourcePath: "/tmp/source.mp4",
        clipStartMs: 0,
        clipEndMs: 1000,
        sourceWidth: SRC.w,
        sourceHeight: SRC.h,
        targetWidth: TGT.w,
        targetHeight: TGT.h,
        mode: "smart_face",
        captionSafeZone: DEFAULT_SHORT_FORM_SAFE_ZONE,
      });

      expect(mockDetectClipWithCvWorker).not.toHaveBeenCalled();
      expect(plan.strategy).toBe("center_crop");
      expect(plan.fallbackReason).toBeTruthy();
    } finally {
      if (previous === undefined) {
        delete process.env.SMART_REFRAME_DETECTOR_PROVIDER;
      } else {
        process.env.SMART_REFRAME_DETECTOR_PROVIDER = previous;
      }
    }
  });
});
