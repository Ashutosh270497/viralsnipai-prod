"use client";

import { Mic, Loader2, Download, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetVoiceTranslations, type VoiceTranslation } from "@/hooks/use-voice-translation";
import { useLanguages } from "@/hooks/use-translation";
import { formatDistanceToNow } from "date-fns";

interface VoiceTranslationsListProps {
  assetId: string | null;
}

function getStatusIcon(status: VoiceTranslation['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    case 'queued':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
  }
}

function getStatusBadgeVariant(status: VoiceTranslation['status']): "default" | "secondary" | "destructive" {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
    case 'queued':
      return 'secondary';
    case 'failed':
      return 'destructive';
  }
}

export function VoiceTranslationsList({ assetId }: VoiceTranslationsListProps) {
  const { translations, isLoading } = useAssetVoiceTranslations(assetId);
  const { languages, getLanguageByCode } = useLanguages();

  if (!assetId) {
    return null;
  }

  if (isLoading && translations.length === 0) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
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
            <Mic className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="tracking-tight">Voice Translations</CardTitle>
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

          return (
            <div
              key={translation.id}
              className="rounded-xl border border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
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
                        Created {formatDistanceToNow(new Date(translation.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <Badge variant={getStatusBadgeVariant(translation.status)} className="gap-1">
                    {getStatusIcon(translation.status)}
                    {translation.status.charAt(0).toUpperCase() + translation.status.slice(1)}
                  </Badge>
                </div>

                {translation.status === 'completed' && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="gap-2"
                    >
                      <a href={translation.audioUrl} download>
                        <Download className="h-4 w-4" />
                        Download Video
                      </a>
                    </Button>
                    {translation.processingTime && (
                      <span className="text-xs text-muted-foreground">
                        Processed in {Math.round(translation.processingTime / 1000)}s
                      </span>
                    )}
                  </div>
                )}

                {translation.status === 'processing' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing voice translation... This may take 2-5 minutes
                  </div>
                )}

                {translation.status === 'queued' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Waiting in queue... Processing will start shortly
                  </div>
                )}

                {translation.status === 'failed' && translation.error && (
                  <div className="rounded-lg border border-red-200/40 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-red-900 dark:text-red-100">
                          Translation failed
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {translation.error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
