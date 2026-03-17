import crypto from "crypto";

import { Prisma } from "@prisma/client";

import { generateResearchSynthesis, type ResearchSynthesis } from "@/lib/ai/research-copilot";
import { getViralTemplates } from "@/lib/data/viral-templates";
import { HAS_OPENROUTER_KEY, OPENROUTER_MODELS, openRouterClient } from "@/lib/openrouter-client";
import { prisma } from "@/lib/prisma";
import { buildResearchInboxDraftSeed } from "@/lib/snipradar/inbox";

export type ResearchSource =
  | "viral_tweet"
  | "opportunity"
  | "draft"
  | "template"
  | "hooksmith_script"
  | "content_idea"
  | "inbox_capture";

export type ResearchResult = {
  id: string;
  source: ResearchSource;
  title: string;
  body: string;
  meta: string[];
  score: number;
  matchReasons: string[];
  draftSeed: string;
  sourceUpdatedAt: string | null;
};

export type ResearchQueryResponse = {
  query: string;
  summary: string;
  synthesis: ResearchSynthesis | null;
  resultCounts: {
    viralTweets: number;
    opportunities: number;
    drafts: number;
    templates: number;
    hooksmithScripts: number;
    contentIdeas: number;
    inboxCaptures: number;
    total: number;
  };
  indexStatus: ResearchIndexStatus;
  groups: {
    viralTweets: ResearchResult[];
    opportunities: ResearchResult[];
    drafts: ResearchResult[];
    templates: ResearchResult[];
    hooksmithScripts: ResearchResult[];
    contentIdeas: ResearchResult[];
    inboxCaptures: ResearchResult[];
  };
};

export type ResearchIndexStatus = {
  state: "empty" | "ready" | "stale" | "error";
  isStale: boolean;
  totalDocuments: number;
  counts: {
    viralTweets: number;
    opportunities: number;
    drafts: number;
    templates: number;
    hooksmithScripts: number;
    contentIdeas: number;
    inboxCaptures: number;
    total: number;
  };
  embeddedDocuments: number;
  usingEmbeddings: boolean;
  lastIndexedAt: string | null;
  lastRunStatus: "success" | "partial" | "failed" | null;
  lastErrorSummary: string | null;
  staleAfterMs: number;
};

type ResearchDocument = {
  source: ResearchSource;
  sourceRecordId: string;
  title: string;
  body: string;
  snippet: string;
  tags: string[];
  metadata: Prisma.JsonObject;
  normalizedText: string;
  contentHash: string;
  sourceUpdatedAt: Date | null;
};

type RankedResearchDocument = {
  id: string;
  source: ResearchSource;
  sourceRecordId: string;
  title: string;
  snippet: string;
  tags: string[];
  metadata: Prisma.JsonValue | null;
  sourceUpdatedAt: Date | null;
  totalScore: number;
  matchReasons: string[];
};

type SearchResearchParams = {
  userId: string;
  query: string;
  limitPerSource?: number;
  selectedNiche?: string | null;
};

type EnsureResearchIndexParams = {
  userId: string;
  selectedNiche?: string | null;
  force?: boolean;
};

