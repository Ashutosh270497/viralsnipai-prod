"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { useProgress } from "@/hooks/use-progress";
import { cn } from "@/lib/utils";
import { EXPORT_PRESETS } from "@clippers/types";

interface ExportPanelProps {
  projectId: string;
  selectedClipIds: string[];
  exports: Array<{
    id: string;
    preset: string;
    status: string;
    outputPath?: string;
  }>;
  onQueued?: () => Promise<void> | void;
}

export function ExportPanel({ projectId, selectedClipIds, exports, onQueued }: ExportPanelProps) {
  const { toast } = useToast();
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);

  const verticalProgress = useProgress(220);
  const squareProgress = useProgress(220);
  const landscapeProgress = useProgress(220);

  const progressControllers = useMemo(
    () => ({
      shorts_9x16_1080: verticalProgress,
      square_1x1_1080: squareProgress,
      landscape_16x9_1080: landscapeProgress
    }),
    [landscapeProgress, squareProgress, verticalProgress]
  );

  const activeExportRef = useRef<Record<string, string>>({});
  const pollTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const stopPolling = useCallback((presetId: string) => {
    if (pollTimersRef.current[presetId]) {
      clearInterval(pollTimersRef.current[presetId]);
      delete pollTimersRef.current[presetId];
    }
    delete activeExportRef.current[presetId];
  }, []);

  const startPolling = useCallback(
    (presetId: string, exportId: string) => {
      const controller = progressControllers[presetId as keyof typeof progressControllers];
      if (!controller) return;

      stopPolling(presetId);
      activeExportRef.current[presetId] = exportId;
      controller.start();

      pollTimersRef.current[presetId] = setInterval(async () => {
        try {
          const response = await fetch(`/api/exports/${exportId}`, {
            cache: "no-store",
            next: { revalidate: 0 }
          });
          if (!response.ok) {
            return;
          }
          const data = await response.json();
          const status: string | undefined = data.export?.status;
          if (status === "processing" || status === "queued") {
            controller.start();
          }
          if (status === "done") {
            controller.complete();
            stopPolling(presetId);
            if (onQueued) {
              await onQueued();
            }
          }
          if (status === "failed") {
            controller.reset();
            stopPolling(presetId);
            toast({ variant: "destructive", title: "Export failed", description: "Please retry." });
          }
        } catch (error) {
          console.error("Export polling failed", error);
        }
      }, 2000);
    },
    [onQueued, progressControllers, stopPolling, toast]
  );

  useEffect(() => {
    return () => {
      Object.values(pollTimersRef.current).forEach((timer) => clearInterval(timer));
    };
  }, []);

  useEffect(() => {
    exports.forEach((exp) => {
      const controller = progressControllers[exp.preset as keyof typeof progressControllers];
      if (!controller) return;
      const trackedId = activeExportRef.current[exp.preset];

      if ((exp.status === "processing" || exp.status === "queued") && exp.id) {
        if (!trackedId || trackedId !== exp.id) {
          startPolling(exp.preset, exp.id);
        }
      }

      if (exp.status === "done" && trackedId === exp.id) {
        controller.complete();
        stopPolling(exp.preset);
      }

      if (exp.status === "failed" && trackedId === exp.id) {
        controller.reset();
        stopPolling(exp.preset);
        toast({ variant: "destructive", title: "Export failed", description: "Please retry." });
      }
    });
  }, [exports, progressControllers, startPolling, stopPolling, toast]);

  async function queueExport(preset: string) {
    if (selectedClipIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Select clips",
        description: "Choose at least one clip before exporting."
      });
      return;
    }

    setPendingPreset(preset);
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, clipIds: selectedClipIds, preset }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error("Failed to queue export");
      }

      toast({
        title: "Export queued",
        description: "We’ll stitch, caption, and optimize for your preset."
      });

      const data = await response.json();
      const exportRecord: { id: string } | undefined = data?.export;
      if (exportRecord?.id) {
        startPolling(preset, exportRecord.id);
      } else if (onQueued) {
        await onQueued();
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Please retry."
      });
      const controller = progressControllers[preset as keyof typeof progressControllers];
      controller?.reset();
      stopPolling(preset);
    } finally {
      setPendingPreset(null);
    }
  }

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] sm:[grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
      {EXPORT_PRESETS.map((preset) => {
        const controller = progressControllers[preset.id as keyof typeof progressControllers];
        const progressValue = controller?.progress ?? 0;
        const showProgress = (controller?.isActive ?? false) || progressValue > 0;
        const exportRecord = exports.find((exp) => exp.preset === preset.id);
        const isPending = pendingPreset === preset.id;
        const status = exportRecord?.status;
        const isBusy = isPending || status === "processing" || status === "queued" || showProgress;
        return (
          <Card
            key={preset.id}
            className="flex h-full min-w-[0] flex-col rounded-2xl border border-border/50 bg-background/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="text-balance text-lg font-semibold leading-tight">{preset.label}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{preset.description}</CardDescription>
              </div>
              {showProgress ? <ProgressCircle progress={progressValue} size={44} /> : null}
            </CardHeader>
            <CardContent className="flex-1">
              {status ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status: {status}</p>
                  {showProgress ? (
                    <p className="text-xs text-muted-foreground">
                      Encoding optimized MP4… hang tight.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  1080p render, tuned for {preset.label.toLowerCase()}.
                </p>
              )}
            </CardContent>
            <CardFooter className="mt-auto border-t border-border/60 bg-muted/10 px-4 py-4">
              {status === "done" && exportRecord?.outputPath ? (
                <div className="flex w-full gap-2">
                  <Button
                    className="flex-1 justify-center text-sm font-medium"
                    variant="default"
                    asChild
                  >
                    <a href={exportRecord.outputPath} download>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                  <Button
                    className="flex-1 justify-center text-sm font-medium"
                    variant="outline"
                    asChild
                  >
                    <a href={exportRecord.outputPath} target="_blank" rel="noreferrer">
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </a>
                  </Button>
                </div>
              ) : (
                <Button
                  className={cn(
                    "w-full justify-center text-sm font-medium transition-colors",
                    status && status !== "failed" ? "text-foreground" : undefined
                  )}
                  variant={status && status !== "failed" ? "outline" : "default"}
                  onClick={() => queueExport(preset.id)}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      {showProgress ? <ProgressCircle progress={progressValue} size={28} /> : null}
                      {status === "processing"
                        ? "Processing…"
                        : status === "queued"
                          ? "Queued…"
                          : "Preparing…"}
                    </span>
                  ) : (
                    "Queue export"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
