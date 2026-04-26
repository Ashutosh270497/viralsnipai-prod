import type {
  AggregatedDetections,
  CaptionSafeZone,
  CropKeyframe,
  DetectionBox,
  SmartReframeMode,
  SmartReframePlan,
  SmartReframeStrategy,
  SubjectPosition,
  TrackingSmoothness,
} from "./tracking-types";
import { computeCropPixels, MIN_CONFIDENCE_FACE, MIN_CONFIDENCE_PERSON } from "./crop-window";
import { MISSING_DETECTION_INTERPOLATE_MS, smoothCropPath } from "./tracking-smoothing";

type Observation = {
  frameIndex: number;
  timeMs: number;
  box: DetectionBox;
  type: "face" | "person";
};

type Track = {
  id: number;
  observations: Observation[];
};

export type DynamicPathResult = {
  cropPath: CropKeyframe[];
  confidence: number;
  strategy: SmartReframeStrategy;
  primaryTrackLength: number;
  fallbackReason?: string;
};

const TRACK_MAX_CENTER_DISTANCE = 0.24;

function center(box: DetectionBox) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function distance(a: DetectionBox, b: DetectionBox) {
  const ca = center(a);
  const cb = center(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function area(box: DetectionBox) {
  return box.width * box.height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function subjectTargetY(strategy: SmartReframeStrategy, subjectPosition: SubjectPosition) {
  const base = strategy === "person_tracking" ? 0.45 : 0.38;
  if (subjectPosition === "slightly_up") return Math.max(0.28, base - 0.07);
  if (subjectPosition === "slightly_down") return Math.min(0.58, base + 0.07);
  return base;
}

function buildObservations(params: {
  aggregated: AggregatedDetections;
  clipStartMs: number;
  clipEndMs: number;
  mode: SmartReframeMode;
}): Observation[] {
  const { aggregated, clipStartMs, clipEndMs, mode } = params;
  const duration = Math.max(1, clipEndMs - clipStartMs);
  const frameCount = Math.max(1, aggregated.totalFrames);
  const timeForFrame = (frameIndex: number) =>
    clipStartMs + (frameCount === 1 ? 0 : Math.round((duration * frameIndex) / (frameCount - 1)));

  const allowFaces = mode === "dynamic_auto" || mode === "dynamic_face" || mode === "smart_auto" || mode === "smart_face";
  const allowPersons = mode === "dynamic_auto" || mode === "dynamic_person" || mode === "smart_auto" || mode === "smart_person";

  const faceObservations = allowFaces
    ? aggregated.faceBoxes
        .filter(({ box }) => box.confidence >= MIN_CONFIDENCE_FACE)
        .map(({ box, frameIndex }) => ({ frameIndex, timeMs: timeForFrame(frameIndex), box, type: "face" as const }))
    : [];
  const personObservations = allowPersons
    ? aggregated.personBoxes
        .filter(({ box }) => box.confidence >= MIN_CONFIDENCE_PERSON)
        .map(({ box, frameIndex }) => ({ frameIndex, timeMs: timeForFrame(frameIndex), box, type: "person" as const }))
    : [];

  return [...faceObservations, ...personObservations].sort((a, b) => a.frameIndex - b.frameIndex);
}

function buildSubjectTracks(observations: Observation[]): Track[] {
  const tracks: Track[] = [];
  let nextId = 1;

  for (const observation of observations) {
    const candidates = tracks
      .map((track) => ({
        track,
        last: track.observations[track.observations.length - 1],
      }))
      .filter(({ last }) => last.frameIndex < observation.frameIndex)
      .map(({ track, last }) => ({ track, dist: distance(last.box, observation.box) }))
      .sort((a, b) => a.dist - b.dist);

    const nearest = candidates[0];
    if (nearest && nearest.dist <= TRACK_MAX_CENTER_DISTANCE) {
      nearest.track.observations.push(observation);
    } else {
      tracks.push({ id: nextId, observations: [observation] });
      nextId += 1;
    }
  }

  return tracks;
}

function scoreTrack(track: Track, frameCount: number) {
  const count = track.observations.length;
  const avgConfidence = track.observations.reduce((sum, item) => sum + item.box.confidence, 0) / Math.max(1, count);
  const avgArea = track.observations.reduce((sum, item) => sum + area(item.box), 0) / Math.max(1, count);
  const faceBonus = track.observations.some((item) => item.type === "face") ? 0.08 : 0;
  return (count / Math.max(1, frameCount)) * 0.52 + avgConfidence * 0.3 + Math.min(avgArea * 4, 0.1) + faceBonus;
}

function interpolateObservation(before: Observation, after: Observation, timeMs: number, frameIndex: number): Observation {
  const span = Math.max(1, after.timeMs - before.timeMs);
  const t = clamp((timeMs - before.timeMs) / span, 0, 1);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    frameIndex,
    timeMs,
    type: before.type,
    box: {
      label: before.box.label,
      x: lerp(before.box.x, after.box.x),
      y: lerp(before.box.y, after.box.y),
      width: lerp(before.box.width, after.box.width),
      height: lerp(before.box.height, after.box.height),
      confidence: Math.min(before.box.confidence, after.box.confidence) * 0.82,
    },
  };
}

export function generateDynamicCropPathFromDetections(params: {
  aggregated: AggregatedDetections;
  clipStartMs: number;
  clipEndMs: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  mode: SmartReframeMode;
  safeZone: CaptionSafeZone;
  smoothness?: TrackingSmoothness;
  subjectPosition?: SubjectPosition;
}): DynamicPathResult {
  const observations = buildObservations(params);
  const frameCount = Math.max(1, params.aggregated.totalFrames);

  if (observations.length === 0) {
    return {
      cropPath: [],
      confidence: 0,
      strategy: "center_crop",
      primaryTrackLength: 0,
      fallbackReason: "No face or person detections available for dynamic tracking.",
    };
  }

  const tracks = buildSubjectTracks(observations);
  const primary = tracks.sort((a, b) => scoreTrack(b, frameCount) - scoreTrack(a, frameCount))[0];
  const primaryByFrame = new Map(primary.observations.map((item) => [item.frameIndex, item]));
  const strategy: SmartReframeStrategy = primary.observations.some((item) => item.type === "face")
    ? "face_tracking"
    : "person_tracking";
  const targetYRatio = subjectTargetY(strategy, params.subjectPosition ?? "center");
  const duration = Math.max(1, params.clipEndMs - params.clipStartMs);
  const timeForFrame = (frameIndex: number) =>
    params.clipStartMs + (frameCount === 1 ? 0 : Math.round((duration * frameIndex) / (frameCount - 1)));

  const rawPath: CropKeyframe[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timeMs = timeForFrame(frameIndex);
    let observation = primaryByFrame.get(frameIndex);
    let detectionType: CropKeyframe["detectionType"] | null = observation?.type ?? null;

    if (!observation) {
      const before = [...primary.observations].reverse().find((item) => item.frameIndex < frameIndex);
      const after = primary.observations.find((item) => item.frameIndex > frameIndex);
      if (before && after && after.timeMs - before.timeMs <= MISSING_DETECTION_INTERPOLATE_MS) {
        observation = interpolateObservation(before, after, timeMs, frameIndex);
        detectionType = "interpolated";
      }
    }

    if (!observation) {
      const centerCrop = computeCropPixels({
        sourceWidth: params.sourceWidth,
        sourceHeight: params.sourceHeight,
        targetWidth: params.targetWidth,
        targetHeight: params.targetHeight,
        subjectCenterX: 0.5,
        subjectCenterY: 0.5,
        targetYRatio: 0.5,
      });
      rawPath.push({ timeMs, ...centerCrop, confidence: 0, detectionType: "fallback" });
      continue;
    }

    const subject = center(observation.box);
    const crop = computeCropPixels({
      sourceWidth: params.sourceWidth,
      sourceHeight: params.sourceHeight,
      targetWidth: params.targetWidth,
      targetHeight: params.targetHeight,
      subjectCenterX: subject.x,
      subjectCenterY: subject.y,
      targetYRatio,
    });
    rawPath.push({
      timeMs,
      ...crop,
      confidence: observation.box.confidence,
      detectionType: detectionType ?? observation.type,
    });
  }

  const cropPath = smoothCropPath(rawPath, {
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    smoothness: params.smoothness,
  });
  const confidence = Math.round(scoreTrack(primary, frameCount) * 100) / 100;

  return {
    cropPath,
    confidence,
    strategy,
    primaryTrackLength: primary.observations.length,
  };
}

export function buildDynamicPlanFromStableFallback(stablePlan: SmartReframePlan, reason: string): SmartReframePlan {
  return {
    ...stablePlan,
    mode: "stable",
    fallbackReason: stablePlan.fallbackReason ? `${reason} ${stablePlan.fallbackReason}` : reason,
  };
}
