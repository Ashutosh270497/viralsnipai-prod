import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/components/ui/use-toast";
import { trackEvent } from "@/lib/analytics";

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type GeneratedVideo = {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl: string;
};

type FormState = {
  prompt: string;
  negativePrompt: string;
  stylePreset: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
};

const DEFAULT_FORM: FormState = {
  prompt: "",
  negativePrompt: "",
  stylePreset: "",
  aspectRatio: "16:9",
  durationSeconds: 12
};

export function useVeoGenerator() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(() => form.prompt.trim().length >= 5, [form.prompt]);

  const updateForm = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
    setError(null);
    setProgress(0);
  }, []);

  const appendVideo = useCallback((video: GeneratedVideo) => {
    setVideos((current) => [video, ...current].slice(0, 6));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isGenerating || !canGenerate) {
        if (!canGenerate) {
          toast({
            variant: "destructive",
            title: "Add a prompt",
            description: "Describe the story or motion you want Veo to render."
          });
        }
        return;
      }

      setIsGenerating(true);
      setProgress(10);
      setError(null);

      try {
        const response = await fetch("/api/veo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: form.prompt.trim(),
            aspectRatio: form.aspectRatio,
            durationSeconds: form.durationSeconds,
            stylePreset: form.stylePreset.trim() || undefined,
            negativePrompt: form.negativePrompt.trim() || undefined
          }),
          cache: "no-store"
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof payload?.error === "string"
              ? payload.error
              : typeof payload?.error?.message === "string"
                ? payload.error.message
                : undefined;
          throw new Error(detail ?? "Video generation failed");
        }

        const video = payload.video as GeneratedVideo | undefined;
        if (!video) {
          throw new Error("No video returned");
        }

        appendVideo(video);
        toast({ title: "Video queued", description: "Preview or download your new Veo render." });
        trackEvent({
          name: "veo_generate",
          payload: {
            aspectRatio: form.aspectRatio,
            durationSeconds: form.durationSeconds,
            hasNegative: Boolean(form.negativePrompt),
            stylePreset: form.stylePreset || undefined
          }
        });
        setProgress(100);
        setTimeout(() => setProgress(0), 900);
      } catch (err) {
        console.error("Veo generation failed", err);
        const message = err instanceof Error ? err.message : "Could not generate video";
        setError(message);
        toast({
          variant: "destructive",
          title: "Video generation failed",
          description: message
        });
        setProgress(0);
      } finally {
        setIsGenerating(false);
      }
    },
    [appendVideo, canGenerate, form, isGenerating, toast]
  );

  return {
    form,
    videos,
    isGenerating,
    progress,
    error,
    canGenerate,
    updateForm,
    resetForm,
    handleSubmit
  };
}
