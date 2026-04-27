"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Type, RefreshCw, AlertTriangle, Search, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { CaptionOverlayStudio } from "@/components/repurpose/caption-overlay-studio";
import { RemotionClipPreview, type RemotionClipPreviewHandle } from "@/components/repurpose/remotion-clip-preview";
import { srtUtils, type CaptionEntry } from "@/lib/srt-utils";
import { getCaptionQuality, isPlaceholderCaptionText } from "@/lib/caption-quality";
import type { SmartReframePlan } from "@/lib/media/smart-reframe";
import {
  DEFAULT_CLIP_CAPTION_STYLE,
  normalizeClipCaptionStyle,
  type ClipCaptionStyleConfig,
} from "@/lib/repurpose/caption-style-config";
import { cn } from "@/lib/utils";

interface TranscriptEditorProps {
  clipId: string;
  clipTitle?: string | null;
  captionSrt?: string | null;
  captionStyle?: ClipCaptionStyleConfig | null;
  onCaptionStyleChange?: (style: ClipCaptionStyleConfig) => void;
  startMs: number;
  endMs: number;
  previewPath?: string | null;
  smartReframePlan?: SmartReframePlan | null;
  onSave: () => Promise<void>;
  onGenerateCaptions?: () => void;
  isGenerating?: boolean;
}

type TimedWord = {
  token: string;
  startMs: number;
  endMs: number;
};

type InferredTrimRange = {
  startMs: number;
  endMs: number;
  confidence: number;
  matchedTokens: number;
};

type InferredEditRange = {
  startMs: number;
  endMs: number;
  matchedTokens: number;
};

const WORD_TOKEN_REGEX = /[\p{L}\p{N}]+(?:[‘’-][\p{L}\p{N}]+)*/gu;
const MIN_TRIMMED_CLIP_DURATION_MS = 700;
const TRIM_DELTA_THRESHOLD_MS = 250;


export function normalizeEntryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeWordForMatch(word: string): string {
  return word.toLocaleLowerCase();
}

export function tokenizeWords(text: string): string[] {
  const tokens = text.match(WORD_TOKEN_REGEX) ?? [];
  return tokens.map(normalizeWordForMatch).filter(Boolean);
}

function extractWordTokensPreserveCase(text: string): string[] {
  const tokens = text.match(WORD_TOKEN_REGEX) ?? [];
  return tokens.map((token) => token.trim()).filter(Boolean);
}

function combineEntries(entries: CaptionEntry[]): string {
  return entries
    .map((entry) => normalizeEntryText(entry.text))
    .filter((text) => text.length > 0 && !isPlaceholderCaptionText(text))
    .join(" ")
    .trim();
}

function usesRelativeCueTimeline(entries: CaptionEntry[], clipDurationMs: number): boolean {
  if (entries.length === 0) {
    return true;
  }

  const maxEnd = Math.max(...entries.map((entry) => entry.endMs));
  const minStart = Math.min(...entries.map((entry) => entry.startMs));

  return maxEnd <= clipDurationMs + 2_000 && minStart >= -500;
}

