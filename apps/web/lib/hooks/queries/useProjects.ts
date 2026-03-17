/**
 * Project React Query Hooks
 *
 * Provides hooks for fetching and mutating project data with automatic caching.
 *
 * @module useProjects
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import type { Project, ProjectSummary } from '@/lib/types';
import type {
  CreateProjectData,
  UpdateProjectData,
} from '@/lib/domain/repositories/IProjectRepository';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (userId: string) => [...projectKeys.lists(), userId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Fetch a single project by ID
 */
export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 10 * 1000, // 10s — keep fresh for repurpose flow where data changes between steps
  });
}

/**
 * Fetch all projects for the current user
 */
export function useProjects(userId: string | null) {
  return useQuery({
    queryKey: projectKeys.list(userId!),
    queryFn: () => projectsApi.getProjects(userId!),
    enabled: !!userId,
  });
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectData) => projectsApi.createProject({
      ...data,
      topic: data.topic ?? undefined
    }),
    onSuccess: (data) => {
      // Invalidate project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Set the new project in cache
      queryClient.setQueryData(projectKeys.detail(data.project.id), data);
    },
  });
}

/**
 * Update an existing project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectData }) =>
      projectsApi.updateProject(id, {
        ...data,
        topic: data.topic ?? undefined
      }),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      // Snapshot previous value
      const previousProject = queryClient.getQueryData<Project>(projectKeys.detail(id));

      // Optimistically update
      if (previousProject) {
        const optimisticPatch: Partial<Project> = {
          ...data,
          updatedAt:
            data.updatedAt instanceof Date
              ? data.updatedAt.toISOString()
              : data.updatedAt,
        };

        queryClient.setQueryData<Project>(projectKeys.detail(id), {
          ...previousProject,
          ...optimisticPatch,
        });
      }

      return { previousProject };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousProject);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(projectKeys.detail(data.project.id), data);
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
