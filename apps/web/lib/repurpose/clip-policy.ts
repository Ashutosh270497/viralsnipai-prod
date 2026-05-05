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
  defaultTargetClips: 5,
  maxTargetClips: 8,
};

export type ClipPolicy = typeof V1_CLIP_POLICY;