export function clampCaptionEntriesToClipWindow(
  entries: CaptionEntry[],
  clipStartMs: number,
  clipEndMs: number
): CaptionEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const clipDurationMs = Math.max(1, clipEndMs - clipStartMs);
  const relativeTimeline = usesRelativeCueTimeline(entries, clipDurationMs);

  const windowStart = relativeTimeline ? 0 : clipStartMs;
  const windowEnd = relativeTimeline ? clipDurationMs : clipEndMs;

  return entries
    .map((entry) => {
      const normalizedText = normalizeEntryText(entry.text);
      if (!normalizedText) {
        return null;
      }

      const overlapStart = Math.max(windowStart, entry.startMs);
      const overlapEnd = Math.min(windowEnd, entry.endMs);

      if (overlapEnd <= overlapStart) {
        return null;
      }

      const startMs = relativeTimeline ? overlapStart : overlapStart - clipStartMs;
      const endMs = relativeTimeline ? overlapEnd : overlapEnd - clipStartMs;

      if (endMs <= startMs) {
        return null;
      }

      return {
        index: entry.index,
        startMs,
        endMs,
        text: normalizedText,
      } satisfies CaptionEntry;
    })
    .filter((entry): entry is CaptionEntry => entry !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function buildWordTimeline(entries: CaptionEntry[]): TimedWord[] {
  const timeline: TimedWord[] = [];

  for (const entry of entries) {
    if (isPlaceholderCaptionText(entry.text)) {
      continue;
    }

    const words = tokenizeWords(entry.text);
    if (words.length === 0) {
      continue;
    }

    const durationMs = Math.max(1, entry.endMs - entry.startMs);
    const stepMs = durationMs / words.length;

    for (let index = 0; index < words.length; index += 1) {
      const startMs = Math.max(0, Math.round(entry.startMs + index * stepMs));
      const endMs =
        index === words.length - 1
          ? Math.max(startMs + 1, entry.endMs)
          : Math.max(startMs + 1, Math.round(entry.startMs + (index + 1) * stepMs));

      timeline.push({
        token: words[index],
        startMs,
        endMs,
      });
    }
  }

  return timeline.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function inferTrimRangeFromEditedText(
  editedText: string,
  timeline: TimedWord[]
): InferredTrimRange | null {
  if (timeline.length === 0) {
    return null;
  }

  const editedTokens = tokenizeWords(editedText);
  if (editedTokens.length === 0) {
    return null;
  }

  const matchedIndices: number[] = [];
  let cursor = 0;

  for (const token of editedTokens) {
    let foundIndex = -1;

    for (let index = cursor; index < timeline.length; index += 1) {
      if (timeline[index].token === token) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      matchedIndices.push(foundIndex);
      cursor = foundIndex + 1;
    }
  }

  if (matchedIndices.length === 0) {
    return null;
  }

  const confidence = matchedIndices.length / editedTokens.length;
  if (confidence < 0.45) {
    return null;
  }

  const first = timeline[matchedIndices[0]];
  const last = timeline[matchedIndices[matchedIndices.length - 1]];

  if (!first || !last || last.endMs <= first.startMs) {
    return null;
  }

  return {
    startMs: first.startMs,
    endMs: last.endMs,
    confidence,
    matchedTokens: matchedIndices.length,
  };
}

export function inferEditRangesFromEditedText(
  editedText: string,
  timeline: TimedWord[]
): InferredEditRange[] | null {
  if (timeline.length === 0) {
    return null;
  }

  const editedTokens = tokenizeWords(editedText);
  if (editedTokens.length === 0) {
    return null;
  }

  const matchedIndices: number[] = [];
  let cursor = 0;

  for (const token of editedTokens) {
    let foundIndex = -1;

    for (let index = cursor; index < timeline.length; index += 1) {
      if (timeline[index].token === token) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex !== -1) {
      matchedIndices.push(foundIndex);
      cursor = foundIndex + 1;
    }
  }

  if (matchedIndices.length === 0) {
    return null;
  }

  const confidence = matchedIndices.length / editedTokens.length;
  if (confidence < 0.45) {
    return null;
  }

  const ranges: InferredEditRange[] = [];
  let rangeStartIdx = matchedIndices[0];
  let previousIdx = matchedIndices[0];

  for (let i = 1; i < matchedIndices.length; i += 1) {
    const currentIdx = matchedIndices[i];
    if (currentIdx !== previousIdx + 1) {
      const first = timeline[rangeStartIdx];
      const last = timeline[previousIdx];
      if (first && last && last.endMs > first.startMs) {
        ranges.push({
          startMs: first.startMs,
          endMs: last.endMs,
          matchedTokens: previousIdx - rangeStartIdx + 1,
        });
      }
      rangeStartIdx = currentIdx;
    }
    previousIdx = currentIdx;
  }

  const lastRangeFirst = timeline[rangeStartIdx];
  const lastRangeLast = timeline[previousIdx];
  if (lastRangeFirst && lastRangeLast && lastRangeLast.endMs > lastRangeFirst.startMs) {
    ranges.push({
      startMs: lastRangeFirst.startMs,
      endMs: lastRangeLast.endMs,
      matchedTokens: previousIdx - rangeStartIdx + 1,
    });
  }

  const MIN_RANGE_MS = 120;
  const MERGE_GAP_MS = 220;
  const merged: InferredEditRange[] = [];

  for (const range of ranges) {
    if (range.endMs - range.startMs < MIN_RANGE_MS) {
      continue;
    }
    const previous = merged[merged.length - 1];
    if (previous && range.startMs - previous.endMs <= MERGE_GAP_MS) {
      previous.endMs = Math.max(previous.endMs, range.endMs);
      previous.matchedTokens += range.matchedTokens;
    } else {
      merged.push({ ...range });
    }
  }

  return merged.length > 0 ? merged : null;
}

function buildTimedCaptionEntriesFromEditedText(
  editedText: string,
  timeline: TimedWord[],
  maxWordsPerCue = 4
): CaptionEntry[] | null {
  if (timeline.length === 0) {
    return null;
  }

  const displayTokens = extractWordTokensPreserveCase(editedText);
  if (displayTokens.length === 0) {
    return null;
  }

  const normalizedTokens = displayTokens.map(normalizeWordForMatch);
  const assignments: Array<{ text: string; startMs: number; endMs: number }> = [];
  const LOOKAHEAD = 8;
  let timelineCursor = 0;

  for (let tokenIndex = 0; tokenIndex < normalizedTokens.length; tokenIndex += 1) {
    const normalizedToken = normalizedTokens[tokenIndex];
    const originalToken = displayTokens[tokenIndex];

    if (timelineCursor >= timeline.length) {
      break;
    }

    let matchedTimelineIndex = -1;
    if (timeline[timelineCursor]?.token === normalizedToken) {
      matchedTimelineIndex = timelineCursor;
    } else {
      const upperBound = Math.min(timeline.length, timelineCursor + LOOKAHEAD);
      for (let i = timelineCursor + 1; i < upperBound; i += 1) {
        if (timeline[i]?.token === normalizedToken) {
          matchedTimelineIndex = i;
          break;
        }
      }
    }

    if (matchedTimelineIndex === -1) {
      matchedTimelineIndex = timelineCursor;
    }

    const slot = timeline[matchedTimelineIndex];
    assignments.push({
      text: originalToken,
      startMs: slot.startMs,
      endMs: slot.endMs,
    });
    timelineCursor = matchedTimelineIndex + 1;
  }

  if (assignments.length === 0) {
    return null;
  }

  if (assignments.length < displayTokens.length) {
    const fallbackSlot = assignments[assignments.length - 1];
    for (let i = assignments.length; i < displayTokens.length; i += 1) {
      assignments.push({
        text: displayTokens[i],
        startMs: fallbackSlot.startMs,
        endMs: fallbackSlot.endMs,
      });
    }
  }

  const chunkedEntries: CaptionEntry[] = [];
  for (let i = 0; i < assignments.length; i += maxWordsPerCue) {
    const chunk = assignments.slice(i, i + maxWordsPerCue);
    const startMs = Math.max(0, chunk[0]?.startMs ?? 0);
    const endMs = Math.max(startMs + 120, chunk[chunk.length - 1]?.endMs ?? startMs + 120);
    chunkedEntries.push({
      index: chunkedEntries.length + 1,
      startMs,
      endMs,
      text: chunk.map((word) => word.text).join(" ").trim(),
    });
  }

  const normalizedEntries: CaptionEntry[] = [];
  let cursorMs = 0;
  for (const entry of chunkedEntries) {
    const text = normalizeEntryText(entry.text);
    if (!text) continue;
    const startMs = Math.max(cursorMs, entry.startMs);
    const endMs = Math.max(startMs + 120, entry.endMs);
    normalizedEntries.push({
      index: normalizedEntries.length + 1,
      startMs,
      endMs,
      text,
    });
    cursorMs = endMs;
  }

  return normalizedEntries.length > 0 ? normalizedEntries : null;
}

export function TranscriptEditor({
  clipId,
  clipTitle,
  captionSrt,
  captionStyle,
  onCaptionStyleChange,
  startMs,
  endMs,
  previewPath,
  smartReframePlan,
  onSave,
  onGenerateCaptions,
  isGenerating,
}: TranscriptEditorProps) {
  const { toast } = useToast();
  const remotionPreviewRef = useRef<RemotionClipPreviewHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);

  const [entries, setEntries] = useState<CaptionEntry[]>([]);
  const [initialEntries, setInitialEntries] = useState<CaptionEntry[]>([]);
  const [initialCaptionStyle, setInitialCaptionStyle] = useState<ClipCaptionStyleConfig>(
    DEFAULT_CLIP_CAPTION_STYLE
  );
  const [undoKey, setUndoKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [captionStyleDraft, setCaptionStyleDraft] = useState<ClipCaptionStyleConfig>(
    () => normalizeClipCaptionStyle(captionStyle)
  );
  const [subtitlesPreviewEnabled, setSubtitlesPreviewEnabled] = useState(true);
  const safeCaptionStyle = captionStyleDraft;

  useEffect(() => {
    const parsed = captionSrt ? srtUtils.parseSRT(captionSrt) : [];
    const normalized = parsed.map((entry) => ({
      ...entry,
      text: normalizeEntryText(entry.text),
    }));
    const clippedEntries = clampCaptionEntriesToClipWindow(normalized, startMs, endMs);
    setEntries(clippedEntries);
    setInitialEntries(clippedEntries);
    const normalizedStyle = normalizeClipCaptionStyle(captionStyle);
    setInitialCaptionStyle(normalizedStyle);
    setCaptionStyleDraft(normalizedStyle);
    setSearchQuery("");
    setUndoKey(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionSrt, clipId, startMs, endMs]); // captionStyle intentionally excluded — only reset on clip change

  const hasEntryChanges = useMemo(
    () => JSON.stringify(entries) !== JSON.stringify(initialEntries),
    [entries, initialEntries]
  );
  const hasStyleChanges =
    JSON.stringify(safeCaptionStyle) !== JSON.stringify(initialCaptionStyle);
  const hasChanges = hasEntryChanges || hasStyleChanges;
  const wordTimeline = useMemo(() => buildWordTimeline(entries), [entries]);

  const clipScopedCaptionSrt = useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    return srtUtils.buildSRT(
      entries.map((entry, index) => ({
        ...entry,
        index: index + 1,
      }))
    );
  }, [entries]);

  const captionQuality = useMemo(() => getCaptionQuality(clipScopedCaptionSrt), [clipScopedCaptionSrt]);

  const durationMs = Math.max(1, endMs - startMs);

  function handleUndo() {
    setEntries(initialEntries);
    setCaptionStyleDraft(initialCaptionStyle);
    onCaptionStyleChange?.(initialCaptionStyle);
    setUndoKey((k) => k + 1);
  }

  function handleCaptionStyleChange(nextStyle: ClipCaptionStyleConfig) {
    const normalizedStyle = normalizeClipCaptionStyle(nextStyle);
    setCaptionStyleDraft(normalizedStyle);
    onCaptionStyleChange?.(normalizedStyle);
  }

  function updateEntryText(idx: number, newText: string) {
    const normalized = normalizeEntryText(newText);
    if (!normalized) return;
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, text: normalized } : e)));
  }

  function splitEntry(idx: number) {
    const entry = entries[idx];
    if (!entry) return;
    const words = entry.text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return;
    const mid = Math.ceil(words.length / 2);
    const midMs = Math.round((entry.startMs + entry.endMs) / 2);
    const a: CaptionEntry = { index: entry.index, startMs: entry.startMs, endMs: midMs, text: words.slice(0, mid).join(" ") };
    const b: CaptionEntry = { index: entry.index + 1, startMs: midMs, endMs: entry.endMs, text: words.slice(mid).join(" ") };
    setEntries(
      [...entries.slice(0, idx), a, b, ...entries.slice(idx + 1)].map((e, i) => ({ ...e, index: i + 1 }))
    );
  }

  function mergeWithNext(idx: number) {
    const a = entries[idx];
    const b = entries[idx + 1];
    if (!a || !b) return;
    const merged: CaptionEntry = { index: a.index, startMs: a.startMs, endMs: b.endMs, text: `${a.text.trim()} ${b.text.trim()}`.trim() };
    setEntries(
      [...entries.slice(0, idx), merged, ...entries.slice(idx + 2)].map((e, i) => ({ ...e, index: i + 1 }))
    );
  }

  const displayEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries.map((e, i) => ({ entry: e, idx: i }));
    return entries.map((e, i) => ({ entry: e, idx: i })).filter(({ entry }) =>
      entry.text.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  async function handleSave() {
    if (!hasChanges) return;

    const combinedText = entries.map((e) => e.text).join(" ").trim();
    if (!combinedText) {
      toast({
        variant: "destructive",
        title: "Transcript is empty",
        description: "Add transcript text or regenerate captions before saving.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const normalizedCaptionStyle = normalizeClipCaptionStyle(safeCaptionStyle);
      let nextStartMs = startMs;
      let nextEndMs = endMs;
      let retimedFromTranscript = false;

      const inferredRange = inferTrimRangeFromEditedText(combinedText, wordTimeline);
      const inferredEditRanges = inferEditRangesFromEditedText(combinedText, wordTimeline);
      if (inferredRange) {
        const candidateStart = startMs + inferredRange.startMs;
        const candidateEnd = startMs + inferredRange.endMs;
        if (
          candidateEnd - candidateStart >= MIN_TRIMMED_CLIP_DURATION_MS &&
          candidateStart >= 0 &&
          candidateEnd > candidateStart
        ) {
          const startDelta = Math.abs(candidateStart - startMs);
          const endDelta = Math.abs(candidateEnd - endMs);
          if (startDelta >= TRIM_DELTA_THRESHOLD_MS || endDelta >= TRIM_DELTA_THRESHOLD_MS) {
            nextStartMs = candidateStart;
            nextEndMs = candidateEnd;
            retimedFromTranscript = true;
          }
        }
      }

      const absoluteEditRanges = inferredEditRanges
        ? inferredEditRanges.map((range) => ({
            startMs: startMs + range.startMs,
            endMs: startMs + range.endMs,
          }))
        : null;
      const hasInternalEditCuts = Boolean(absoluteEditRanges && absoluteEditRanges.length > 1);

      // Build SRT directly from current per-segment entries.
      const captionSrtToPersist = srtUtils.buildSRT(
        entries.map((e, i) => ({ ...e, index: i + 1 }))
      );

      const patchPayload: {
        captionSrt: string;
        startMs: number;
        endMs: number;
        captionStyle: ClipCaptionStyleConfig;
        previewPath?: null;
        transcriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
      } = {
        captionSrt: captionSrtToPersist,
        startMs: nextStartMs,
        endMs: nextEndMs,
        captionStyle: normalizedCaptionStyle,
        transcriptEditRangesMs: hasInternalEditCuts ? absoluteEditRanges : null,
      };

      if (retimedFromTranscript) {
        patchPayload.previewPath = null;
      }

      const updateResponse = await fetch(`/api/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
        cache: "no-store",
      });

      if (!updateResponse.ok) throw new Error("Failed to save transcript");

      const updatePayload = (await updateResponse.json().catch(() => null)) as
        | {
            data?: {
              clip?: { startMs?: number; endMs?: number };
              normalizedTranscriptEditRangesMs?: Array<{ startMs: number; endMs: number }> | null;
            };
          }
        | null;
      const persistedStartMs = Number(updatePayload?.data?.clip?.startMs);
      const persistedEndMs = Number(updatePayload?.data?.clip?.endMs);
      if (Number.isFinite(persistedStartMs) && Number.isFinite(persistedEndMs) && persistedEndMs > persistedStartMs) {
        nextStartMs = persistedStartMs;
        nextEndMs = persistedEndMs;
      }
      const normalizedRangesFromServer = Array.isArray(updatePayload?.data?.normalizedTranscriptEditRangesMs)
        ? updatePayload?.data?.normalizedTranscriptEditRangesMs
        : null;
      const rangesForPersistence = hasInternalEditCuts
        ? normalizedRangesFromServer ?? absoluteEditRanges
        : null;

      if (retimedFromTranscript || hasInternalEditCuts) {
        const regenerateResponse = await fetch("/api/repurpose/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clipId }),
          cache: "no-store",
        });
        if (regenerateResponse.ok) {
          const restoreRes = await fetch(`/api/clips/${clipId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              captionSrt: captionSrtToPersist,
              startMs: nextStartMs,
              endMs: nextEndMs,
              captionStyle: normalizedCaptionStyle,
              transcriptEditRangesMs: rangesForPersistence,
            }),
            cache: "no-store",
          });
          if (!restoreRes.ok) {
            toast({ title: "Clip timing synced", description: "Preview refreshed, but transcript restore failed. Please click Save once more." });
          }
        } else {
          toast({ title: "Clip timing synced", description: "Transcript saved, but preview refresh failed. Regenerate captions to refresh preview." });
        }
      }

      toast({
        title: "Transcript updated",
        description: hasInternalEditCuts
          ? "Saved. Internal transcript deletions will be applied in export render."
          : retimedFromTranscript
            ? "Transcript and clip timing are now synchronized."
            : `Saved ${entries.length} segment${entries.length !== 1 ? "s" : ""}.`,
      });

      setInitialEntries(entries);
      setInitialCaptionStyle(normalizedCaptionStyle);
      await onSave();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Unable to save transcript. Please retry." });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Video progress bar sync ──────────────────────────────────────────────────
  const handlePreviewTimeUpdate = useCallback((ms: number) => {
    const durationMs = Math.max(1, endMs - startMs);
    setVideoProgress(Math.min(100, Math.max(0, (ms / durationMs) * 100)));
    setCurrentMs(ms);
  }, [endMs, startMs]);

  const videoPlayer = previewPath ? (
    <RemotionClipPreview
      ref={remotionPreviewRef}
      previewPath={previewPath}
      entries={entries}
      captionStyle={safeCaptionStyle}
      subtitlesEnabled={subtitlesPreviewEnabled}
      durationMs={Math.max(1, endMs - startMs)}
      smartReframePlan={smartReframePlan}
      onTimeUpdate={handlePreviewTimeUpdate}
    />
  ) : null;

  const missingPreviewNotice =
    !previewPath && onGenerateCaptions ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Clip preview is unavailable. Rebuild captions to regenerate the playable preview and thumbnail.</span>
        </div>
        <Button variant="secondary" size="sm" className="h-7 shrink-0" onClick={onGenerateCaptions} disabled={isGenerating}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isGenerating && "animate-spin")} />
          {isGenerating ? "Rebuilding..." : "Rebuild preview"}
        </Button>
      </div>
    ) : null;

  if (!captionSrt || entries.length === 0) {
    return (
      <div className="space-y-3">
        {videoPlayer}
        {missingPreviewNotice}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center">
          <Type className="mb-2 h-7 w-7 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground/80">No transcript available</p>
          <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/50">Generate captions to create an editable transcript.</p>
          {onGenerateCaptions && (
            <Button variant="default" size="sm" className="mt-4 gap-1.5" onClick={onGenerateCaptions} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
              {isGenerating ? "Generating..." : "Generate Captions"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (captionQuality.tier === "low_quality") {
    return (
      <div className="space-y-3">
        {videoPlayer}
        {missingPreviewNotice}
        <div className="flex flex-col items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-8 text-center">
          <AlertTriangle className="mb-2 h-7 w-7 text-amber-500/60" />
          <p className="text-sm font-medium text-foreground/80">Transcript quality is too low</p>
          <p className="mt-1 max-w-[320px] text-xs text-muted-foreground/60">Captions are mostly unusable. Regenerate to get a clean transcript.</p>
          {onGenerateCaptions && (
            <Button variant="default" size="sm" className="mt-4 gap-1.5" onClick={onGenerateCaptions} disabled={isGenerating}>
              <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
              {isGenerating ? "Regenerating..." : "Regenerate Captions"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videoPlayer}
      {missingPreviewNotice}

      {captionQuality.tier === "needs_cleanup" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Some transcript cues may be noisy ({captionQuality.validCount}/{captionQuality.totalCount} usable). Edit below or regenerate.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Caption controls</p>
          <p className="text-[11px] text-muted-foreground/55">
            Edit subtitle text, style, color, size, and position. Saving marks the clip for preview/export refresh.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Subtitle preview
          <Switch
            checked={subtitlesPreviewEnabled}
            onCheckedChange={setSubtitlesPreviewEnabled}
            aria-label="Toggle subtitle preview"
          />
        </label>
      </div>

      {/* Transcript toolbar: search + segment count + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-full rounded-lg border border-border/50 bg-muted/20 pl-8 pr-3 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Segment count badge */}
        <span className="text-[10px] font-medium text-muted-foreground/50 shrink-0">
          {displayEntries.length}
          {searchQuery.trim() ? `/${entries.length}` : ""} segment{entries.length !== 1 ? "s" : ""}
        </span>
        {entries.length === 1 ? (
          <Badge variant="outline" className="border-border/40 bg-muted/30 text-[10px] text-muted-foreground">
            Single segment
          </Badge>
        ) : null}

        {hasChanges ? (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-300">
            Unsaved caption changes
          </Badge>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onGenerateCaptions && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground" onClick={onGenerateCaptions} disabled={isGenerating}>
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Regen
            </Button>
          )}
          {hasChanges && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground" onClick={handleUndo}>
              Undo
            </Button>
          )}
          <Button size="sm" className="h-6 gap-1 px-2.5 text-[11px]" onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="h-3 w-3" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Video position bar */}
      {previewPath && entries.length > 0 && (
        <div className="h-0.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${videoProgress}%` }} />
        </div>
      )}

      {/* Per-segment rows */}
      <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/30 divide-y divide-border/25">
        {displayEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground/40">
            {searchQuery.trim() ? "No segments match your search." : "No segments available."}
          </div>
        ) : (
          displayEntries.map(({ entry, idx }) => (
            <SegmentRow
              key={`${undoKey}-${entry.index}`}
              entry={entry}
              originalIndex={idx}
              isLast={idx === entries.length - 1}
              isActive={currentMs >= entry.startMs && currentMs < entry.endMs}
              onTextChange={updateEntryText}
              onSplit={splitEntry}
              onMerge={mergeWithNext}
              onSeek={(ms) => {
                remotionPreviewRef.current?.seekToMs(ms);
                handlePreviewTimeUpdate(ms);
              }}
            />
          ))
        )}
      </div>

      <CaptionOverlayStudio
        value={safeCaptionStyle}
        onChange={handleCaptionStyleChange}
        sampleCaption={entries[0]?.text}
        previewPath={previewPath}
        captionEntries={entries}
      />
    </div>
  );
}

// ── Per-segment row ────────────────────────────────────────────────────────────

function msToMinSec(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function SegmentRow({
  entry,
  originalIndex,
  isLast,
  isActive,
  onTextChange,
  onSplit,
  onMerge,
  onSeek,
}: {
  entry: CaptionEntry;
  originalIndex: number;
  isLast: boolean;
  isActive: boolean;
  onTextChange: (idx: number, text: string) => void;
  onSplit: (idx: number) => void;
  onMerge: (idx: number) => void;
  onSeek: (ms: number) => void;
}) {
  const canSplit = entry.text.trim().split(/\s+/).filter(Boolean).length > 1;

  return (
    <div className={cn(
      "group flex items-start gap-3 px-4 py-2.5 transition-colors",
      isActive ? "bg-primary/8" : "hover:bg-muted/20"
    )}>
      {/* Timestamp — click to seek */}
      <button
        onClick={() => onSeek(entry.startMs)}
        className={cn(
          "shrink-0 w-[92px] pt-0.5 font-mono text-[10px] tabular-nums text-left transition-colors hover:text-primary",
          isActive ? "text-primary font-semibold" : "text-muted-foreground/50"
        )}
        title="Seek to this segment"
      >
        {msToMinSec(entry.startMs)} → {msToMinSec(entry.endMs)}
      </button>

      {/* Editable text */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onTextChange(originalIndex, e.currentTarget.textContent ?? "")}
        className="flex-1 min-w-0 text-sm leading-relaxed text-foreground/80 outline-none focus:text-foreground cursor-text py-0.5"
      >
        {entry.text}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button
          onClick={() => onSplit(originalIndex)}
          disabled={!canSplit}
          title="Split at midpoint"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-20 disabled:pointer-events-none"
        >
          <Scissors className="h-3 w-3" />
        </button>
        {!isLast && (
          <button
            onClick={() => onMerge(originalIndex)}
            title="Merge with next segment"
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors text-[11px] font-bold"
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}
