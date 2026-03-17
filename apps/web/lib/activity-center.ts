import { prisma } from "@/lib/prisma";

export type UnifiedActivityStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "needs_action";

export type UnifiedActivityDomain =
  | "creator_studio"
  | "repurpose_os"
  | "transcribe"
  | "snipradar";

export type UnifiedActivityKind =
  | "content_idea_generation"
  | "script_generation"
  | "title_generation"
  | "thumbnail_generation"
  | "script_tts"
  | "youtube_ingest"
  | "export_render"
  | "voice_translation"
  | "transcript_job"
  | "snipradar_scheduler_draft"
  | "snipradar_scheduler_run"
  | "snipradar_profile_audit"
  | "snipradar_research_index";

export interface UnifiedActivityAction {
  label: string;
  href: string;
}

export interface UnifiedActivityItem {
  id: string;
  domain: UnifiedActivityDomain;
  kind: UnifiedActivityKind;
  status: UnifiedActivityStatus;
  rawStatus: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  progressPct: number | null;
  error: string | null;
  nextAction: UnifiedActivityAction | null;
  metadataSummary: string[];
}

export interface UnifiedActivitySummary {
  total: number;
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  needsAction: number;
}

export interface UnifiedActivityData {
  summary: UnifiedActivitySummary;
  items: UnifiedActivityItem[];
  inFlightItems: UnifiedActivityItem[];
  attentionItems: UnifiedActivityItem[];
  recentCompletedItems: UnifiedActivityItem[];
}

const CONTENT_ACTIVITY_FEATURES = new Set([
  "content_calendar_generation",
  "script",
  "title",
  "thumbnail",
  "script-tts",
]);

const DEFAULT_LIMIT = 30;
const DEFAULT_PER_SOURCE_LIMIT = 8;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clipText(value: string, max = 84) {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function iso(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

function itemTimestamp(item: UnifiedActivityItem) {
  return Date.parse(item.updatedAt || item.createdAt);
}

export function normalizeUnifiedActivityStatus(rawStatus: string): UnifiedActivityStatus {
  const normalized = rawStatus.trim().toLowerCase();

  if ([
    "queued",
    "scheduled",
    "pending",
  ].includes(normalized)) {
    return "queued";
  }

  if ([
    "processing",
    "posting",
    "running",
    "in_progress",
  ].includes(normalized)) {
    return "processing";
  }

  if ([
    "completed",
    "complete",
    "done",
    "posted",
    "success",
    "successful",
  ].includes(normalized)) {
    return "succeeded";
  }

  if ([
    "failed",
    "error",
    "rejected",
  ].includes(normalized)) {
    return "failed";
  }

  if ([
    "partial",
    "locked",
    "empty",
    "stalled",
  ].includes(normalized)) {
    return "needs_action";
  }

  return "needs_action";
}

export function summarizeUnifiedActivityItems(
  items: UnifiedActivityItem[]
): UnifiedActivitySummary {
  return items.reduce<UnifiedActivitySummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.status === "queued") summary.queued += 1;
      if (item.status === "processing") summary.processing += 1;
      if (item.status === "succeeded") summary.succeeded += 1;
      if (item.status === "failed") summary.failed += 1;
      if (item.status === "needs_action") summary.needsAction += 1;
      return summary;
    },
    {
      total: 0,
      queued: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      needsAction: 0,
    }
  );
}