const RESEARCH_INDEX_STALE_MS = Number(process.env.SNIPRADAR_RESEARCH_STALE_MS ?? 6 * 60 * 60 * 1000);
const RESEARCH_EMBEDDING_MODEL = OPENROUTER_MODELS.snipradarResearchEmbeddings;
const RESEARCH_EMBEDDING_TIMEOUT_MS = Number(process.env.OPENAI_SNIPRADAR_RESEARCH_TIMEOUT_MS ?? 10_000);
const VIRAL_TWEET_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_VIRAL_TWEET_LIMIT ?? 180);
const OPPORTUNITY_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_OPPORTUNITY_LIMIT ?? 120);
const DRAFT_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_DRAFT_LIMIT ?? 120);
const HOOKSMITH_SCRIPT_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_HOOKSMITH_LIMIT ?? 80);
const CONTENT_IDEA_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_CONTENT_IDEA_LIMIT ?? 100);
const INBOX_CAPTURE_INDEX_LIMIT = Number(process.env.SNIPRADAR_RESEARCH_INBOX_LIMIT ?? 120);
const EMBEDDING_BATCH_SIZE = 20;
const indexJobs = new Map<string, Promise<ResearchIndexStatus>>();

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function buildSnippet(text: string, maxLength = 220) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function hashDocument(parts: Array<string | null | undefined>) {
  return crypto.createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toSourceCountShape(sourceCounts: Partial<Record<ResearchSource, number>>) {
  const counts = {
    viralTweets: sourceCounts.viral_tweet ?? 0,
    opportunities: sourceCounts.opportunity ?? 0,
    drafts: sourceCounts.draft ?? 0,
    templates: sourceCounts.template ?? 0,
    hooksmithScripts: sourceCounts.hooksmith_script ?? 0,
    contentIdeas: sourceCounts.content_idea ?? 0,
    inboxCaptures: sourceCounts.inbox_capture ?? 0,
    total: 0,
  };
  counts.total =
    counts.viralTweets +
    counts.opportunities +
    counts.drafts +
    counts.templates +
    counts.hooksmithScripts +
    counts.contentIdeas +
    counts.inboxCaptures;
  return counts;
}

function jsonObject(value: Record<string, unknown>): Prisma.JsonObject {
  return value as Prisma.JsonObject;
}

function toNullableJsonInput(value: Prisma.JsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function parseEmbedding(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value
    .map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null))
    .filter((item): item is number => item !== null);
  return parsed.length > 0 ? parsed : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildTemplateRecordId(template: ReturnType<typeof getViralTemplates>[number]) {
  return `template:${hashDocument([template.category, template.template]).slice(0, 18)}`;
}

async function generateEmbeddings(inputs: string[]) {
  if (!HAS_OPENROUTER_KEY || !openRouterClient || inputs.length === 0) {
    return inputs.map(() => null);
  }

  try {
    const response = await Promise.race([
      openRouterClient.embeddings.create({
        model: RESEARCH_EMBEDDING_MODEL,
        input: inputs,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Research embeddings request exceeded deadline.")), RESEARCH_EMBEDDING_TIMEOUT_MS)
      ),
    ]);

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("[SnipRadar][Research] Failed to generate embeddings", error);
    return inputs.map(() => null);
  }
}

async function buildResearchDocumentsForUser(userId: string, selectedNiche?: string | null) {
  const [viralTweets, opportunities, drafts, projects, contentIdeas, inboxItems] = await Promise.all([
    prisma.viralTweet.findMany({
      where: { trackedAccount: { userId } },
      orderBy: [{ viralScore: "desc" }, { likes: "desc" }, { publishedAt: "desc" }],
      take: VIRAL_TWEET_INDEX_LIMIT,
    }),
    prisma.xEngagementOpportunity.findMany({
      where: { userId },
      orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
      take: OPPORTUNITY_INDEX_LIMIT,
    }),
    prisma.tweetDraft.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: DRAFT_INDEX_LIMIT,
    }),
    prisma.project.findMany({
      where: { userId },
      include: { script: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: HOOKSMITH_SCRIPT_INDEX_LIMIT,
    }),
    prisma.contentIdea.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: CONTENT_IDEA_INDEX_LIMIT,
    }),
    prisma.xResearchInboxItem.findMany({
      where: { userId, status: { not: "archived" } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: INBOX_CAPTURE_INDEX_LIMIT,
    }),
  ]);

  const templates = getViralTemplates();
  const normalizedSelectedNiche = normalizeText(selectedNiche ?? "");

  const viralTweetDocs: ResearchDocument[] = viralTweets.map((tweet) => {
    const tags = [
      tweet.authorUsername,
      tweet.hookType,
      tweet.format,
      tweet.emotionalTrigger,
      ...tweet.lessonsLearned.slice(0, 4),
    ].filter(Boolean) as string[];
    const metadata = jsonObject({
      authorUsername: tweet.authorUsername,
      authorDisplayName: tweet.authorDisplayName,
      hookType: tweet.hookType,
      format: tweet.format,
      emotionalTrigger: tweet.emotionalTrigger,
      viralScore: tweet.viralScore ?? 0,
      likes: tweet.likes,
      whyItWorked: tweet.whyItWorked ?? "",
      lessonsLearned: tweet.lessonsLearned,
      publishedAt: tweet.publishedAt.toISOString(),
    });
    const normalizedSource = normalizeText(
      [tweet.text, tweet.whyItWorked ?? "", tweet.lessonsLearned.join(" "), ...tags].join(" ")
    );

    return {
      source: "viral_tweet",
      sourceRecordId: tweet.id,
      title: `Viral tweet from @${tweet.authorUsername}`,
      body: tweet.text,
      snippet: buildSnippet(tweet.text),
      tags,
      metadata,
      normalizedText: normalizedSource,
      contentHash: hashDocument([
        "viral_tweet",
        tweet.id,
        tweet.text,
        tweet.whyItWorked,
        tweet.lessonsLearned.join("|"),
        tweet.hookType,
        tweet.format,
        tweet.emotionalTrigger,
        String(tweet.viralScore ?? 0),
        String(tweet.likes),
      ]),
      sourceUpdatedAt: tweet.analyzedAt ?? tweet.fetchedAt,
    };
  });

  const opportunityDocs: ResearchDocument[] = opportunities.map((opportunity) => {
    const tags = [
      opportunity.authorUsername,
      opportunity.authorName,
      opportunity.niche,
      opportunity.status,
      opportunity.score >= 80 ? "high_priority" : null,
    ].filter(Boolean) as string[];
    const metadata = jsonObject({
      authorUsername: opportunity.authorUsername,
      authorName: opportunity.authorName,
      niche: opportunity.niche,
      status: opportunity.status,
      score: opportunity.score,
      likes: opportunity.likes,
      replyCount: opportunity.replyCount,
      xCreatedAt: opportunity.xCreatedAt.toISOString(),
      lastSeenAt: opportunity.lastSeenAt.toISOString(),
    });
    const normalizedSource = normalizeText(
      [opportunity.text, opportunity.authorUsername, opportunity.authorName, opportunity.niche, ...tags].join(" ")
    );

    return {
      source: "opportunity",
      sourceRecordId: opportunity.id,
      title: `Engagement opportunity: @${opportunity.authorUsername}`,
      body: opportunity.text,
      snippet: buildSnippet(opportunity.text),
      tags,
      metadata,
      normalizedText: normalizedSource,
      contentHash: hashDocument([
        "opportunity",
        opportunity.id,
        opportunity.text,
        opportunity.authorUsername,
        opportunity.authorName,
        opportunity.niche,
        opportunity.status,
        String(opportunity.score),
        String(opportunity.likes),
      ]),
      sourceUpdatedAt: opportunity.updatedAt,
    };
  });

  const draftDocs: ResearchDocument[] = drafts.map((draft) => {
    const tags = [
      draft.status,
      draft.hookType,
      draft.format,
      draft.emotionalTrigger,
      draft.threadGroupId ? "thread" : "single",
    ].filter(Boolean) as string[];
    const metadata = jsonObject({
      status: draft.status,
      hookType: draft.hookType,
      format: draft.format,
      emotionalTrigger: draft.emotionalTrigger,
      viralPrediction: draft.viralPrediction ?? 0,
      aiReasoning: draft.aiReasoning ?? "",
      createdAt: draft.createdAt.toISOString(),
      postedAt: draft.postedAt?.toISOString() ?? null,
    });
    const normalizedSource = normalizeText(
      [draft.text, draft.aiReasoning ?? "", draft.hookType ?? "", draft.format ?? "", ...tags].join(" ")
    );

    return {
      source: "draft",
      sourceRecordId: draft.id,
      title: `Existing ${draft.status} draft`,
      body: draft.text,
      snippet: buildSnippet(draft.text),
      tags,
      metadata,
      normalizedText: normalizedSource,
      contentHash: hashDocument([
        "draft",
        draft.id,
        draft.text,
        draft.status,
        draft.hookType,
        draft.format,
        draft.emotionalTrigger,
        draft.aiReasoning,
        String(draft.viralPrediction ?? 0),
      ]),
      sourceUpdatedAt: draft.updatedAt,
    };
  });

  const hooksmithDocs: ResearchDocument[] = projects
    .filter((project) => Boolean(project.script?.body?.trim()))
    .map((project) => {
      const hooks = Array.isArray(project.script?.hooks)
        ? project.script?.hooks.filter((hook): hook is string => typeof hook === "string" && hook.trim().length > 0)
        : [];
      const scriptBody = project.script?.body ?? "";
      const tags = [
        project.topic,
        project.script?.tone,
        hooks[0],
        hooks[1],
        hooks.length > 0 ? `${hooks.length}_hooks` : null,
      ].filter(Boolean) as string[];
      const metadata = jsonObject({
        projectTitle: project.title,
        topic: project.topic,
        tone: project.script?.tone ?? null,
        hookCount: hooks.length,
        hooks: hooks.slice(0, 6),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      });
      const normalizedSource = normalizeText(
        [project.title, project.topic ?? "", scriptBody, hooks.join(" "), ...tags].join(" ")
      );

      return {
        source: "hooksmith_script" as const,
        sourceRecordId: project.id,
        title: `Hooksmith script: ${project.title}`,
        body: scriptBody,
        snippet: buildSnippet(scriptBody),
        tags,
        metadata,
        normalizedText: normalizedSource,
        contentHash: hashDocument([
          "hooksmith_script",
          project.id,
          project.title,
          project.topic,
          project.script?.tone,
          scriptBody,
          hooks.join("|"),
        ]),
        sourceUpdatedAt: project.updatedAt,
      };
    });

  const contentIdeaDocs: ResearchDocument[] = contentIdeas.map((idea) => {
    const hookSuggestions = Array.isArray(idea.hookSuggestions)
      ? idea.hookSuggestions.filter((hook): hook is string => typeof hook === "string" && hook.trim().length > 0)
      : [];
    const keywords = Array.isArray(idea.keywords)
      ? idea.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
      : [];
    const thumbnailIdeas = Array.isArray(idea.thumbnailIdeas)
      ? idea.thumbnailIdeas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const tags = [
      idea.niche,
      idea.videoType,
      idea.contentCategory,
      idea.status,
      ...keywords.slice(0, 3),
    ].filter(Boolean) as string[];
    const metadata = jsonObject({
      niche: idea.niche,
      videoType: idea.videoType,
      contentCategory: idea.contentCategory,
      status: idea.status,
      viralityScore: idea.viralityScore,
      estimatedViews: idea.estimatedViews,
      keywords,
      hookSuggestions: hookSuggestions.slice(0, 5),
      thumbnailIdeas: thumbnailIdeas.slice(0, 3),
      scheduledDate: idea.scheduledDate?.toISOString() ?? null,
    });
    const normalizedSource = normalizeText(
      [
        idea.title,
        idea.description ?? "",
        idea.aiReasoning ?? "",
        idea.niche ?? "",
        idea.videoType ?? "",
        idea.contentCategory ?? "",
        keywords.join(" "),
        hookSuggestions.join(" "),
        thumbnailIdeas.join(" "),
      ].join(" ")
    );

    return {
      source: "content_idea" as const,
      sourceRecordId: idea.id,
      title: `Content idea: ${idea.title}`,
      body: [idea.description ?? "", idea.aiReasoning ?? "", hookSuggestions[0] ?? ""]
        .filter(Boolean)
        .join("\n\n"),
      snippet: buildSnippet(
        [idea.description ?? "", idea.aiReasoning ?? "", hookSuggestions[0] ?? ""]
          .filter(Boolean)
          .join(" ")
      ),
      tags,
      metadata,
      normalizedText: normalizedSource,
      contentHash: hashDocument([
        "content_idea",
        idea.id,
        idea.title,
        idea.description,
        idea.aiReasoning,
        idea.niche,
        idea.videoType,
        idea.contentCategory,
        String(idea.viralityScore ?? 0),
        keywords.join("|"),
        hookSuggestions.join("|"),
      ]),
      sourceUpdatedAt: idea.updatedAt,
    };
  });

  const inboxDocs: ResearchDocument[] = inboxItems.map((item) => {
    const labels = Array.isArray(item.labels) ? item.labels : [];
    const tags = [
      item.itemType,
      item.authorUsername,
      item.status,
      ...labels.slice(0, 3),
      item.generatedReply ? "reply_assist" : null,
      item.generatedRemix ? "remix" : null,
    ].filter(Boolean) as string[];
    const body = [item.text ?? "", item.note ?? "", item.generatedReply ?? "", item.generatedRemix ?? ""]
      .filter(Boolean)
      .join("\n\n");
    const metadata = jsonObject({
      itemType: item.itemType,
      status: item.status,
      authorUsername: item.authorUsername,
      authorDisplayName: item.authorDisplayName,
      labels,
      note: item.note,
      hasGeneratedReply: Boolean(item.generatedReply),
      hasGeneratedRemix: Boolean(item.generatedRemix),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      sourceUrl: item.sourceUrl,
    });
    const normalizedSource = normalizeText(
      [
        item.title ?? "",
        item.text ?? "",
        item.note ?? "",
        item.authorUsername ?? "",
        item.authorDisplayName ?? "",
        labels.join(" "),
        item.generatedReply ?? "",
        item.generatedRemix ?? "",
      ].join(" ")
    );

    return {
      source: "inbox_capture" as const,
      sourceRecordId: item.id,
      title:
        item.title ??
        `Inbox ${item.itemType}${item.authorUsername ? ` from @${item.authorUsername}` : ""}`,
      body,
      snippet: buildSnippet(body || item.title || item.sourceUrl),
      tags,
      metadata,
      normalizedText: normalizedSource,
      contentHash: hashDocument([
        "inbox_capture",
        item.id,
        item.itemType,
        item.sourceUrl,
        item.title,
        item.text,
        item.note,
        item.status,
        labels.join("|"),
        item.generatedReply,
        item.generatedRemix,
      ]),
      sourceUpdatedAt: item.updatedAt,
    };
  });

  const templateDocs: ResearchDocument[] = templates
    .filter((template) => {
      if (!normalizedSelectedNiche) return true;
      return !template.niche || normalizeText(template.niche) === normalizedSelectedNiche;
    })
    .map((template) => {
      const tags = [
        template.category,
        template.niche,
        template.intent,
        template.hookType,
        template.format,
        template.emotionalTrigger,
        template.difficulty,
        template.curated ? "curated" : null,
      ].filter(Boolean) as string[];
      const metadata = jsonObject({
        category: template.category,
        niche: template.niche,
        intent: template.intent,
        qualityScore: template.qualityScore,
        difficulty: template.difficulty,
        curated: template.curated,
        hookType: template.hookType,
        format: template.format,
        emotionalTrigger: template.emotionalTrigger,
        template: template.template,
        exampleFilled: template.exampleFilled,
      });
      const normalizedSource = normalizeText(
        [
          template.template,
          template.exampleFilled,
          template.category,
          template.niche ?? "",
          template.intent,
          template.hookType,
          template.format,
          template.emotionalTrigger,
          template.difficulty,
        ].join(" ")
      );

      return {
        source: "template" as const,
        sourceRecordId: buildTemplateRecordId(template),
        title: `${template.category} template`,
        body: template.exampleFilled,
        snippet: buildSnippet(template.exampleFilled),
        tags,
        metadata,
        normalizedText: normalizedSource,
        contentHash: hashDocument([
          "template",
          template.category,
          template.template,
          template.exampleFilled,
          template.niche,
          template.intent,
          template.difficulty,
          String(template.qualityScore),
        ]),
        sourceUpdatedAt: null,
      };
    });

  return [
    ...viralTweetDocs,
    ...opportunityDocs,
    ...draftDocs,
    ...templateDocs,
    ...hooksmithDocs,
    ...contentIdeaDocs,
    ...inboxDocs,
  ];
}

