"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { srtToWebVTT } from "@/lib/captions/webvtt";

import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { cn } from "@/lib/utils";
import { EXPORT_PRESETS } from "@clippers/types";

interface ExportPanelProps {
  projectId: string;
  selectedClipIds: string[];
  hasHookOverlays?: boolean;
  exports: Array<{
    id: string;
    preset: string;
    includeCaptions?: boolean;
    status: string;
    outputPath?: string;
    error?: string | null;
    createdAt?: string;
  }>;
  onQueued?: () => Promise<void> | void;
  selectedPreset: string;
  onPresetChange: (preset: string) => void;
  /** SRT caption text of the selected clip — enables .srt / .vtt downloads. */
  captionSrt?: string | null;
  /** Used as the filename stem for downloaded caption files. */
  clipTitle?: string | null;
}

type ExportRuntime = {
  exportId: string;
  stage: string;
  progressPct: number;
  attempts: number;
  maxAttempts: number;
  retryable: boolean;
  updatedAt: number;
  startedAt: number;
  failureCode?: string | null;
  failureDetail?: string | null;
};

type ExportStatus = "queued" | "processing" | "completed" | "done" | "failed" | "retryable" | "cancelled" | string;

export function ExportPanel({
  projectId,
  selectedClipIds,
  hasHookOverlays = false,
  exports,
  onQueued,
  selectedPreset,
  onPresetChange,
  captionSrt,
  clipTitle,
}: ExportPanelProps) {
  const { toast } = useToast();
  const [includeCaptions, setIncludeCaptions] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [runtime, setRuntime] = useState<ExportRuntime | null>(null);

  const activeExportIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedFailureRef = useRef<string | null>(null);

  const selectedPresetConfig = useMemo(
    () => EXPORT_PRESETS.find((preset) => preset.id === selectedPreset) ?? EXPORT_PRESETS[0],
    [selectedPreset]
  );

  const hasCaptionAwareHistory = useMemo(
    () => exports.some((exp) => typeof exp.includeCaptions === "boolean"),
    [exports]
  );

  const selectedModeExports = useMemo(() => {
    return exports
      .filter((exp) => {
        if (exp.preset !== selectedPreset) {
          return false;
        }
        if (!hasCaptionAwareHistory) {
          return true;
        }
        return Boolean(exp.includeCaptions) === includeCaptions;
      })
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [exports, hasCaptionAwareHistory, includeCaptions, selectedPreset]);

  const latestExport = selectedModeExports[0];

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    activeExportIdRef.current = null;
  }, []);

  const notifyFailedExport = useCallback(
    (exportId: string, message?: string | null) => {
      if (notifiedFailureRef.current === exportId) {
        return;
      }
      notifiedFailureRef.current = exportId;
      toast({
        variant: "destructive",
        title: "Export failed",
        description: summarizeError(message) || "Please retry.",
      });
    },
    [toast]
  );

  const startPolling = useCallback(
    (exportId: string) => {
      stopPolling();
      activeExportIdRef.current = exportId;

      pollTimerRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/exports/${exportId}`, {
            cache: "no-store",
            next: { revalidate: 0 },
          });

          if (!response.ok) {
            return;
          }

          const payload = await response.json();
          const data = payload?.data ?? payload;
          const status: string | undefined = data.export?.status;
          const errorMessage: string | undefined = data.export?.error;
          setRuntime(data.runtime ?? null);

          if (status === "processing" || status === "queued" || status === "retryable") {
            return;
          }

          if (isCompletedStatus(status)) {
            setRuntime((current) =>
              current && current.exportId === exportId
                ? { ...current, stage: "done", progressPct: 100, retryable: false }
                : current
            );
            notifiedFailureRef.current = null;
            stopPolling();
            if (onQueued) {
              await onQueued();
            }
            return;
          }

          if (status === "failed" || status === "cancelled") {
            setRuntime((current) =>
              current && current.exportId === exportId
                ? { ...current, stage: "failed", progressPct: 100, retryable: false }
                : current
            );
            stopPolling();
            notifyFailedExport(exportId, errorMessage);
            if (onQueued) {
              await onQueued();
            }
          }
        } catch (error) {
          console.error("Export polling failed", error);
        }
      }, 2000);
    },
    [notifyFailedExport, onQueued, stopPolling]
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    stopPolling();
    setRuntime(null);
    notifiedFailureRef.current = null;
    setIsQueueing(false);
  }, [projectId, stopPolling]);

  useEffect(() => {
    if (!latestExport?.id) {
      setRuntime(null);
      stopPolling();
      return;
    }

    if (latestExport.status === "queued" || latestExport.status === "processing" || latestExport.status === "retryable") {
      if (activeExportIdRef.current !== latestExport.id) {
        startPolling(latestExport.id);
      }
      return;
    }

    if (isCompletedStatus(latestExport.status)) {
      setRuntime((current) =>
        current && current.exportId === latestExport.id
          ? { ...current, stage: "done", progressPct: 100, retryable: false }
          : current
      );
      stopPolling();
      notifiedFailureRef.current = null;
      return;
    }

    if (latestExport.status === "failed" || latestExport.status === "cancelled") {
      setRuntime((current) =>
        current && current.exportId === latestExport.id
          ? { ...current, stage: "failed", progressPct: 100, retryable: false }
          : current
      );
      stopPolling();
      notifyFailedExport(latestExport.id, latestExport.error);
      return;
    }

    setRuntime(null);
    stopPolling();
  }, [latestExport, notifyFailedExport, startPolling, stopPolling]);

  async function queueExport() {
    if (selectedClipIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Select clips",
        description: "Choose at least one clip before exporting.",
      });
      return;
    }

    setIsQueueing(true);

    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clipIds: selectedClipIds,
          preset: selectedPreset,
          includeCaptions,
        }),
        cache: "no-store",
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response);
        throw new Error(message ?? "Failed to queue export");
      }

      const payload = await response.json();
      const data = payload?.data ?? payload;
      const exportRecord: { id: string } | undefined = data?.export;

      toast({
        title: "Export queued",
        description: includeCaptions
          ? "Rendering with burned captions in selected ratio."
          : hasHookOverlays
            ? "Rendering without captions but keeping timed hook overlays."
            : "Rendering clean video without burned captions.",
      });

      if (exportRecord?.id) {
        setRuntime({
          exportId: exportRecord.id,
          stage: "queued",
          progressPct: 2,
          attempts: 1,
          maxAttempts: 2,
          retryable: true,
          updatedAt: Date.now(),
          startedAt: Date.now(),
          failureCode: null,
          failureDetail: null,
        });
        startPolling(exportRecord.id);
      }

      if (onQueued) {
        await onQueued();
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? summarizeError(error.message) : "Please retry.",
      });
      setRuntime(null);
      stopPolling();
    } finally {
      setIsQueueing(false);
    }
  }

  const currentStatus = latestExport?.status;
  const isBusy = isQueueing || currentStatus === "queued" || currentStatus === "processing" || currentStatus === "retryable";
  const effectiveProgress =
    isCompletedStatus(currentStatus)
      ? 100
    : currentStatus === "failed"
        ? 100
        : runtime?.progressPct ?? (currentStatus === "queued" ? 2 : 0);
  const stageLabel = formatStage(runtime?.stage, currentStatus);
  const activeFailureLabel = runtime?.failureCode ? humanizeFailureCode(runtime.failureCode) : null;

  const ctaLabel = isQueueing
    ? "Queueing..."
    : currentStatus === "queued"
      ? "Queued..."
      : currentStatus === "processing"
        ? "Rendering..."
        : `Export ${selectedClipIds.length} clip${selectedClipIds.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-muted/25 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/45">
              Output Ratio
            </p>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
              <select
                value={selectedPreset}
                onChange={(event) => onPresetChange(event.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none"
              >
                {EXPORT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-zinc-950">
                    {preset.width}:{preset.height} · {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground/55">{selectedPresetConfig.description}</p>
          </div>

          <div className="flex min-w-[260px] items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Burn captions on video</p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                {includeCaptions
                  ? "Styled captions baked into exported clip"
                  : hasHookOverlays
                    ? "Caption burn-in off · timed hook overlays still render"
                    : "Clean output · no caption overlay"}
              </p>
            </div>
            <Switch checked={includeCaptions} onCheckedChange={setIncludeCaptions} aria-label="Toggle export captions" />
          </div>
        </div>
      </div>

      <button
        onClick={queueExport}
        disabled={isBusy || selectedClipIds.length === 0}
        className={cn(
          "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
          isBusy || selectedClipIds.length === 0
            ? "bg-muted text-muted-foreground/45 cursor-not-allowed"
            : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-900/20"
        )}
      >
        {isBusy
          ? <><Loader2 className="h-4 w-4 animate-spin" />{ctaLabel}</>
          : <><Download className="h-4 w-4" />{ctaLabel}</>
        }
      </button>

      {latestExport && (
        <div className={cn(
          "rounded-xl border px-4 py-4",
          latestExport.status === "done"
            ? "border-emerald-500/20 bg-emerald-500/[0.06]"
            : latestExport.status === "failed" || latestExport.status === "cancelled"
              ? "border-red-500/20 bg-red-500/[0.06]"
              : "border-primary/20 bg-primary/[0.06]"
        )}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 pt-0.5">
              {isCompletedStatus(latestExport.status) ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : latestExport.status === "failed" || latestExport.status === "cancelled" ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : runtime?.stage === "retrying" || latestExport.status === "retryable" ? (
                <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    isCompletedStatus(latestExport.status)
                      ? "text-emerald-400"
                      : latestExport.status === "failed" || latestExport.status === "cancelled"
                        ? "text-red-400"
                        : runtime?.stage === "retrying"
                          ? "text-amber-400"
                          : "text-primary"
                  )}>
                    {formatStatus(latestExport.status)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/65 mt-0.5">
                    {stageLabel}
                    {runtime?.attempts && runtime.maxAttempts > 1
                      ? ` · attempt ${runtime.attempts}/${runtime.maxAttempts}`
                      : ""}
                  </p>
                </div>
                <ProgressCircle progress={effectiveProgress} size={40} className="shrink-0" />
              </div>

              {activeFailureLabel ? (
                <div className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  runtime?.stage === "retrying" ? "text-amber-400/90" : "text-muted-foreground/70"
                )}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    {runtime?.stage === "retrying" ? "Auto-retrying after" : "Last issue:"} {activeFailureLabel}
                  </span>
                </div>
              ) : null}

              {(latestExport.status === "failed" || latestExport.status === "cancelled") && latestExport.error ? (
                <p className="text-[11px] text-red-400/70">{summarizeError(latestExport.error)}</p>
              ) : null}

              {isCompletedStatus(latestExport.status) && latestExport.outputPath ? (
                <div className="flex items-center gap-1.5 pt-1">
                  <a
                    href={latestExport.outputPath}
                    download
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                  <a
                    href={latestExport.outputPath}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/80"
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Caption file downloads — only shown when captionSrt is available */}
      {captionSrt && captionSrt.trim().length > 0 && !captionSrt.includes("[Transcript unavailable]") && (
        <CaptionDownloadRow srt={captionSrt} clipTitle={clipTitle} />
      )}

      {exports.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-2 px-0.5">
            Export History
          </p>
          <div className="divide-y divide-border/40">
            {exports.slice(0, 5).map((exp) => {
              const preset = EXPORT_PRESETS.find((p) => p.id === exp.preset);
              return (
                <div key={exp.id} className="group flex items-center gap-3 py-2.5 px-0.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-0.5",
                    isCompletedStatus(exp.status) ? "bg-emerald-400"
                    : exp.status === "failed" ? "bg-red-400"
                    : "bg-primary/60 animate-pulse"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{preset?.label ?? exp.preset}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {exp.includeCaptions
                        ? "with captions"
                        : hasHookOverlays
                          ? "with hook overlays"
                          : "clean output"}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                    isCompletedStatus(exp.status) ? "bg-emerald-500/15 text-emerald-400"
                    : exp.status === "failed" ? "bg-red-500/15 text-red-400"
                    : "bg-primary/15 text-primary"
                  )}>
                    {isCompletedStatus(exp.status) ? "Done"
                      : exp.status === "failed" ? "Failed"
                      : "Rendering…"}
                  </span>
                  {isCompletedStatus(exp.status) && exp.outputPath && (
                    <a
                      href={exp.outputPath}
                      download
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-foreground transition-colors" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatus(status?: ExportStatus): string {
  if (!status) {
    return "Ready to export";
  }
  if (status === "queued") {
    return "Queued for rendering";
  }
  if (status === "processing") {
    return "Rendering in progress";
  }
  if (isCompletedStatus(status)) {
    return "Export completed";
  }
  if (status === "retryable") {
    return "Retrying export";
  }
  if (status === "cancelled") {
    return "Export cancelled";
  }
  if (status === "failed") {
    return "Export failed";
  }
  return status;
}

function formatStage(stage?: string | null, status?: string): string {
  if (status === "queued" && !stage) return "Waiting for render worker…";
  if (status === "processing" && !stage) return "Rendering export…";

  switch (stage) {
    case "queued":
      return "Waiting for render worker…";
    case "preparing":
      return "Preparing source media and export settings…";
    case "extracting":
      return "Extracting selected clip segments…";
    case "styling":
      return "Applying caption and overlay styling…";
    case "stitching":
      return "Stitching clips into final export…";
    case "finalizing":
      return "Finalizing output file…";
    case "retrying":
      return "Recovering from render failure…";
    case "done":
      return "Export completed.";
    case "failed":
      return "Export failed.";
    default:
      return "Rendering export…";
  }
}

function humanizeFailureCode(code: string) {
  switch (code) {
    case "SOURCE_MEDIA_MISSING":
      return "missing source media";
    case "CAPTION_RENDER_FAILED":
      return "caption or overlay render failure";
    case "EXPORT_STITCH_FAILED":
      return "clip stitching failure";
    case "OUTPUT_WRITE_FAILED":
      return "output write failure";
    default:
      return "unknown render failure";
  }
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.json();
    return payload?.message || payload?.error?.message || payload?.error || null;
  } catch {
    return null;
  }
}

function summarizeError(message?: string | null) {
  if (!message) return "";
  const normalized = message.replace(/^Error:\s*/i, "").trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function isCompletedStatus(status?: string | null) {
  return status === "done" || status === "completed";
}

// ─── Caption download helpers ──────────────────────────────────────────────────

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function safeStem(title: string | null | undefined): string {
  if (!title) return "captions";
  return title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 64)
    .toLowerCase() || "captions";
}

function CaptionDownloadRow({
  srt,
  clipTitle,
}: {
  srt: string;
  clipTitle?: string | null;
}) {
  const stem = safeStem(clipTitle);

  function handleSrt() {
    downloadBlob(srt, "application/x-subrip", `${stem}.srt`);
  }

  function handleVtt() {
    const vtt = srtToWebVTT(srt);
    downloadBlob(vtt, "text/vtt", `${stem}.vtt`);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
        Download Captions
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSrt}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-border hover:text-foreground"
        >
          <FileText className="h-3 w-3" />
          Download .srt
        </button>
        <button
          onClick={handleVtt}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-border hover:text-foreground"
        >
          <FileText className="h-3 w-3" />
          Download .vtt
        </button>
        <p className="ml-auto text-[10px] text-muted-foreground/40">
          Soft captions for any player
        </p>
      </div>
    </div>
  );
}
