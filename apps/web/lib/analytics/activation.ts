import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type ActivationEcosystem = "creator" | "snipradar";

export type ActivationCheckpointId =
  | "creator_onboarding_started"
  | "creator_onboarding_completed"
  | "creator_first_content_idea_created"
  | "creator_first_script_generated"
  | "creator_first_title_generated"
  | "creator_first_thumbnail_generated"
  | "snipradar_x_account_connected"
  | "snipradar_first_tracked_account_added"
  | "snipradar_first_reply_assist_used"
  | "snipradar_first_scheduled_post";

export type ActivationCheckpointKind = "milestone" | "aha" | "activation";
export type ActivationCheckpointSource = "usage_log" | "derived";

export interface ActivationCheckpointDefinition {
  id: ActivationCheckpointId;
  ecosystem: ActivationEcosystem;
  label: string;
  description: string;
  kind: ActivationCheckpointKind;
  url?: string;
}

export interface ActivationCheckpointState extends ActivationCheckpointDefinition {
  completed: boolean;
  completedAt: string | null;
  source: ActivationCheckpointSource | null;
}

export interface ActivationSummary {
  ecosystem: ActivationEcosystem;
  ecosystemLabel: string;
  activated: boolean;
  activationEventId: ActivationCheckpointId;
  activationEventLabel: string;
  activationCompletedAt: string | null;
  ahaMoment: string;
  successThreshold: string;
  progressPct: number;
  nextStep: {
    id: ActivationCheckpointId;
    label: string;
    url?: string;
  } | null;
  steps: ActivationCheckpointState[];
}

export interface RecordActivationCheckpointInput {
  userId: string;
  checkpoint: ActivationCheckpointId;
  metadata?: Record<string, unknown>;
}

export const ACTIVATION_CHECKPOINT_DEFINITIONS: readonly ActivationCheckpointDefinition[] = [
  {
    id: "creator_onboarding_started",
    ecosystem: "creator",
    label: "Onboarding started",
    description: "The user has entered the creator onboarding flow.",
    kind: "milestone",
    url: "/onboarding",
  },
  {
    id: "creator_onboarding_completed",
    ecosystem: "creator",
    label: "Onboarding completed",
    description: "Core profile and niche setup are complete.",
    kind: "milestone",
    url: "/dashboard",
  },
  {
    id: "creator_first_content_idea_created",
    ecosystem: "creator",
    label: "First content idea created",
    description: "The user generated the first usable content idea set.",
    kind: "aha",
    url: "/dashboard/content-calendar",
  },
  {
    id: "creator_first_script_generated",
    ecosystem: "creator",
    label: "First script generated",
    description: "The user produced the first production-ready script.",
    kind: "activation",
    url: "/dashboard/script-generator",
  },
  {
    id: "creator_first_title_generated",
    ecosystem: "creator",
    label: "First title batch generated",
    description: "The user created the first optimized title set.",
    kind: "milestone",
    url: "/dashboard/title-generator",
  },
  {
    id: "creator_first_thumbnail_generated",
    ecosystem: "creator",
    label: "First thumbnail generated",
    description: "The user created the first thumbnail batch.",
    kind: "milestone",
    url: "/dashboard/thumbnail-generator",
  },
  {
    id: "snipradar_x_account_connected",
    ecosystem: "snipradar",
    label: "X account connected",
    description: "The user connected an X account to unlock live workflows.",
    kind: "milestone",
    url: "/snipradar/overview",
  },
  {
    id: "snipradar_first_tracked_account_added",
    ecosystem: "snipradar",
    label: "First tracked account added",
    description: "The user added the first account to Discover and research flows.",
    kind: "aha",
    url: "/snipradar/discover",
  },
  {
    id: "snipradar_first_reply_assist_used",
    ecosystem: "snipradar",
    label: "First reply assist used",
    description: "The user generated the first in-context assisted reply.",
    kind: "milestone",
    url: "/snipradar/inbox",
  },
  {
    id: "snipradar_first_scheduled_post",
    ecosystem: "snipradar",
    label: "First scheduled post",
    description: "The user scheduled the first post through SnipRadar.",
    kind: "activation",
    url: "/snipradar/publish/scheduler",
  },
] as const;