export async function getResearchIndexStatus(userId: string): Promise<ResearchIndexStatus> {
  const [grouped, totalDocuments, embeddedDocuments, latestRun, latestDocument] = await Promise.all([
    prisma.xResearchDocument.groupBy({
      by: ["source"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.xResearchDocument.count({ where: { userId } }),
    prisma.xResearchDocument.count({ where: { userId, embeddedAt: { not: null } } }),
    prisma.xResearchIndexRun.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        status: true,
        errorSummary: true,
      },
    }),
    prisma.xResearchDocument.aggregate({
      where: { userId },
      _max: { updatedAt: true },
    }),
  ]);

  const countsBySource = toSourceCountShape(
    Object.fromEntries(grouped.map((item) => [item.source as ResearchSource, item._count._all]))
  );
  const lastIndexedAt = latestRun?.createdAt ?? latestDocument._max.updatedAt ?? null;
  const isStale = totalDocuments > 0 && lastIndexedAt
    ? Date.now() - lastIndexedAt.getTime() > RESEARCH_INDEX_STALE_MS
    : false;
  const latestRunStatus = (latestRun?.status as ResearchIndexStatus["lastRunStatus"]) ?? null;
  const state: ResearchIndexStatus["state"] =
    totalDocuments === 0
      ? "empty"
      : latestRunStatus === "failed"
        ? "error"
        : isStale
          ? "stale"
          : "ready";

  return {
    state,
    isStale,
    totalDocuments,
    counts: countsBySource,
    embeddedDocuments,
    usingEmbeddings: embeddedDocuments > 0,
    lastIndexedAt: lastIndexedAt?.toISOString() ?? null,
    lastRunStatus: latestRunStatus,
    lastErrorSummary: latestRun?.errorSummary ?? null,
    staleAfterMs: RESEARCH_INDEX_STALE_MS,
  };
}

