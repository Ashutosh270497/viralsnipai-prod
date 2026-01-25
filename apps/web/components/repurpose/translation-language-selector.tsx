"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLanguages, type Language } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";

interface TranslationLanguageSelectorProps {
  selectedLanguages: string[];
  onLanguageToggle: (languageCode: string) => void;
  sourceLanguage?: string;
  maxSelections?: number;
}

export function TranslationLanguageSelector({
  selectedLanguages,
  onLanguageToggle,
  sourceLanguage = 'en',
  maxSelections = 6
}: TranslationLanguageSelectorProps) {
  const { languages, isLoading } = useLanguages();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label>Select target languages</Label>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Filter out source language (but always keep English as an option)
  const availableLanguages = languages.filter((lang) => {
    // Always show English as a translation option
    if (lang.code === 'en') return true;
    // Filter out source language for other languages
    return lang.code !== sourceLanguage;
  });

  const canSelectMore = selectedLanguages.length < maxSelections;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Select target languages</Label>
        <span className="text-xs text-muted-foreground">
          {selectedLanguages.length} / {maxSelections} selected
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {availableLanguages.map((language) => {
          const isSelected = selectedLanguages.includes(language.code);
          const canToggle = isSelected || canSelectMore;

          return (
            <button
              key={language.code}
              type="button"
              onClick={() => canToggle && onLanguageToggle(language.code)}
              disabled={!canToggle}
              className={`
                relative flex items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-all
                ${
                  isSelected
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                    : 'border-border/40 bg-background/50 hover:border-border hover:bg-muted/50'
                }
                ${!canToggle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{language.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {language.nativeName}
                </div>
              </div>
              {isSelected && (
                <div className="flex-shrink-0">
                  <div className="rounded-full bg-violet-500 p-1">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {availableLanguages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No languages available for translation
        </p>
      )}
    </div>
  );
}
