"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useProject } from "@/lib/hooks/queries/useProjects";

import type { ProjectDetail, ProjectSummary } from "./types";

interface RepurposeContextValue {
  projects: ProjectSummary[];
  projectId: string;
  setProjectId: (id: string) => void;
  project: ProjectDetail | null;
  primaryAsset: ProjectDetail["assets"][number] | null;
  isProjectSelected: boolean;
  isLoading: boolean;
  invalidate: () => Promise<void>;
  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;
}

const RepurposeContext = createContext<RepurposeContextValue | undefined>(undefined);

export function RepurposeProvider({
  projects,
  children,
}: {
  projects: ProjectSummary[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlProjectId = searchParams.get("projectId") ?? "";
  const [projectId, setProjectIdState] = useState(urlProjectId);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);

  const { data: projectData, refetch, isLoading } = useProject(projectId || null);
  const project = (projectData?.project as ProjectDetail | undefined) ?? null;
  const primaryAsset = project?.assets?.[0] ?? null;

  // Refetch project data when navigating between sub-pages (Ingest → Editor → Export)
  // to ensure clips/exports created on one page are visible on another.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname && projectId) {
      prevPathRef.current = pathname;
      refetch();
    }
  }, [pathname, projectId, refetch]);

  const syncProjectIdToUrl = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("projectId", id);
      } else {
        params.delete("projectId");
      }
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (urlProjectId === projectId) {
      return;
    }
    if (!urlProjectId) {
      setProjectIdState("");
      setSelectedClipIds([]);
      return;
    }
    if (projects.some((proj) => proj.id === urlProjectId)) {
      setProjectIdState(urlProjectId);
      setSelectedClipIds([]);
      return;
    }
    // URL has invalid projectId; clear stale selection and clean query param.
    setProjectIdState("");
    setSelectedClipIds([]);
    syncProjectIdToUrl("");
  }, [projectId, projects, syncProjectIdToUrl, urlProjectId]);

  useEffect(() => {
    if (!projectId || isLoading || project) {
      return;
    }

    // Selected project no longer resolves (deleted or inaccessible).
    // Clear stale state so pages can recover gracefully.
    setProjectIdState("");
    setSelectedClipIds([]);
    syncProjectIdToUrl("");
  }, [isLoading, project, projectId, syncProjectIdToUrl]);

  useEffect(() => {
    if (!project) {
      if (selectedClipIds.length > 0) {
        setSelectedClipIds([]);
      }
      return;
    }
    const validClipIds = new Set(project.clips.map((clip) => clip.id));
    const pruned = selectedClipIds.filter((clipId) => validClipIds.has(clipId));
    if (pruned.length !== selectedClipIds.length) {
      setSelectedClipIds(pruned);
    }
  }, [project, selectedClipIds]);

  const setProjectId = useCallback(
    (id: string) => {
      setProjectIdState(id);
      setSelectedClipIds([]);
      syncProjectIdToUrl(id);
    },
    [syncProjectIdToUrl]
  );

  const value = useMemo<RepurposeContextValue>(
    () => ({
      projects,
      projectId,
      setProjectId,
      project,
      primaryAsset,
      isProjectSelected: Boolean(projectId && (isLoading || project)),
      isLoading,
      invalidate: async () => {
        await refetch();
      },
      selectedClipIds,
      setSelectedClipIds,
    }),
    [
      isLoading,
      primaryAsset,
      project,
      projectId,
      projects,
      refetch,
      selectedClipIds,
      setProjectId,
    ]
  );

  return <RepurposeContext.Provider value={value}>{children}</RepurposeContext.Provider>;
}

export function useRepurpose() {
  const ctx = useContext(RepurposeContext);
  if (!ctx) {
    throw new Error("useRepurpose must be used within RepurposeProvider");
  }
  return ctx;
}