async function runResearchIndexBuild({
  userId,
  selectedNiche,
}: Omit<EnsureResearchIndexParams, "force">): Promise<ResearchIndexStatus> {
  const startedAt = Date.now();
  const sourceDocuments = await buildResearchDocumentsForUser(userId, selectedNiche);
  const existingDocuments = await prisma.xResearchDocument.findMany({
    where: { userId },
    select: {
      id: true,
      source: true,
      sourceRecordId: true,
      contentHash: true,
      embedding: true,
    },
  });

  const existingByKey = new Map(
    existingDocuments.map((document) => [
      `${document.source}:${document.sourceRecordId}`,
      document,
    ])
  );
  const incomingKeys = new Set(sourceDocuments.map((document) => `${document.source}:${document.sourceRecordId}`));
  const documentsToDelete = existingDocuments
    .filter((document) => !incomingKeys.has(`${document.source}:${document.sourceRecordId}`))
    .map((document) => document.id);

  const documentsToWrite = sourceDocuments.filter((document) => {
    const existing = existingByKey.get(`${document.source}:${document.sourceRecordId}`);
    if (!existing) return true;
    if (existing.contentHash !== document.contentHash) return true;
    return !existing.embedding && Boolean(openRouterClient);
  });

  let documentsEmbedded = 0;
  let failedEmbeddings = 0;

  const embeddingLookup = new Map<string, number[] | null>();
  if (documentsToWrite.length > 0 && openRouterClient) {
    for (let index = 0; index < documentsToWrite.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = documentsToWrite.slice(index, index + EMBEDDING_BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch.map((document) => document.normalizedText.slice(0, 4_000)));
      batch.forEach((document, batchIndex) => {
        const embedding = embeddings[batchIndex];
        embeddingLookup.set(`${document.source}:${document.sourceRecordId}`, embedding);
        if (embedding) {
          documentsEmbedded += 1;
        } else {
          failedEmbeddings += 1;
        }
      });
    }
  }

  if (documentsToDelete.length > 0) {
    await prisma.xResearchDocument.deleteMany({
      where: { id: { in: documentsToDelete } },
    });
  }

  if (documentsToWrite.length > 0) {
    const operations = documentsToWrite.map((document) => {
      const key = `${document.source}:${document.sourceRecordId}`;
      const embedding = embeddingLookup.get(key);
      const existing = existingByKey.get(key);
      return prisma.xResearchDocument.upsert({
        where: {
          userId_source_sourceRecordId: {
            userId,
            source: document.source,
            sourceRecordId: document.sourceRecordId,
          },
        },
        create: {
          userId,
          source: document.source,
          sourceRecordId: document.sourceRecordId,
          title: document.title,
          body: document.body,
          snippet: document.snippet,
          tags: document.tags,
          metadata: document.metadata,
          normalizedText: document.normalizedText,
          contentHash: document.contentHash,
          embedding: toNullableJsonInput((embedding as Prisma.JsonValue | null) ?? existing?.embedding ?? null),
          embeddingModel: embedding ? RESEARCH_EMBEDDING_MODEL : existing?.embedding ? RESEARCH_EMBEDDING_MODEL : null,
          embeddedAt: embedding ? new Date() : existing?.embedding ? new Date() : null,
          sourceUpdatedAt: document.sourceUpdatedAt,
        },
        update: {
          title: document.title,
          body: document.body,
          snippet: document.snippet,
          tags: document.tags,
          metadata: document.metadata,
          normalizedText: document.normalizedText,
          contentHash: document.contentHash,
          embedding: toNullableJsonInput((embedding as Prisma.JsonValue | null) ?? existing?.embedding ?? null),
          embeddingModel: embedding ? RESEARCH_EMBEDDING_MODEL : existing?.embedding ? RESEARCH_EMBEDDING_MODEL : null,
          embeddedAt: embedding ? new Date() : existing?.embedding ? new Date() : null,
          sourceUpdatedAt: document.sourceUpdatedAt,
        },
      });
    });

    for (let index = 0; index < operations.length; index += 25) {
      await prisma.$transaction(operations.slice(index, index + 25));
    }
  }

  const runStatus =
    failedEmbeddings > 0 && documentsEmbedded === 0 && openRouterClient
      ? "partial"
      : failedEmbeddings > 0
        ? "partial"
        : "success";

  await prisma.xResearchIndexRun.create({
    data: {
      userId,
      status: runStatus,
      documentsScanned: sourceDocuments.length,
      documentsUpserted: documentsToWrite.length,
      documentsDeleted: documentsToDelete.length,
      documentsEmbedded,
      failedEmbeddings,
      durationMs: Date.now() - startedAt,
      errorSummary:
        failedEmbeddings > 0
          ? "Some document embeddings failed. Lexical search remains available."
          : null,
    },
  });

  return getResearchIndexStatus(userId);
}

