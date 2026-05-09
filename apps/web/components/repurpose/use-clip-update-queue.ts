"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ProjectClip } from "@/components/repurpose/types";

export type ClipUpdatePayload = {
  startMs?: number;
  endMs?: number;
  title?: string | null;
  summary?: string | null;
  callToAction?: string | null;
  captionSrt?: string | null;
  captionStyle?: unknown;
  previewPath?: string | null;
  thumbnail?: string | null;
  layoutPreset?: string | null;
  aspectRatio?: string | null;
  layoutConfig?: unknown;
  transcriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
};

type UpdateOptions = {
  refresh?: boolean;
  retryOnConflict?: boolean;
  forcePreviewInvalidation?: boolean;
};

type UseClipUpdateQueueOptions = {
  projectId?: string | null;
  clips: ProjectClip[];
  onProjectRefreshed?: () => Promise<void> | void;
  onConflictResolved?: () => void;
};

function isEqualField(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function sanitizeUpdates(
  current: ProjectClip | undefined,
  updates: ClipUpdatePayload,
  options: Pick<UpdateOptions, "forcePreviewInvalidation">,
) {
  const payload: ClipUpdatePayload = {};

  for (const [key, value] of Object.entries(updates) as Array<[keyof ClipUpdatePayload, unknown]>) {
    if (value === undefined) continue;
    if (key === ("expectedVersion" as keyof ClipUpdatePayload)) continue;
    if (key === "previewPath" && value === null && !options.forcePreviewInvalidation) {
      continue;
    }
    if (current && key in current && isEqualField((current as unknown as Record<string, unknown>)[key], value)) {
      continue;
    }
    (payload as Record<string, unknown>)[key] = value;
  }

  return payload;
}

function isConflictResponse(status: number, body: unknown) {
  if (status === 409) return true;
  const maybeError = body as { error?: { code?: string; message?: string }; message?: string } | null;
  return (
    maybeError?.error?.code === "CONFLICT" ||
    maybeError?.error?.message?.toLowerCase().includes("updated elsewhere") ||
    maybeError?.message?.toLowerCase().includes("updated elsewhere")
  );
}

export function useClipUpdateQueue({
  projectId,
  clips,
  onProjectRefreshed,
  onConflictResolved,
}: UseClipUpdateQueueOptions) {
  const latestClipsRef = useRef<ProjectClip[]>(clips);
  const queuesRef = useRef<Map<string, Promise<unknown>>>(new Map());

  useEffect(() => {
    latestClipsRef.current = clips;
  }, [clips]);

  const findLatestClip = useCallback((clipId: string) => {
    return latestClipsRef.current.find((clip) => clip.id === clipId);
  }, []);

  const refetchLatestClip = useCallback(
    async (clipId: string) => {
      if (!projectId) return findLatestClip(clipId);

      const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (!response.ok) return findLatestClip(clipId);

      const body = (await response.json().catch(() => null)) as
        | { project?: { clips?: ProjectClip[] }; data?: { project?: { clips?: ProjectClip[] } } }
        | null;
      const refreshedClips = body?.project?.clips ?? body?.data?.project?.clips;
      if (Array.isArray(refreshedClips)) {
        latestClipsRef.current = refreshedClips;
      }
      return findLatestClip(clipId);
    },
    [findLatestClip, projectId],
  );

  const patchClipOnce = useCallback(
    async (clipId: string, updates: ClipUpdatePayload, options: UpdateOptions) => {
      const current = findLatestClip(clipId);
      const payload = sanitizeUpdates(current, updates, options);
      if (Object.keys(payload).length === 0) {
        return current;
      }

      const expectedVersion = current?.version;
      if (!expectedVersion) {
        throw new Error("Clip version is unavailable. Refresh and try again.");
      }

      const response = await fetch(`/api/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, expectedVersion }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: { clip?: ProjectClip }; error?: { message?: string } }
        | null;

      if (!response.ok) {
        const conflict = isConflictResponse(response.status, body);
        const message = conflict
          ? "This clip was updated in the background. We refreshed it - please try again."
          : body?.error?.message ?? "Clip update failed";
        const error = new Error(message) as Error & { conflict?: boolean };
        error.conflict = conflict;
        throw error;
      }

      const updatedClip = body?.data?.clip;
      if (updatedClip) {
        latestClipsRef.current = latestClipsRef.current.map((clip) =>
          clip.id === clipId ? { ...clip, ...updatedClip } : clip,
        );
      }
      return updatedClip ?? current;
    },
    [findLatestClip],
  );

  const updateClip = useCallback(
    async (clipId: string, updates: ClipUpdatePayload, options: UpdateOptions = {}) => {
      const previous = queuesRef.current.get(clipId) ?? Promise.resolve();
      const task = previous
        .catch(() => undefined)
        .then(async () => {
          try {
            const updated = await patchClipOnce(clipId, updates, options);
            if (options.refresh !== false) {
              await onProjectRefreshed?.();
            }
            return updated;
          } catch (error) {
            const conflict = Boolean((error as Error & { conflict?: boolean }).conflict);
            if (!conflict || options.retryOnConflict === false) {
              throw error;
            }

            await refetchLatestClip(clipId);
            const retried = await patchClipOnce(clipId, updates, options);
            onConflictResolved?.();
            if (options.refresh !== false) {
              await onProjectRefreshed?.();
            }
            return retried;
          }
        })
        .finally(() => {
          if (queuesRef.current.get(clipId) === task) {
            queuesRef.current.delete(clipId);
          }
        });

      queuesRef.current.set(clipId, task);
      return task as Promise<ProjectClip | undefined>;
    },
    [onConflictResolved, onProjectRefreshed, patchClipOnce, refetchLatestClip],
  );

  return { updateClip };
}
