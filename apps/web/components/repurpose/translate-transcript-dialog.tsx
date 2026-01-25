"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TranslationLanguageSelector } from "./translation-language-selector";
import { useTranslateTranscript } from "@/hooks/use-translation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface TranslateTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  sourceLanguage?: string;
  onSuccess?: () => void;
}

export function TranslateTranscriptDialog({
  open,
  onOpenChange,
  assetId,
  sourceLanguage = 'en',
  onSuccess
}: TranslateTranscriptDialogProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const { translateTranscript, isLoading, progress, currentLanguage } = useTranslateTranscript();

  const handleLanguageToggle = (languageCode: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(languageCode)
        ? prev.filter((code) => code !== languageCode)
        : [...prev, languageCode]
    );
  };

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) return;

    const result = await translateTranscript({
      assetId,
      targetLanguages: selectedLanguages,
    });

    if (result) {
      // Reset and close
      setSelectedLanguages([]);
      onOpenChange(false);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-2">
              <Languages className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <DialogTitle>Translate Transcript</DialogTitle>
              <DialogDescription>
                Choose languages to translate the transcript into
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isLoading && (
            <Alert>
              <AlertDescription className="text-sm">
                Translation uses AI to convert the transcript into your selected languages
                while preserving meaning and context. Existing translations will be reused.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                  <span className="text-sm font-medium text-foreground">
                    Translating transcript...
                  </span>
                </div>
                <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                  {progress}%
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2 bg-violet-100 dark:bg-violet-950/40"
              />
              <p className="text-xs text-muted-foreground">
                Processing {selectedLanguages.length} language{selectedLanguages.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {!isLoading && (
            <TranslationLanguageSelector
              selectedLanguages={selectedLanguages}
              onLanguageToggle={handleLanguageToggle}
              sourceLanguage={sourceLanguage}
              maxSelections={6}
            />
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
            className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 hover:from-violet-600 hover:via-purple-600 hover:to-fuchsia-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="mr-2 h-4 w-4" />
                Translate ({selectedLanguages.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