export async function ensureResearchIndex({
  userId,
  selectedNiche,
  force = false,
}: EnsureResearchIndexParams) {
  if (!force) {
    const currentStatus = await getResearchIndexStatus(userId);
    if (currentStatus.totalDocuments > 0 && !currentStatus.isStale) {
      return currentStatus;
    }
  }

  const jobKey = `${userId}:${force ? "force" : "normal"}`;
  const existingJob = indexJobs.get(jobKey);
  if (existingJob) {
    return existingJob;
  }

  const job = runResearchIndexBuild({ userId, selectedNiche })
    .catch(async (error) => {
      console.error("[SnipRadar][Research] Index build failed", error);
      await prisma.xResearchIndexRun.create({
        data: {
          userId,
          status: "failed",
          errorSummary:
            error instanceof Error ? error.message.slice(0, 400) : "Unknown research indexing error",
          durationMs: 0,
        },
      });
      throw error;
    })
    .finally(() => {
      indexJobs.delete(jobKey);
    });

  indexJobs.set(jobKey, job);
  return job;
}

function buildResultMeta(
  source: ResearchSource,
  metadata: Record<string, unknown>,
  tags: string[],
) {
  if (source === "viral_tweet") {
    return [
      typeof metadata.hookType === "string" ? metadata.hookType : null,
      typeof metadata.format === "string" ? metadata.format : null,
      typeof metadata.likes === "number" ? `${metadata.likes.toLocaleString()} likes` : null,
    ].filter(Boolean) as string[];
  }

  if (source === "opportunity") {
    return [
      typeof metadata.niche === "string" ? metadata.niche : null,
      typeof metadata.score === "number" ? `${metadata.score}/100 opportunity` : null,
      typeof metadata.status === "string" ? metadata.status : null,
    ].filter(Boolean) as string[];
  }

  if (source === "draft") {
    return [
      typeof metadata.status === "string" ? metadata.status : null,
      typeof metadata.hookType === "string" ? metadata.hookType : null,
      typeof metadata.viralPrediction === "number"
        ? `${metadata.viralPrediction}/100 predicted`
        : null,
    ].filter(Boolean) as string[];
  }

  if (source === "hooksmith_script") {
    return [
      typeof metadata.topic === "string" ? metadata.topic : null,
      typeof metadata.tone === "string" ? metadata.tone : null,
      typeof metadata.hookCount === "number" ? `${metadata.hookCount} hooks` : null,
    ].filter(Boolean) as string[];
  }

  if (source === "content_idea") {
    return [
      typeof metadata.niche === "string" ? metadata.niche : null,
      typeof metadata.videoType === "string" ? metadata.videoType : null,
      typeof metadata.viralityScore === "number" ? `${metadata.viralityScore}/100 virality` : null,
    ].filter(Boolean) as string[];
  }

  if (source === "inbox_capture") {
    return [
      typeof metadata.itemType === "string" ? metadata.itemType : null,
      typeof metadata.authorUsername === "string" ? `@${metadata.authorUsername}` : null,
      typeof metadata.status === "string" ? metadata.status : null,
    ].filter(Boolean) as string[];
  }

  return [
    typeof metadata.intent === "string" ? metadata.intent : null,
    typeof metadata.difficulty === "string" ? metadata.difficulty : null,
    typeof metadata.qualityScore === "number" ? `Q${metadata.qualityScore}` : null,
    tags.includes("curated") ? "curated" : null,
  ].filter(Boolean) as string[];
}

