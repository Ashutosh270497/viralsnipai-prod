/**
 * Smart Reframe Module — Public exports
 */

export type {
  SmartReframePlan,
  SmartReframeMode,
  SmartReframeStrategy,
  DetectionBox,
  CaptionSafeZone,
  FrameDetectionProvider,
  FrameDetectionResult,
  AggregatedDetections,
  CropKeyframe,
  CropWindow,
  TrackingSmoothness,
  SubjectPosition,
} from "./tracking-types";

export {
  DEFAULT_SHORT_FORM_SAFE_ZONE,
  DEFAULT_LANDSCAPE_SAFE_ZONE,
  DEFAULT_SQUARE_SAFE_ZONE,
  getDefaultCaptionSafeZone,
  isFaceInCaptionZone,
} from "./safe-zones";

export {
  computeStableCropWindow,
  cropWindowToSafeZone,
  MIN_CONFIDENCE_FACE,
  MIN_CONFIDENCE_PERSON,
  FACE_TARGET_Y_RATIO,
  PERSON_TARGET_Y_RATIO,
} from "./crop-window";

export {
  generateStableSmartReframePlan,
  applySmartReframeToPlan,
  buildViralityFactorsPatch,
  generateDynamicSmartReframePlan,
} from "./smart-reframe.service";

export {
  generateDynamicCropPathFromDetections,
} from "./dynamic-tracking";

export {
  smoothCropPath,
  SMOOTHING_ALPHA,
  DEADBAND_X_PCT,
  DEADBAND_Y_PCT,
  MAX_CROP_SHIFT_PER_SECOND_X,
  MAX_CROP_SHIFT_PER_SECOND_Y,
  MISSING_DETECTION_INTERPOLATE_MS,
  MISSING_DETECTION_FALLBACK_MS,
} from "./tracking-smoothing";

export { FallbackDetectionProvider, VisionApiDetectionProvider, createDetectionProvider } from "./vision-api-detector";
