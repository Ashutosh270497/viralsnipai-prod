export const V1_CLIP_POLICY = {
  minMs: 18_000,
  idealMs: 35_000,
  maxMs: 58_000,
  preRollMs: 300,
  postRollMs: 500,
  maxDeadAirMs: 900,
  minWords: 35,
  maxWords: 160,
  targetCandidateCount: 120,
  minCandidateMultiplier: 5,
  minCandidatePool: 15,
  maxCandidatePool: 60,
  defaultTargetClips: 5,
  maxTargetClips: 8,
};

export type ClipPolicy = typeof V1_CLIP_POLICY;

export type ClipLengthPreset = "short" | "balanced" | "detailed";

export const CLIP_LENGTH_PRESET_POLICIES: Record<ClipLengthPreset, ClipPolicy> = {
  short: {
    ...V1_CLIP_POLICY,
    minMs: 18_000,
    idealMs: 24_000,
    maxMs: 30_000,
  },
  balanced: {
    ...V1_CLIP_POLICY,
    minMs: 24_000,
    idealMs: 38_000,
    maxMs: 45_000,
  },
  detailed: {
    ...V1_CLIP_POLICY,
    minMs: 35_000,
    idealMs: 48_000,
    maxMs: 58_000,
  },
};

export function resolveClipPolicy(preset?: ClipLengthPreset): ClipPolicy {
  return CLIP_LENGTH_PRESET_POLICIES[preset ?? "balanced"];
}