function buildDraftSeed(source: ResearchSource, title: string, body: string, metadata: Record<string, unknown>) {
  if (source === "viral_tweet") {
    return `Write an original X post inspired by this viral pattern.\n\nReference: ${title}\n\nTweet:\n${body}\n\nWhy it worked:\n${typeof metadata.whyItWorked === "string" && metadata.whyItWorked ? metadata.whyItWorked : "Strong engagement with a proven structure."}\n\nDo not copy. Reframe it for my audience with a sharper angle and CTA.`;
  }

  if (source === "opportunity") {
    return `Create an original X post from this live conversation opportunity.\n\nConversation:\n${body}\n\nAuthor: @${typeof metadata.authorUsername === "string" ? metadata.authorUsername : "creator"}\n\nGoal: make it relevant to my audience, not as a reply, but as a standalone post or micro-thread.`;
  }

  if (source === "draft") {
    return body;
  }

  if (source === "hooksmith_script") {
    return `Turn this Hooksmith script angle into one sharp X post.\n\nScript: ${title}\n\nTalking points:\n${body}\n\nGoal: distill it into a concise, original post with one insight, one proof point, and one CTA.`;
  }

  if (source === "content_idea") {
    return `Create an X launch post from this content idea.\n\nIdea: ${title}\n\nContext:\n${body}\n\nKeep it original, specific, and tuned for discovery on X.`;
  }

  if (source === "inbox_capture") {
    return buildResearchInboxDraftSeed({
      title,
      text: body,
      authorUsername: typeof metadata.authorUsername === "string" ? metadata.authorUsername : null,
      note: typeof metadata.note === "string" ? metadata.note : null,
      itemType: typeof metadata.itemType === "string" ? metadata.itemType : "tweet",
    });
  }

  return `Use this template as a starting point and customize it for my offer and audience.\n\nTemplate:\n${typeof metadata.template === "string" ? metadata.template : body}\n\nExample:\n${typeof metadata.exampleFilled === "string" ? metadata.exampleFilled : body}\n\nKeep the structure, but make the final post original and specific.`;
}

function buildMatchReasons(
  source: ResearchSource,
  normalizedQuery: string,
  tokens: string[],
  document: {
    title: string;
    normalizedText: string;
    tags: string[];
    metadata: Record<string, unknown>;
  },
  semanticScore: number,
) {
  const reasons: string[] = [];

  if (document.title.toLowerCase().includes(normalizedQuery)) {
    reasons.push("Direct title match");
  } else if (document.normalizedText.includes(normalizedQuery)) {
    reasons.push("Direct phrase match");
  }

  const matchingTags = document.tags.filter((tag) => {
    const normalizedTag = normalizeText(tag);
    if (!normalizedTag) return false;
    if (normalizedQuery && normalizedTag.includes(normalizedQuery)) return true;
    return tokens.some((token) => normalizedTag.includes(token));
  });
  if (matchingTags.length > 0) {
    reasons.push(`Matched tags: ${matchingTags.slice(0, 2).join(", ")}`);
  }

  if (
    source === "viral_tweet" &&
    typeof document.metadata.viralScore === "number" &&
    document.metadata.viralScore >= 75
  ) {
    reasons.push(`High-performing precedent (${document.metadata.viralScore}/100 viral score)`);
  }

  if (
    source === "opportunity" &&
    typeof document.metadata.score === "number" &&
    document.metadata.score >= 75
  ) {
    reasons.push(`High-priority conversation (${document.metadata.score}/100)`);
  }

  if (
    source === "draft" &&
    typeof document.metadata.viralPrediction === "number" &&
    document.metadata.viralPrediction >= 70
  ) {
    reasons.push(`Strong existing draft (${document.metadata.viralPrediction}/100 predicted)`);
  }

  if (
    source === "template" &&
    typeof document.metadata.qualityScore === "number" &&
    document.metadata.qualityScore >= 80
  ) {
    reasons.push(`Curated high-quality template (Q${document.metadata.qualityScore})`);
  }

  if (
    source === "hooksmith_script" &&
    typeof document.metadata.hookCount === "number" &&
    document.metadata.hookCount >= 3
  ) {
    reasons.push(`Hook-rich script (${document.metadata.hookCount} hooks)`);
  }

  if (
    source === "content_idea" &&
    typeof document.metadata.viralityScore === "number" &&
    document.metadata.viralityScore >= 70
  ) {
    reasons.push(`High-upside content idea (${document.metadata.viralityScore}/100 virality)`);
  }

  if (
    source === "inbox_capture" &&
    typeof document.metadata.authorUsername === "string" &&
    document.metadata.authorUsername.trim()
  ) {
    reasons.push(`Captured from live browsing via @${document.metadata.authorUsername}`);
  }

  if (semanticScore >= 18) {
    reasons.push("Strong semantic match");
  }

  if (tokens.length >= 2) {
    const overlappingTokens = tokens.filter((token) => document.normalizedText.includes(token));
    if (overlappingTokens.length >= 2) {
      reasons.push(`Matched ${Math.min(overlappingTokens.length, 4)} query terms`);
    }
  }

  return reasons.slice(0, 3);
}