function buildUsageLogItem(input: {
  id: string;
  feature: string;
  metadata: unknown;
  createdAt: Date;
}): UnifiedActivityItem | null {
  if (!CONTENT_ACTIVITY_FEATURES.has(input.feature)) {
    return null;
  }

  const metadata = asRecord(input.metadata);

  if (input.feature === "content_calendar_generation") {
    const ideasGenerated = readNumber(metadata?.ideasGenerated);
    const niche = readString(metadata?.niche);
    return {
      id: `usage:${input.id}`,
      domain: "creator_studio",
      kind: "content_idea_generation",
      status: "succeeded",
      rawStatus: "completed",
      title: "Content ideas generated",
      description: niche
        ? `Created a fresh content plan for ${niche}.`
        : "Created a fresh set of content ideas.",
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Review ideas", href: "/dashboard/content-calendar" },
      metadataSummary: ideasGenerated ? [`${ideasGenerated} ideas`] : [],
    };
  }

  if (input.feature === "script") {
    const duration = readString(metadata?.targetDuration);
    return {
      id: `usage:${input.id}`,
      domain: "creator_studio",
      kind: "script_generation",
      status: "succeeded",
      rawStatus: "completed",
      title: "Script generated",
      description: "A production-ready script was generated from your content workflow.",
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Open Script Generator", href: "/dashboard/script-generator" },
      metadataSummary: duration ? [`Duration: ${duration}`] : [],
    };
  }

  if (input.feature === "title") {
    const titleCount = readNumber(metadata?.titleCount);
    return {
      id: `usage:${input.id}`,
      domain: "creator_studio",
      kind: "title_generation",
      status: "succeeded",
      rawStatus: "completed",
      title: "Titles generated",
      description: "New title variants are ready for review and selection.",
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Open Title Generator", href: "/dashboard/title-generator" },
      metadataSummary: titleCount ? [`${titleCount} title options`] : [],
    };
  }

  if (input.feature === "thumbnail") {
    const thumbnailCount = readNumber(metadata?.thumbnailCount);
    return {
      id: `usage:${input.id}`,
      domain: "creator_studio",
      kind: "thumbnail_generation",
      status: "succeeded",
      rawStatus: "completed",
      title: "Thumbnails generated",
      description: "Thumbnail concepts are ready for CTR review.",
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Open Thumbnail Generator", href: "/dashboard/thumbnail-generator" },
      metadataSummary: thumbnailCount ? [`${thumbnailCount} variants`] : [],
    };
  }

  if (input.feature === "script-tts") {
    const voice = readString(metadata?.voice);
    return {
      id: `usage:${input.id}`,
      domain: "creator_studio",
      kind: "script_tts",
      status: "succeeded",
      rawStatus: "completed",
      title: "Script audio rendered",
      description: "Voice synthesis completed for a script section.",
      createdAt: iso(input.createdAt),
      updatedAt: iso(input.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Open Script Generator", href: "/dashboard/script-generator" },
      metadataSummary: voice ? [`Voice: ${voice}`] : [],
    };
  }

  return null;
}

function buildSnipRadarDraftDescription(text: string, scheduledFor: Date | null, postedAt: Date | null) {
  if (scheduledFor) {
    return `Queued for ${scheduledFor.toLocaleString()}.`;
  }
  if (postedAt) {
    return `Posted on ${postedAt.toLocaleString()}.`;
  }
  return clipText(text, 120);
}

function statusAction(
  status: UnifiedActivityStatus,
  config: {
    openLabel: string;
    openHref: string;
    retryLabel?: string;
    inspectLabel?: string;
  }
): UnifiedActivityAction {
  if (status === "failed") {
    return { label: config.retryLabel ?? `Retry in ${config.openLabel}`, href: config.openHref };
  }
  if (status === "needs_action") {
    return { label: config.inspectLabel ?? `Inspect in ${config.openLabel}`, href: config.openHref };
  }
  if (status === "queued" || status === "processing") {
    return { label: `Track in ${config.openLabel}`, href: config.openHref };
  }
  return { label: `Open ${config.openLabel}`, href: config.openHref };
}

export async function getUnifiedActivityData(
  userId: string,
  options?: { limit?: number; perSourceLimit?: number }
): Promise<UnifiedActivityData> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const perSourceLimit = options?.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;

  const [
    usageLogs,
    transcriptJobs,
    ingestJobs,
    exports,
    voiceTranslations,
    tweetDrafts,
    schedulerRuns,
    profileAuditSnapshots,
    researchIndexRuns,
  ] = await Promise.all([
    prisma.usageLog.findMany({
      where: {
        userId,
        feature: { in: Array.from(CONTENT_ACTIVITY_FEATURES) },
      },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        feature: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.transcriptJob.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        status: true,
        sourceType: true,
        sourceUrl: true,
        title: true,
        durationSec: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.youTubeIngestJob.findMany({
      where: { project: { userId } },
      orderBy: { updatedAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        status: true,
        sourceUrl: true,
        processingTime: true,
        metadata: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.export.findMany({
      where: { project: { userId } },
      orderBy: { updatedAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        preset: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    prisma.voiceTranslation.findMany({
      where: { asset: { project: { userId } } },
      orderBy: { updatedAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        language: true,
        status: true,
        error: true,
        processingTime: true,
        createdAt: true,
        updatedAt: true,
        asset: {
          select: {
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    prisma.tweetDraft.findMany({
      where: {
        userId,
        status: { in: ["scheduled", "posting", "posted", "rejected"] },
      },
      orderBy: { updatedAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        text: true,
        status: true,
        scheduledFor: true,
        postedAt: true,
        actualImpressions: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.xSchedulerRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        source: true,
        status: true,
        attempted: true,
        posted: true,
        failed: true,
        skipped: true,
        errorSummary: true,
        createdAt: true,
      },
    }),
    prisma.xProfileAuditSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        xUsername: true,
        score: true,
        grade: true,
        headline: true,
        createdAt: true,
      },
    }),
    prisma.xResearchIndexRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: perSourceLimit,
      select: {
        id: true,
        status: true,
        documentsScanned: true,
        documentsEmbedded: true,
        failedEmbeddings: true,
        errorSummary: true,
        createdAt: true,
      },
    }),
  ]);

  const items: UnifiedActivityItem[] = [
    ...usageLogs
      .map((log) =>
        buildUsageLogItem({
          id: log.id,
          feature: log.feature,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })
      )
      .filter((item): item is UnifiedActivityItem => Boolean(item)),
    ...transcriptJobs.map<UnifiedActivityItem>((job) => {
      const status = normalizeUnifiedActivityStatus(job.status);
      const sourceLabel =
        job.sourceType === "youtube" ? "YouTube transcript job" : "Upload transcript job";
      return {
        id: `transcript:${job.id}`,
        domain: "transcribe",
        kind: "transcript_job",
        status,
        rawStatus: job.status,
        title: job.title ? clipText(job.title, 72) : sourceLabel,
        description:
          job.sourceType === "youtube"
            ? "Transcribing a YouTube source for reuse and extraction."
            : "Transcribing an uploaded audio or video file.",
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt),
        progressPct: status === "processing" ? 60 : status === "succeeded" ? 100 : null,
        error: job.error,
        nextAction: statusAction(status, {
          openLabel: "Transcribe",
          openHref: "/transcribe",
          retryLabel: "Retry in Transcribe",
        }),
        metadataSummary: [
          `Source: ${job.sourceType}`,
          ...(job.durationSec ? [`${job.durationSec}s`] : []),
        ],
      };
    }),
    ...ingestJobs.map<UnifiedActivityItem>((job) => {
      const status = normalizeUnifiedActivityStatus(job.status);
      const metadata = asRecord(job.metadata);
      const progress = readNumber(metadata?.progress);
      const phase = readString(metadata?.phase);
      return {
        id: `ingest:${job.id}`,
        domain: "repurpose_os",
        kind: "youtube_ingest",
        status,
        rawStatus: job.status,
        title: job.project.title ? `Repurpose ingest · ${clipText(job.project.title, 64)}` : "Repurpose ingest",
        description:
          phase ??
          "Pulling source video, transcript, and metadata into RepurposeOS.",
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt),
        progressPct: progress ?? (status === "succeeded" ? 100 : null),
        error: job.error,
        nextAction: statusAction(status, {
          openLabel: "RepurposeOS",
          openHref: "/repurpose",
          retryLabel: "Retry in RepurposeOS",
        }),
        metadataSummary: [
          ...(job.processingTime ? [`${job.processingTime}ms`] : []),
          ...(job.sourceUrl ? [clipText(job.sourceUrl, 54)] : []),
        ],
      };
    }),
    ...exports.map<UnifiedActivityItem>((job) => {
      const status = normalizeUnifiedActivityStatus(job.status);
      return {
        id: `export:${job.id}`,
        domain: "repurpose_os",
        kind: "export_render",
        status,
        rawStatus: job.status,
        title: job.project.title ? `Export render · ${clipText(job.project.title, 64)}` : "Export render",
        description: `Rendering a ${job.preset} export from selected clips.`,
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt),
        progressPct: status === "processing" ? 55 : status === "succeeded" ? 100 : null,
        error: job.error,
        nextAction: statusAction(status, {
          openLabel: "Repurpose export",
          openHref: "/repurpose/export",
          retryLabel: "Re-open export",
        }),
        metadataSummary: [`Preset: ${job.preset}`],
      };
    }),
    ...voiceTranslations.map<UnifiedActivityItem>((job) => {
      const status = normalizeUnifiedActivityStatus(job.status);
      const projectTitle = job.asset.project.title;
      return {
        id: `voice:${job.id}`,
        domain: "repurpose_os",
        kind: "voice_translation",
        status,
        rawStatus: job.status,
        title: projectTitle
          ? `Voice translation · ${clipText(projectTitle, 64)}`
          : "Voice translation",
        description: `Generating translated audio in ${job.language.toUpperCase()}.`,
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt),
        progressPct: status === "processing" ? 65 : status === "succeeded" ? 100 : null,
        error: job.error,
        nextAction: statusAction(status, {
          openLabel: "Repurpose editor",
          openHref: "/repurpose/editor",
          retryLabel: "Retry translation",
        }),
        metadataSummary: [
          `Language: ${job.language.toUpperCase()}`,
          ...(job.processingTime ? [`${job.processingTime}ms`] : []),
        ],
      };
    }),
    ...tweetDrafts.map<UnifiedActivityItem>((draft) => {
      const status = normalizeUnifiedActivityStatus(draft.status);
      const metrics =
        draft.actualImpressions && draft.actualImpressions > 0
          ? [`${draft.actualImpressions.toLocaleString()} impressions`]
          : [];
      return {
        id: `draft:${draft.id}`,
        domain: "snipradar",
        kind: "snipradar_scheduler_draft",
        status,
        rawStatus: draft.status,
        title: clipText(draft.text.replace(/\s+/g, " "), 78),
        description: buildSnipRadarDraftDescription(draft.text, draft.scheduledFor, draft.postedAt),
        createdAt: iso(draft.createdAt),
        updatedAt: iso(draft.updatedAt),
        progressPct:
          status === "queued" ? 15 : status === "processing" ? 75 : status === "succeeded" ? 100 : null,
        error: draft.status === "rejected" ? "Draft was rejected and needs revision." : null,
        nextAction: statusAction(status, {
          openLabel: "SnipRadar Publish",
          openHref: "/snipradar/publish/scheduler",
          retryLabel: "Open Publish",
          inspectLabel: "Review in Publish",
        }),
        metadataSummary: metrics,
      };
    }),
    ...schedulerRuns.map<UnifiedActivityItem>((run) => {
      const status = normalizeUnifiedActivityStatus(run.status);
      return {
        id: `scheduler:${run.id}`,
        domain: "snipradar",
        kind: "snipradar_scheduler_run",
        status,
        rawStatus: run.status,
        title: "SnipRadar scheduler run",
        description:
          run.status === "success"
            ? "Scheduled posts were processed successfully."
            : run.status === "partial"
            ? "Some scheduled posts were processed, but follow-up is required."
            : run.status === "failed"
            ? "Scheduled posting failed."
            : "Scheduler run requires review.",
        createdAt: iso(run.createdAt),
        updatedAt: iso(run.createdAt),
        progressPct: status === "succeeded" ? 100 : null,
        error: run.errorSummary,
        nextAction: statusAction(status, {
          openLabel: "SnipRadar Analytics",
          openHref: "/snipradar/analytics",
          retryLabel: "Inspect scheduler ops",
        }),
        metadataSummary: [
          `${run.posted}/${run.attempted} posted`,
          run.failed > 0 ? `${run.failed} failed` : `${run.skipped} skipped`,
          `Source: ${run.source}`,
        ],
      };
    }),
    ...profileAuditSnapshots.map<UnifiedActivityItem>((snapshot) => ({
      id: `audit:${snapshot.id}`,
      domain: "snipradar",
      kind: "snipradar_profile_audit",
      status: "succeeded" as const,
      rawStatus: "completed",
      title: `Profile audit · @${snapshot.xUsername}`,
      description: snapshot.headline || "AI audit and growth recommendations are ready.",
      createdAt: iso(snapshot.createdAt),
      updatedAt: iso(snapshot.createdAt),
      progressPct: 100,
      error: null,
      nextAction: { label: "Open Overview", href: "/snipradar/overview" },
      metadataSummary: [`Score: ${snapshot.score}`, `Grade: ${snapshot.grade}`],
    })),
    ...researchIndexRuns.map<UnifiedActivityItem>((run) => {
      const status = normalizeUnifiedActivityStatus(run.status);
      return {
        id: `research:${run.id}`,
        domain: "snipradar",
        kind: "snipradar_research_index",
        status,
        rawStatus: run.status,
        title: "Research corpus refresh",
        description:
          run.status === "success"
            ? "Research corpus is up to date."
            : run.status === "partial"
            ? "Corpus refreshed with some embedding failures."
            : "Corpus refresh failed.",
        createdAt: iso(run.createdAt),
        updatedAt: iso(run.createdAt),
        progressPct: status === "succeeded" ? 100 : null,
        error: run.errorSummary,
        nextAction: statusAction(status, {
          openLabel: "SnipRadar Research",
          openHref: "/snipradar/create/research",
          retryLabel: "Refresh corpus",
        }),
        metadataSummary: [
          `${run.documentsScanned} scanned`,
          `${run.documentsEmbedded} embedded`,
          ...(run.failedEmbeddings > 0 ? [`${run.failedEmbeddings} failed embeddings`] : []),
        ],
      };
    }),
  ]
    .sort((left, right) => itemTimestamp(right) - itemTimestamp(left));

  const limitedItems = items.slice(0, limit);
  const inFlightItems = limitedItems.filter(
    (item) => item.status === "queued" || item.status === "processing"
  );
  const attentionItems = limitedItems.filter(
    (item) => item.status === "failed" || item.status === "needs_action"
  );
  const recentCompletedItems = limitedItems.filter((item) => item.status === "succeeded");

  return {
    summary: summarizeUnifiedActivityItems(items),
    items: limitedItems,
    inFlightItems,
    attentionItems,
    recentCompletedItems,
  };
}
