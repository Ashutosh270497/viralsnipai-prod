"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkflow } from "@/components/providers/workflow-provider";
import { toast } from "sonner";

interface ContentData {
  id?: string;
  title?: string;
  niche?: string;
  description?: string;
  keywords?: string[];
  projectId?: string;
}

/**
 * Hook for synchronizing content data across workflow steps
 */
export function useContentSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentContentId, markPhaseComplete } = useWorkflow();

  // Navigate to next step with content data
  const navigateToScript = useCallback(
    (contentData: ContentData) => {
      const params = new URLSearchParams();
      if (contentData.id) params.set("ideaId", contentData.id);
      if (contentData.title) params.set("title", contentData.title);
      if (contentData.niche) params.set("niche", contentData.niche);
      if (contentData.description) params.set("description", contentData.description);

      setCurrentContentId(contentData.id);
      markPhaseComplete("content-calendar");

      router.push(`/dashboard/script-generator?${params.toString()}`);
      toast.success("Ready to generate script!", {
        description: "Content data has been pre-filled for you.",
      });
    },
    [router, setCurrentContentId, markPhaseComplete]
  );

  const navigateToTitle = useCallback(
    (contentData: ContentData) => {
      const params = new URLSearchParams();
      if (contentData.id) params.set("contentIdeaId", contentData.id);
      if (contentData.title) params.set("topic", contentData.title);
      if (contentData.niche) params.set("targetAudience", contentData.niche);

      setCurrentContentId(contentData.id);
      markPhaseComplete("content-calendar");

      router.push(`/dashboard/title-generator?${params.toString()}`);
      toast.success("Ready to generate titles!", {
        description: "Content data has been pre-filled for you.",
      });
    },
    [router, setCurrentContentId, markPhaseComplete]
  );

  const navigateToThumbnail = useCallback(
    (contentData: ContentData) => {
      const params = new URLSearchParams();
      if (contentData.id) params.set("ideaId", contentData.id);
      if (contentData.title) params.set("title", contentData.title);
      if (contentData.niche) params.set("niche", contentData.niche);

      setCurrentContentId(contentData.id);
      markPhaseComplete("content-calendar");

      router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
      toast.success("Ready to design thumbnails!", {
        description: "Content data has been pre-filled for you.",
      });
    },
    [router, setCurrentContentId, markPhaseComplete]
  );

  const navigateToContentCalendar = useCallback(() => {
    router.push("/dashboard/content-calendar");
    toast.info("Create a content idea first", {
      description: "Start by brainstorming your next video idea.",
    });
  }, [router]);

  const navigateToRepurpose = useCallback(
    (contentData: ContentData) => {
      const params = new URLSearchParams();
      if (contentData.projectId) params.set("projectId", contentData.projectId);
      if (contentData.id) params.set("ideaId", contentData.id);
      if (contentData.title) params.set("ideaTitle", contentData.title);
      if (contentData.niche) params.set("ideaNiche", contentData.niche);
      if (contentData.description) params.set("ideaDescription", contentData.description);
      if (contentData.keywords?.length) params.set("ideaKeywords", contentData.keywords.join(", "));
      params.set("source", "content-calendar");

      setCurrentContentId(contentData.id);
      markPhaseComplete("content-calendar");

      router.push(`/repurpose?${params.toString()}`);
      toast.success("Ready for RepurposeOS!", {
        description: "Your content idea has been turned into a repurpose-ready project.",
      });
    },
    [markPhaseComplete, router, setCurrentContentId]
  );

  // Get pre-filled data from URL params
  const getPrefilledData = useCallback((): ContentData | null => {
    const ideaId = searchParams?.get("ideaId") || searchParams?.get("contentIdeaId");
    const title = searchParams?.get("title") || searchParams?.get("topic") || searchParams?.get("videoTitle");
    const niche = searchParams?.get("niche") || searchParams?.get("targetAudience");
    const description = searchParams?.get("description") || searchParams?.get("videoDescription");

    if (!ideaId && !title && !niche) {
      return null;
    }

    return {
      id: ideaId || undefined,
      title: title || undefined,
      niche: niche || undefined,
      description: description || undefined,
    };
  }, [searchParams]);

  // Check if current page has pre-filled data
  const hasPrefilledData = useCallback(() => {
    return getPrefilledData() !== null;
  }, [getPrefilledData]);

  return {
    navigateToScript,
    navigateToTitle,
    navigateToThumbnail,
    navigateToRepurpose,
    navigateToContentCalendar,
    getPrefilledData,
    hasPrefilledData,
  };
}
