/**
 * Clip React Query Hooks
 *
 * Provides hooks for fetching and mutating clip data with automatic caching.
 *
 * @module useClips
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import type { Clip, CreateClipData, UpdateClipData } from '@/lib/api/projects';

export const clipKeys = {
  all: ['clips'] as const,
  lists: () => [...clipKeys.all, 'list'] as const,
  list: (projectId: string) => [...clipKeys.lists(), projectId] as const,
  details: () => [...clipKeys.all, 'detail'] as const,
  detail: (id: string) => [...clipKeys.details(), id] as const,
};

/**
 * Fetch all clips for a project
 */
export function useClips(projectId: string | null) {
  return useQuery({
    queryKey: clipKeys.list(projectId!),
    queryFn: async () => {
      const response = await projectsApi.getClips(projectId!);
      return response.clips;
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new clip
 */
export function useCreateClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateClipData }) =>
      projectsApi.createClip(projectId, data),
    onMutate: async ({ projectId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: clipKeys.list(projectId) });

      // Snapshot previous value
      const previousClips = queryClient.getQueryData<Clip[]>(clipKeys.list(projectId));

      // Optimistically update
      if (previousClips) {
        queryClient.setQueryData<Clip[]>(clipKeys.list(projectId), [
          ...previousClips,
          { id: 'temp-' + Date.now(), ...data } as Clip,
        ]);
      }

      return { previousClips };
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.previousClips) {
        queryClient.setQueryData(clipKeys.list(projectId), context.previousClips);
      }
    },
    onSuccess: (response, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: clipKeys.list(projectId) });
    },
  });
}

/**
 * Update an existing clip
 */
export function useUpdateClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      clipId,
      data,
    }: {
      projectId: string;
      clipId: string;
      data: UpdateClipData;
    }) => projectsApi.updateClip(projectId, clipId, data),
    onMutate: async ({ projectId, clipId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: clipKeys.list(projectId) });

      // Snapshot previous value
      const previousClips = queryClient.getQueryData<Clip[]>(clipKeys.list(projectId));

      // Optimistically update
      if (previousClips) {
        queryClient.setQueryData<Clip[]>(
          clipKeys.list(projectId),
          previousClips.map((clip) =>
            clip.id === clipId ? { ...clip, ...data } : clip
          )
        );
      }

      return { previousClips };
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.previousClips) {
        queryClient.setQueryData(clipKeys.list(projectId), context.previousClips);
      }
    },
    onSuccess: (response, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: clipKeys.list(projectId) });
    },
  });
}

/**
 * Delete a clip
 */
export function useDeleteClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, clipId }: { projectId: string; clipId: string }) =>
      projectsApi.deleteClip(projectId, clipId),
    onMutate: async ({ projectId, clipId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: clipKeys.list(projectId) });

      // Snapshot previous value
      const previousClips = queryClient.getQueryData<Clip[]>(clipKeys.list(projectId));

      // Optimistically update
      if (previousClips) {
        queryClient.setQueryData<Clip[]>(
          clipKeys.list(projectId),
          previousClips.filter((clip) => clip.id !== clipId)
        );
      }

      return { previousClips };
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.previousClips) {
        queryClient.setQueryData(clipKeys.list(projectId), context.previousClips);
      }
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: clipKeys.list(projectId) });
    },
  });
}
