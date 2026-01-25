import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/use-toast";

export type VoiceRenderSummary = {
  id: string;
  text: string;
  audioUrl: string;
  createdAt: string;
  durationSec?: number | null;
};

export type VoiceProfileSummary = {
  id: string;
  name: string;
  description?: string | null;
  providerVoiceId: string;
  sampleUrl?: string | null;
  createdAt: string;
  renders: VoiceRenderSummary[];
};

type CreateVoiceInput = {
  name: string;
  description?: string;
  file: File;
};

type GenerateSpeechInput = {
  voiceId: string;
  text: string;
};

export function useVoicer() {
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceProfileSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [generatingVoiceId, setGeneratingVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/voicer/voices", {
        method: "GET",
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
        throw new Error(detail ?? "Unable to load voices");
      }
      const list = (payload.voices ?? []) as VoiceProfileSummary[];
      setVoices(list);
    } catch (err) {
      console.error("[Voicer] Failed to fetch voices", err);
      const message = err instanceof Error ? err.message : "Unable to load voices";
      setError(message);
      toast({
        variant: "destructive",
        title: "Could not load voices",
        description: message
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  const createVoice = useCallback(
    async (input: CreateVoiceInput) => {
      if (isCreating) {
        return;
      }
      setIsCreating(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("name", input.name.trim());
        if (input.description) {
          formData.append("description", input.description.trim());
        }
        formData.append("sample", input.file);

        const response = await fetch("/api/voicer/voices", {
          method: "POST",
          body: formData
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof payload?.error === "string"
              ? payload.error
              : typeof payload?.error?.message === "string"
                ? payload.error.message
                : undefined;
          throw new Error(detail ?? "Voice cloning failed");
        }
        const voice = payload.voice as VoiceProfileSummary | undefined;
        if (voice) {
          setVoices((current) => [voice, ...current]);
          toast({ title: "Voice cloned", description: `${voice.name} is ready to speak.` });
        } else {
          await fetchVoices();
        }
      } catch (err) {
        console.error("[Voicer] Voice cloning failed", err);
        const message = err instanceof Error ? err.message : "Unable to clone voice";
        setError(message);
        toast({
          variant: "destructive",
          title: "Voice cloning failed",
          description: message
        });
      } finally {
        setIsCreating(false);
      }
    },
    [fetchVoices, isCreating, toast]
  );

  const generateSpeech = useCallback(
    async (input: GenerateSpeechInput) => {
      if (generatingVoiceId) {
        return;
      }
      if (input.text.trim().length < 3) {
        toast({
          variant: "destructive",
          title: "Add a script",
          description: "Enter at least a few words for the model to narrate."
        });
        return;
      }
      setGeneratingVoiceId(input.voiceId);
      try {
        const response = await fetch("/api/voicer/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId: input.voiceId, text: input.text.trim() })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof payload?.error === "string"
              ? payload.error
              : typeof payload?.error?.message === "string"
                ? payload.error.message
                : undefined;
          throw new Error(detail ?? "Speech synthesis failed");
        }
        const render = payload.render as VoiceRenderSummary | undefined;
        if (render) {
          setVoices((current) =>
            current.map((voice) =>
              voice.id === input.voiceId
                ? { ...voice, renders: [render, ...voice.renders].slice(0, 5) }
                : voice
            )
          );
          setDrafts((current) => ({ ...current, [input.voiceId]: "" }));
          toast({ title: "Speech ready", description: "Listen to the generated clip below." });
        } else {
          await fetchVoices();
        }
      } catch (err) {
        console.error("[Voicer] Speech synthesis failed", err);
        const message = err instanceof Error ? err.message : "Unable to synthesize speech";
        toast({
          variant: "destructive",
          title: "Speech synthesis failed",
          description: message
        });
      } finally {
        setGeneratingVoiceId(null);
      }
    },
    [fetchVoices, generatingVoiceId, toast]
  );

  const updateDraft = useCallback((voiceId: string, text: string) => {
    setDrafts((current) => ({ ...current, [voiceId]: text }));
  }, []);

  const draftValues = useMemo(() => drafts, [drafts]);

  return {
    voices,
    isLoading,
    isCreating,
    generatingVoiceId,
    error,
    drafts: draftValues,
    fetchVoices,
    createVoice,
    generateSpeech,
    updateDraft
  };
}