function lexicalScore(normalizedTextValue: string, title: string, tags: string[], normalizedQuery: string, tokens: string[]) {
  let score = 0;
  const normalizedTitle = normalizeText(title);
  const normalizedTags = tags.map((tag) => normalizeText(tag));

  if (normalizedTextValue.includes(normalizedQuery)) score += 26;
  if (normalizedTitle.includes(normalizedQuery)) score += 18;

  for (const token of tokens) {
    if (normalizedTitle.includes(token)) score += 7;
    if (normalizedTextValue.includes(token)) score += 5;
    if (normalizedTags.some((tag) => tag === token)) score += 8;
    else if (normalizedTags.some((tag) => tag.includes(token))) score += 4;
  }

  return score;
}

function qualityBoost(source: ResearchSource, metadata: Record<string, unknown>) {
  if (source === "viral_tweet") {
    return clamp(
      (typeof metadata.viralScore === "number" ? metadata.viralScore / 9 : 0) +
        Math.log10((typeof metadata.likes === "number" ? metadata.likes : 0) + 10),
      0,
      14
    );
  }

  if (source === "opportunity") {
    return clamp(
      (typeof metadata.score === "number" ? metadata.score / 10 : 0) +
        Math.log10((typeof metadata.likes === "number" ? metadata.likes : 0) + 10),
      0,
      12
    );
  }

  if (source === "draft") {
    return clamp(typeof metadata.viralPrediction === "number" ? metadata.viralPrediction / 11 : 0, 0, 10);
  }

  if (source === "hooksmith_script") {
    return clamp(
      (typeof metadata.hookCount === "number" ? metadata.hookCount * 1.5 : 0) +
        (typeof metadata.tone === "string" && metadata.tone.trim() ? 2 : 0),
      0,
      10
    );
  }

  if (source === "content_idea") {
    return clamp(
      (typeof metadata.viralityScore === "number" ? metadata.viralityScore / 11 : 0) +
        Math.log10((typeof metadata.estimatedViews === "number" ? metadata.estimatedViews : 0) + 10),
      0,
      12
    );
  }

  if (source === "inbox_capture") {
    return clamp(
      (typeof metadata.hasGeneratedReply === "boolean" && metadata.hasGeneratedReply ? 2 : 0) +
        (typeof metadata.hasGeneratedRemix === "boolean" && metadata.hasGeneratedRemix ? 2 : 0) +
        (typeof metadata.status === "string" && metadata.status === "tracked" ? 3 : 0),
      0,
      8
    );
  }

  return clamp(typeof metadata.qualityScore === "number" ? metadata.qualityScore / 10 : 0, 0, 10);
}

function sourceFreshnessBoost(sourceUpdatedAt: Date | null) {
  if (!sourceUpdatedAt) return 0;
  const ageDays = (Date.now() - sourceUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 3) return 4;
  if (ageDays <= 14) return 2;
  if (ageDays <= 45) return 1;
  return 0;
}

export function rankResearchDocuments(
  documents: Array<{
    id: string;
    source: ResearchSource;
    sourceRecordId: string;
    title: string;
    snippet: string;
    tags: string[];
    metadata: Prisma.JsonValue | null;
    normalizedText: string;
    sourceUpdatedAt: Date | null;
    embedding: Prisma.JsonValue | null;
  }>,
  query: string,
  queryEmbedding: number[] | null,
) {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenizeQuery(query);

  return documents
    .map((document) => {
      const metadata = (document.metadata ?? {}) as Record<string, unknown>;
      const lexical = lexicalScore(
        document.normalizedText,
        document.title,
        document.tags,
        normalizedQuery,
        tokens
      );
      const documentEmbedding = parseEmbedding(document.embedding);
      const semantic =
        queryEmbedding && documentEmbedding
          ? clamp(Math.round(Math.max(0, cosineSimilarity(queryEmbedding, documentEmbedding)) * 42), 0, 42)
          : 0;
      const totalScore =
        lexical + semantic + qualityBoost(document.source, metadata) + sourceFreshnessBoost(document.sourceUpdatedAt);
      const matchReasons = buildMatchReasons(document.source, normalizedQuery, tokens, {
        title: document.title,
        normalizedText: document.normalizedText,
        tags: document.tags,
        metadata,
      }, semantic);

      return {
        id: document.id,
        source: document.source,
        sourceRecordId: document.sourceRecordId,
        title: document.title,
        snippet: document.snippet,
        tags: document.tags,
        metadata: document.metadata,
        sourceUpdatedAt: document.sourceUpdatedAt,
        totalScore,
        matchReasons,
      } satisfies RankedResearchDocument;
    })
    .filter((document) => document.totalScore >= 12 || document.matchReasons.length > 0)
    .sort((left, right) => right.totalScore - left.totalScore || left.title.localeCompare(right.title));
}