const ACTIVATION_ECOSYSTEMS = {
  creator: {
    label: "Creator Studio",
    activationEventId: "creator_first_script_generated" as const,
    ahaMoment:
      "The first real value moment is turning an idea into a usable script, not just finishing setup.",
    successThreshold:
      "Activation requires onboarding completion, a first idea, and a first generated script.",
  },
  snipradar: {
    label: "SnipRadar",
    activationEventId: "snipradar_first_scheduled_post" as const,
    ahaMoment:
      "The first real value moment is moving from connected data to a scheduled post in the X workflow.",
    successThreshold:
      "Activation requires an X connection, a tracked account, and a first scheduled post.",
  },
} as const;

const CHECKPOINT_FEATURE_PREFIX = "activation";

type ActivationStatusInput = Partial<
  Record<
    ActivationCheckpointId,
    {
      completed: boolean;
      completedAt?: string | Date | null;
      source?: ActivationCheckpointSource | null;
    }
  >
>;

function checkpointFeature(checkpoint: ActivationCheckpointId): string {
  return `${CHECKPOINT_FEATURE_PREFIX}:${checkpoint}`;
}

function normalizeCompletedAt(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getDefinitionsForEcosystem(ecosystem: ActivationEcosystem) {
  return ACTIVATION_CHECKPOINT_DEFINITIONS.filter((definition) => definition.ecosystem === ecosystem);
}

export async function recordActivationCheckpoint({
  userId,
  checkpoint,
  metadata,
}: RecordActivationCheckpointInput): Promise<boolean> {
  const feature = checkpointFeature(checkpoint);
  const definition = ACTIVATION_CHECKPOINT_DEFINITIONS.find((item) => item.id === checkpoint);

  if (!definition) {
    throw new Error(`Unknown activation checkpoint: ${checkpoint}`);
  }

  const existing = await prisma.usageLog.findFirst({
    where: {
      userId,
      feature,
    },
    select: { id: true },
  });

  if (existing) {
    return false;
  }

  await prisma.usageLog.create({
    data: {
      userId,
      feature,
      creditsUsed: 0,
      metadata: {
        checkpoint,
        ecosystem: definition.ecosystem,
        ...metadata,
      },
    },
  });

  return true;
}

export async function recordActivationCheckpointSafe(
  input: RecordActivationCheckpointInput
): Promise<boolean> {
  try {
    return await recordActivationCheckpoint(input);
  } catch (error) {
    logger.warn("[Activation] failed to record checkpoint", {
      checkpoint: input.checkpoint,
      userId: input.userId,
      error,
    });
    return false;
  }
}

export async function getActivationCheckpointStatuses(
  userId: string
): Promise<ActivationStatusInput> {
  const rows = await prisma.usageLog.findMany({
    where: {
      userId,
      feature: {
        in: ACTIVATION_CHECKPOINT_DEFINITIONS.map((definition) =>
          checkpointFeature(definition.id)
        ),
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      feature: true,
      createdAt: true,
    },
  });

  const statuses: ActivationStatusInput = {};

  for (const row of rows) {
    const checkpoint = row.feature.replace(
      `${CHECKPOINT_FEATURE_PREFIX}:`,
      ""
    ) as ActivationCheckpointId;
    if (statuses[checkpoint]?.completed) continue;
    statuses[checkpoint] = {
      completed: true,
      completedAt: row.createdAt,
      source: "usage_log",
    };
  }

  return statuses;
}

export function buildActivationSummary(
  ecosystem: ActivationEcosystem,
  statuses: ActivationStatusInput = {}
): ActivationSummary {
  const config = ACTIVATION_ECOSYSTEMS[ecosystem];
  const steps = getDefinitionsForEcosystem(ecosystem).map<ActivationCheckpointState>((definition) => {
    const status = statuses[definition.id];
    return {
      ...definition,
      completed: status?.completed ?? false,
      completedAt: normalizeCompletedAt(status?.completedAt),
      source: status?.completed ? status?.source ?? "derived" : null,
    };
  });

  const completedCount = steps.filter((step) => step.completed).length;
  const activationStep = steps.find((step) => step.id === config.activationEventId) ?? steps[steps.length - 1];
  const nextStep = steps.find((step) => !step.completed) ?? null;

  return {
    ecosystem,
    ecosystemLabel: config.label,
    activated: activationStep?.completed ?? false,
    activationEventId: config.activationEventId,
    activationEventLabel: activationStep?.label ?? config.activationEventId,
    activationCompletedAt: activationStep?.completedAt ?? null,
    ahaMoment: config.ahaMoment,
    successThreshold: config.successThreshold,
    progressPct: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    nextStep: nextStep
      ? {
          id: nextStep.id,
          label: nextStep.label,
          url: nextStep.url,
        }
      : null,
    steps,
  };
}
