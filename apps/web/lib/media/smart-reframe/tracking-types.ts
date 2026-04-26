/**
 * Smart Reframe — Shared Types (Phase 1)
 *
 * All coordinates use the following conventions unless stated otherwise:
 *   - Normalized: 0.0 = left/top edge, 1.0 = right/bottom edge
 *   - Pixel: integer pixel offset from top-left
 */

/** The mode the caller requests. */
export type SmartReframeMode =
  | "smart_auto"        // Detect face first, then person, then center_crop
  | "smart_face"        // Only use face detection; fallback to center_crop
  | "smart_person"      // Only use person/body detection; fallback to center_crop
  | "dynamic_auto"      // Dynamic crop path: face first, person fallback
  | "dynamic_face"      // Dynamic crop path: face only
  | "dynamic_person"    // Dynamic crop path: person only
  | "center_crop"       // Geometric center — no detection
  | "blurred_background"; // Blur-pad pillarbox (not implemented in Phase 1 render, stored only)

export type SmartReframePlanMode = "stable" | "dynamic";
export type TrackingSmoothness = "low" | "medium" | "high";
export type SubjectPosition = "center" | "slightly_up" | "slightly_down";

/** The strategy the engine actually used. */
export type SmartReframeStrategy =
  | "face_tracking"
  | "person_tracking"
  | "center_crop"
  | "blurred_background";

/**
 * A normalized bounding box returned by a detection provider.
 * All coordinates are 0-1 relative to the frame dimensions.
 */
export interface DetectionBox {
  x: number;           // left edge normalized
  y: number;           // top edge normalized
  width: number;       // box width normalized
  height: number;      // box height normalized
  confidence: number;  // 0-1 detector confidence
  label: "face" | "person" | "subject";
}

export interface CropWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropKeyframe extends CropWindow {
  timeMs: number;
  confidence: number;
  detectionType: "face" | "person" | "interpolated" | "fallback";
}

/**
 * Caption-safe zone expressed as percentage margins from each edge.
 * Keeps captions out of the face/subject area.
 */
export interface CaptionSafeZone {
  topPct: number;      // e.g. 0.10 = top 10% is reserved (avoid placing captions here)
  bottomPct: number;   // e.g. 0.20 = bottom 20% is the caption zone
  leftPct: number;
  rightPct: number;
  preferredCaptionY: "lower_third" | "middle" | "upper";
}

/**
 * The final stable reframe plan for a single clip.
 * Stored in clip.viralityFactors.metadata.smartReframe.
 */
export interface SmartReframePlan {
  strategy: SmartReframeStrategy;
  mode: SmartReframePlanMode;
  confidence: number;        // 0-1 aggregate detection confidence; 0 if fallback
  sourceWidth: number;       // pixels
  sourceHeight: number;      // pixels
  targetWidth: number;       // pixels
  targetHeight: number;      // pixels

  /** Pixel crop window in the source frame. */
  cropWindow: CropWindow;
  cropPath?: CropKeyframe[];

  /**
   * Normalized subject center (0-1) that was fed back into the existing
   * ClipReframePlan.safeZone so the FFmpeg pipeline uses the right center.
   */
  subjectCenterNormalized: {
    x: number;
    y: number;
  };

  safeZone: CaptionSafeZone;
  fallbackReason?: string;
  sampledFrames: number;
  faceDetections: number;
  personDetections: number;
  primaryTrackLength?: number;
  smoothing?: TrackingSmoothness;
  subjectPosition?: SubjectPosition;
  analyzedAt: string;         // ISO timestamp
}

/** Result from a single frame detection call. */
export interface FrameDetectionResult {
  faces: DetectionBox[];
  persons: DetectionBox[];
  primarySubject?: DetectionBox;
}

/**
 * Pluggable frame detection provider interface.
 * Any implementation must not throw — return empty arrays on failure.
 */
export interface FrameDetectionProvider {
  detect(framePath: string): Promise<FrameDetectionResult>;
}

/** Aggregated detection data across all sampled frames. */
export interface AggregatedDetections {
  faceBoxes: Array<{ box: DetectionBox; frameIndex: number }>;
  personBoxes: Array<{ box: DetectionBox; frameIndex: number }>;
  totalFrames: number;
}
