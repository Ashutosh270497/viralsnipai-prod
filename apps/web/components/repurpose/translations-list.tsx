"use client";

import { useState, memo } from "react";
import { Languages, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetTranslations, useLanguages, type Translation } from "@/hooks/use-translation";
import { formatDistanceToNow } from "date-fns";

interface TranslationsListProps {
  assetId: string | null;
}

interface TranslationItemProps {
  translation: Translation;
  isExpanded: boolean;
  onToggle: () => void;
  languageName: string;
}

// Memoized translation item to prevent unnecessary re-renders
const TranslationItem = memo(({ translation, isExpanded, onToggle, languageName }: TranslationItemProps) => {
  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20"
          >
            {translation.language.toUpperCase()}
          </Badge>
          <div>
            <div className="font-medium text-sm">{languageName}</div>
            <div className="text-xs text-muted-foreground">
              Translated {formatDistanceToNow(new Date(translation.translatedAt), { addSuffix: true })}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-border/40 p-4 bg-background/50">
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/40 bg-background p-3 text-sm leading-relaxed">
            {translation.transcript}
          </div>
        </div>
      )}
    </div>
  );
});

TranslationItem.displayName = 'TranslationItem';

export function TranslationsList({ assetId }: TranslationsListProps) {
  const { translations, sourceLanguage, isLoading } = useAssetTranslations(assetId);
  const { languages, getLanguageByCode } = useLanguages();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!assetId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-2">
              <Languages className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="tracking-tight">Translations</CardTitle>
              <CardDescription className="text-muted-foreground/80">
                Loading translations...
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (translations.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-2">
            <Languages className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="tracking-tight">Translations</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              {translations.length} language{translations.length !== 1 ? 's' : ''} available
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {translations.map((translation) => {
          const language = getLanguageByCode(translation.language);
          const languageName = language?.name || translation.language.toUpperCase();
          const isExpanded = expandedId === translation.id;

          return (
            <TranslationItem
              key={translation.id}
              translation={translation}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId(isExpanded ? null : translation.id)}
              languageName={languageName}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
