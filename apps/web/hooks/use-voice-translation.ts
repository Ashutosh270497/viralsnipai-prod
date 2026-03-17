/**
 * Voice Translation Hooks
 *
 * Provides API integration for video voice translation features.
 * Handles voice translation requests and fetching voice translations.
 *
 * @module use-voice-translation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface VoiceTranslation {
  id: string;
  language: string;
  audioUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  voiceId?: string;
  translatedFrom: string;
  processingTime?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslateVideoVoiceParams {
  assetId: string;
  targetLanguages: string[];
  voiceId?: string;
}

export interface TranslateVideoVoiceResponse {
  assetId: string;
  translations: Array<{
    language: string;
    translationId: string;
    status: 'created' | 'existing' | 'queued';
  }>;
  summary: {
    requested: number;
    created: number;
    existing: number;
    queued: number;
  };
}

/**
 * Hook for translating video voice
 */
export function useTranslateVideoVoice() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const translateVideo = useCallback(
    async (params: TranslateVideoVoiceParams): Promise<TranslateVideoVoiceResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/voice-translations/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Voice translation failed');
        }

        const data = await response.json();

        toast({
          title: 'Voice translation started',
          description: `Processing ${params.targetLanguages.length} language(s). Check back in a few minutes.`,
        });

        return data.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        toast({
          title: 'Voice translation failed',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  return {
    translateVideo,
    isLoading,
    error,
  };
}

/**
 * Hook for fetching asset voice translations
 */
export function useAssetVoiceTranslations(assetId: string | null) {
  const [translations, setTranslations] = useState<VoiceTranslation[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTranslations = useCallback(async () => {
    if (!assetId) {
      setTranslations([]);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assets/${assetId}/voice-translations`, {
        cache: 'no-store',
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voice translations');
      }

      const data = await response.json();

      if (isMountedRef.current) {
        const nextTranslations = Array.isArray(data?.data?.translations)
          ? (data.data.translations as VoiceTranslation[])
          : [];
        setTranslations((prev) =>
          areTranslationsEqual(prev, nextTranslations) ? prev : nextTranslations
        );
        if (typeof data?.data?.sourceLanguage === 'string' && data.data.sourceLanguage.length > 0) {
          setSourceLanguage(data.data.sourceLanguage);
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [assetId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTranslations();

    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTranslations]);

  const hasActiveTranslations = translations.some(
    (translation) => translation.status === 'queued' || translation.status === 'processing'
  );

  useEffect(() => {
    if (!hasActiveTranslations) {
      return;
    }

    const pollInterval = setInterval(() => {
      fetchTranslations();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchTranslations, hasActiveTranslations]);

  return {
    translations,
    sourceLanguage,
    isLoading,
    error,
    refetch: fetchTranslations,
  };
}

function areTranslationsEqual(current: VoiceTranslation[], next: VoiceTranslation[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    const a = current[index];
    const b = next[index];

    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.updatedAt !== b.updatedAt ||
      a.error !== b.error ||
      a.audioUrl !== b.audioUrl
    ) {
      return false;
    }
  }

  return true;
}