function buildResearchSummary(
  query: string,
  resultCounts: ResearchQueryResponse["resultCounts"],
  usedEmbeddings: boolean,
) {
  if (resultCounts.total === 0) {
    return `No strong matches for "${query}" yet. Try a niche phrase, hook type, audience pain point, or refresh the corpus.`;
  }

  const sourceSummary = [
    resultCounts.viralTweets ? `${resultCounts.viralTweets} viral patterns` : null,
    resultCounts.opportunities ? `${resultCounts.opportunities} opportunities` : null,
    resultCounts.drafts ? `${resultCounts.drafts} saved drafts` : null,
    resultCounts.templates ? `${resultCounts.templates} templates` : null,
    resultCounts.hooksmithScripts ? `${resultCounts.hooksmithScripts} scripts` : null,
    resultCounts.contentIdeas ? `${resultCounts.contentIdeas} content ideas` : null,
    resultCounts.inboxCaptures ? `${resultCounts.inboxCaptures} inbox captures` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `Found ${resultCounts.total} strong matches for "${query}" across ${sourceSummary}.${usedEmbeddings ? " Hybrid retrieval is active." : " Lexical retrieval is active."}`;
}

export async function searchResearchIndex({
  userId,
  query,
  limitPerSource = 6,
  selectedNiche,
}: SearchResearchParams): Promise<ResearchQueryResponse> {
  const documents = await prisma.xResearchDocument.findMany({
    where: { userId },
    select: {
      id: true,
      source: true,
      sourceRecordId: true,
      title: true,
      snippet: true,
      tags: true,
      metadata: true,
      normalizedText: true,
      sourceUpdatedAt: true,
      embedding: true,
    },
    orderBy: [{ sourceUpdatedAt: "desc" }, { updatedAt: "desc" }],
  });

  const indexStatus = await getResearchIndexStatus(userId);
  if (documents.length === 0) {
    return {
      query,
      summary:
        "Build your research corpus to search across viral patterns, opportunities, drafts, templates, scripts, and content ideas.",
      synthesis: null,
      resultCounts: {
        viralTweets: 0,
        opportunities: 0,
        drafts: 0,
        templates: 0,
        hooksmithScripts: 0,
        contentIdeas: 0,
        inboxCaptures: 0,
        total: 0,
      },
      indexStatus,
      groups: {
        viralTweets: [],
        opportunities: [],
        drafts: [],
        templates: [],
        hooksmithScripts: [],
        contentIdeas: [],
        inboxCaptures: [],
      },
    };
  }

  let queryEmbedding: number[] | null = null;
  const canUseEmbeddings = documents.some((document) => Boolean(document.embedding)) && Boolean(openRouterClient);
  if (canUseEmbeddings) {
    [queryEmbedding] = await generateEmbeddings([normalizeText(query)]);
  }

  const rankedDocuments = rankResearchDocuments(
    documents.map((document) => ({
      ...document,
      source: document.source as ResearchSource,
    })),
    query,
    queryEmbedding
  );
  const grouped = {
    viralTweets: [] as ResearchResult[],
    opportunities: [] as ResearchResult[],
    drafts: [] as ResearchResult[],
    templates: [] as ResearchResult[],
    hooksmithScripts: [] as ResearchResult[],
    contentIdeas: [] as ResearchResult[],
    inboxCaptures: [] as ResearchResult[],
  };

  for (const document of rankedDocuments) {
    const metadata = (document.metadata ?? {}) as Record<string, unknown>;
    const item: ResearchResult = {
      id: document.id,
      source: document.source,
      title: document.title,
      body: document.snippet,
      meta: buildResultMeta(document.source, metadata, document.tags),
      score: Math.round(document.totalScore),
      matchReasons: document.matchReasons,
      draftSeed: buildDraftSeed(
        document.source,
        document.title,
        document.snippet,
        metadata
      ),
      sourceUpdatedAt: document.sourceUpdatedAt?.toISOString() ?? null,
    };

    if (document.source === "viral_tweet" && grouped.viralTweets.length < limitPerSource) {
      grouped.viralTweets.push(item);
    }
    if (document.source === "opportunity" && grouped.opportunities.length < limitPerSource) {
      grouped.opportunities.push(item);
    }
    if (document.source === "draft" && grouped.drafts.length < limitPerSource) {
      grouped.drafts.push(item);
    }
    if (document.source === "template" && grouped.templates.length < limitPerSource) {
      grouped.templates.push(item);
    }
    if (document.source === "hooksmith_script" && grouped.hooksmithScripts.length < limitPerSource) {
      grouped.hooksmithScripts.push(item);
    }
    if (document.source === "content_idea" && grouped.contentIdeas.length < limitPerSource) {
      grouped.contentIdeas.push(item);
    }
    if (document.source === "inbox_capture" && grouped.inboxCaptures.length < limitPerSource) {
      grouped.inboxCaptures.push(item);
    }
  }

  const resultCounts = {
    viralTweets: grouped.viralTweets.length,
    opportunities: grouped.opportunities.length,
    drafts: grouped.drafts.length,
    templates: grouped.templates.length,
    hooksmithScripts: grouped.hooksmithScripts.length,
    contentIdeas: grouped.contentIdeas.length,
    inboxCaptures: grouped.inboxCaptures.length,
    total:
      grouped.viralTweets.length +
      grouped.opportunities.length +
      grouped.drafts.length +
      grouped.templates.length +
      grouped.hooksmithScripts.length +
      grouped.contentIdeas.length +
      grouped.inboxCaptures.length,
  };

  const synthesisInput = [
    ...grouped.viralTweets,
    ...grouped.opportunities,
    ...grouped.drafts,
    ...grouped.templates,
    ...grouped.hooksmithScripts,
    ...grouped.contentIdeas,
    ...grouped.inboxCaptures,
  ]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 8);

  let synthesis: ResearchSynthesis | null = null;
  if (synthesisInput.length > 0) {
    try {
      synthesis = await generateResearchSynthesis({
        query,
        results: synthesisInput,
        selectedNiche,
      });
    } catch (error) {
      console.warn("[SnipRadar][Research] Falling back to search results without AI synthesis", error);
      synthesis = null;
    }
  }

  return {
    query,
    summary: buildResearchSummary(query, resultCounts, Boolean(queryEmbedding)),
    synthesis,
    resultCounts,
    indexStatus,
    groups: grouped,
  };
}
