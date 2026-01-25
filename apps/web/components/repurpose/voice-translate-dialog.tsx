"use client";

import { useState } from "react";
import { Languages, Loader2, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TranslationLanguageSelector } from "./translation-language-selector";
import { useTranslateVideoVoice } from "@/hooks/use-voice-translation";

interface VoiceTranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  sourceLanguage?: string;
  onSuccess?: () => void;
}

export function VoiceTranslateDialog({
  open,
  onOpenChange,
  assetId,
  sourceLanguage = 'en',
  onSuccess,
}: VoiceTranslateDialogProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const { translateVideo, isLoading } = useTranslateVideoVoice();

  const handleLanguageToggle = (languageCode: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(languageCode)
        ? prev.filter((code) => code !== languageCode)
        : prev.length < 3
        ? [...prev, languageCode]
        : prev
    );
  };

  const handleTranslate = async () => {
    try {
      await translateVideo({
        assetId,
        targetLanguages: selectedLanguages,
      });
      onSuccess?.();
      handleClose();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedLanguages([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-3">
              <Mic className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Translate Video Voice</DialogTitle>
              <DialogDescription>
                Replace the video's audio with AI-generated voice in your selected languages
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isLoading && (
            <Alert className="border-violet-200/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:to-purple-950/20">
              <AlertDescription className="text-sm">
                <strong>How it works:</strong> We'll translate the transcript text, generate AI voice audio,
                and create a new video with the translated voice. Processing takes 2-5 minutes per language.
                You can select up to <strong>3 languages</strong> at once.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-medium text-foreground">
                  Queueing voice translation jobs...
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Processing {selectedLanguages.length} language{selectedLanguages.length !== 1 ? 's' : ''}.
                You'll be notified when complete.
              </p>
            </div>
          )}

          {!isLoading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Select languages ({selectedLanguages.length} / 3 selected)
                </p>
              </div>

              <TranslationLanguageSelector
                selectedLanguages={selectedLanguages}
                onLanguageToggle={handleLanguageToggle}
                sourceLanguage={sourceLanguage}
                maxSelections={3}
              />
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={selectedLanguages.length === 0 || isLoading}
            className="gap-2 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Translate Voice ({selectedLanguages.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
