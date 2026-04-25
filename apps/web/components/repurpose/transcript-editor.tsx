"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Type, RefreshCw, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CaptionOverlayStudio } from "@/components/repurpose/caption-overlay-studio";
import { srtUtils, type CaptionEntry } from "@/lib/srt-utils";
import { getCaptionQuality, isPlaceholderCaptionText } from "@/lib/caption-quality";
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
  startMs: number;
  endMs: number;
  previewPath?: string | null;
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
  startMs,
  endMs,
  previewPath,
  onSave,
  onGenerateCaptions,
  isGenerating,
}: TranscriptEditorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const editorRef = useRef<HTMLParagraphElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const [entries, setEntries] = useState<CaptionEntry[]>([]);
  const [initialText, setInitialText] = useState("");
  const [text, setText] = useState("");
  const [initialCaptionStyle, setInitialCaptionStyle] = useState<ClipCaptionStyleConfig>(
    DEFAULT_CLIP_CAPTION_STYLE
  );
  const [liveCaptionStyle, setLiveCaptionStyle] = useState<ClipCaptionStyleConfig>(
    DEFAULT_CLIP_CAPTION_STYLE
  );

  useEffect(() => {
    const parsed = captionSrt ? srtUtils.parseSRT(captionSrt) : [];
    const normalized = parsed.map((entry) => ({
      ...entry,
      text: normalizeEntryText(entry.text),
    }));

    const clippedEntries = clampCaptionEntriesToClipWindow(normalized, startMs, endMs);
    const combined = combineEntries(clippedEntries);

    setEntries(clippedEntries);
    setInitialText(combined);
    setText(combined);
    const normalizedStyle = normalizeClipCaptionStyle(captionStyle);
    setInitialCaptionStyle(normalizedStyle);
    setLiveCaptionStyle(normalizedStyle);
  }, [captionSrt, captionStyle, clipId, startMs, endMs]);

  const liveText = useMemo(
    () => normalizeEntryText(editorRef.current?.textContent ?? text),
    [text]
  );
  const hasStyleChanges =
    JSON.stringify(liveCaptionStyle) !== JSON.stringify(initialCaptionStyle);
  const hasChanges = liveText !== initialText || hasStyleChanges;
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
    setText(initialText);
    setLiveCaptionStyle(initialCaptionStyle);
    if (editorRef.current) {
      editorRef.current.textContent = initialText;
    }
  }

  async function handleSave() {
    if (!hasChanges) return;

    const normalized = normalizeEntryText(editorRef.current?.textContent ?? text);
    if (!normalized) {
      toast({
        variant: "destructive",
        title: "Transcript is empty",
        description: "Add transcript text or regenerate captions before saving.",
      });
      return;
    }

    setIsSaving(true);
    setText(normalized);

    try {
      const normalizedCaptionStyle = normalizeClipCaptionStyle(liveCaptionStyle);
      let nextStartMs = startMs;
      let nextEndMs = endMs;
      let retimedFromTranscript = false;

      const inferredRange = inferTrimRangeFromEditedText(normalized, wordTimeline);
      const inferredEditRanges = inferEditRangesFromEditedText(normalized, wordTimeline);
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

      const nextDurationMs = Math.max(1, nextEndMs - nextStartMs);
      const absoluteEditRanges = inferredEditRanges
        ? inferredEditRanges.map((range) => ({
            startMs: startMs + range.startMs,
            endMs: startMs + range.endMs,
          }))
        : null;
      const hasInternalEditCuts = Boolean(absoluteEditRanges && absoluteEditRanges.length > 1);

      const singleSegmentSrt = srtUtils.buildSRT([
        {
          index: 1,
          startMs: 0,
          endMs: nextDurationMs,
          text: normalized,
        },
      ]);

      const rebuiltTimedEntries = buildTimedCaptionEntriesFromEditedText(
        normalized,
        wordTimeline
      );
      const captionSrtToPersist = rebuiltTimedEntries
        ? srtUtils.buildSRT(rebuiltTimedEntries)
        : singleSegmentSrt;

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
        // Existing preview represents old range, so invalidate immediately.
        patchPayload.previewPath = null;
      }

      const updateResponse = await fetch(`/api/clips/${clipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
        cache: "no-store",
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to save transcript");
      }

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
        // Refresh preview for updated clip timing and/or internal cut ranges.
        const regenerateResponse = await fetch("/api/repurpose/captions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clipId }),
          cache: "no-store",
        });

        if (regenerateResponse.ok) {
          // Keep the user-edited transcript as the final source of truth.
          const restoreTranscriptResponse = await fetch(`/api/clips/${clipId}`, {
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

          if (!restoreTranscriptResponse.ok) {
            toast({
              title: "Clip timing synced",
              description: "Preview refreshed, but transcript restore failed. Please click Save once more.",
            });
          }
        } else {
          toast({
            title: "Clip timing synced",
            description: "Transcript saved, but preview refresh failed. Regenerate captions to refresh preview.",
          });
        }
      }

      toast({
        title: "Transcript updated",
        description: hasInternalEditCuts
          ? "Saved. Internal transcript deletions will be applied in export render."
          : retimedFromTranscript
            ? "Transcript and clip timing are now synchronized."
            : "Saved in single-block format.",
      });

      setInitialText(normalized);
      setText(normalized);
      setLiveCaptionStyle(normalizedCaptionStyle);
      await onSave();
      setInitialCaptionStyle(normalizedCaptionStyle);
    } catch {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Unable to save transcript. Please retry.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Video progress bar sync ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleTimeUpdate() {
      const dur = video!.duration || 1;
      setVideoProgress((video!.currentTime / dur) * 100);
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  const seekVideoToEditorCursor = useCallback(() => {
    const editor = editorRef.current;
    const video = videoRef.current;
    if (!editor || !video || wordTimeline.length === 0) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) {
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(editor);
    range.setEnd(anchorNode, selection.anchorOffset);
    const beforeCaret = range.toString();

    const liveTokens = tokenizeWords(editor.textContent ?? "");
    if (liveTokens.length === 0) {
      return;
    }

    const wordIndex = Math.max(0, tokenizeWords(beforeCaret).length - 1);
    const normalizedIndex =
      wordTimeline.length === liveTokens.length
        ? wordIndex
        : Math.round((wordIndex / Math.max(1, liveTokens.length - 1)) * Math.max(0, wordTimeline.length - 1));

    const targetWord = wordTimeline[Math.max(0, Math.min(wordTimeline.length - 1, normalizedIndex))];
    if (!targetWord) {
      return;
    }

    video.currentTime = targetWord.startMs / 1000;
  }, [wordTimeline]);

  const videoPlayer = previewPath ? (
    <div className="relative w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={previewPath}
        className="w-full object-contain"
        style={{ maxHeight: "240px" }}
        preload="metadata"
        controls
      />
      <CaptionPreviewOverlay
        captionStyle={liveCaptionStyle}
        activeCaption={entries.find((entry) => {
          const currentMs = videoRef.current ? Math.round(videoRef.current.currentTime * 1000) : 0;
          return currentMs >= entry.startMs && currentMs <= entry.endMs;
        })?.text ?? text}
        currentMs={Math.round((videoRef.current?.currentTime ?? 0) * 1000)}
      />
    </div>
  ) : null;

  const missingPreviewNotice =
    !previewPath && onGenerateCaptions ? (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Clip preview is unavailable for this highlight. Rebuild captions to regenerate the playable preview and thumbnail.
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 shrink-0"
          onClick={onGenerateCaptions}
          disabled={isGenerating}
        >
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
          <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/50">
            Generate captions to create an editable transcript.
          </p>
          {onGenerateCaptions && (
            <Button
              variant="default"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={onGenerateCaptions}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Type className="h-3.5 w-3.5" />
              )}
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
          <p className="mt-1 max-w-[320px] text-xs text-muted-foreground/60">
            Captions are mostly unusable. Regenerate to get a clean single-block transcript.
          </p>
          {onGenerateCaptions && (
            <Button
              variant="default"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={onGenerateCaptions}
              disabled={isGenerating}
            >
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
          <span>
            Some transcript cues may be noisy ({captionQuality.validCount}/{captionQuality.totalCount} usable). Edit the text below or regenerate for best results.
          </span>
        </div>
      )}

      {/* Transcript header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Transcript
          </p>
          <Badge variant="secondary" className="h-[18px] px-1.5 text-[10px]">
            Single segment
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {onGenerateCaptions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
              onClick={onGenerateCaptions}
              disabled={isGenerating}
            >
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Regenerate
            </Button>
          )}
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
              onClick={handleUndo}
            >
              Undo
            </Button>
          )}
          <Button
            size="sm"
            className="h-6 gap-1 px-2.5 text-[11px]"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="h-3 w-3" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Video position bar */}
      {previewPath && entries.length > 0 && (
        <div className="h-0.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100"
            style={{ width: `${videoProgress}%` }}
          />
        </div>
      )}

      {/* Single-block transcript editor — always one unified text block */}
      <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/30">
        {!text.trim() ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground/40">
            Transcript is empty — click Save to commit.
          </div>
        ) : (
          <p
            ref={editorRef}
            key={initialText}
            contentEditable
            suppressContentEditableWarning
            onMouseUp={seekVideoToEditorCursor}
            onKeyUp={seekVideoToEditorCursor}
            onBlur={(e) => {
              const normalized = normalizeEntryText(e.currentTarget.textContent ?? "");
              if (normalized) setText(normalized);
            }}
            className="px-4 py-4 text-sm leading-relaxed text-foreground/80 outline-none focus:text-foreground cursor-text transition-colors min-h-[80px] whitespace-pre-wrap"
          >
            {text}
          </p>
        )}
      </div>

      <CaptionOverlayStudio
        value={liveCaptionStyle}
        onChange={setLiveCaptionStyle}
        sampleCaption={entries[0]?.text || text}
        previewPath={previewPath}
        captionEntries={entries}
      />
    </div>
  );
}

function CaptionPreviewOverlay({
  captionStyle,
  activeCaption,
  currentMs,
}: {
  captionStyle: ClipCaptionStyleConfig;
  activeCaption: string;
  currentMs: number;
}) {
  const activeHook = captionStyle.hookOverlays.find(
    (overlay) => currentMs >= overlay.startMs && currentMs <= overlay.endMs
  );

  return (
    <>
      {activeHook ? (
        <div
          className={cn(
            "pointer-events-none absolute max-w-[80%] rounded-xl px-4 py-2 text-center shadow-xl",
            activeHook.position === "top" && "left-1/2 top-[10%] -translate-x-1/2",
            activeHook.position === "center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            activeHook.position === "bottom" && "left-1/2 bottom-[16%] -translate-x-1/2"
          )}
          style={{
            color: activeHook.textColor,
            backgroundColor: `${activeHook.backgroundColor}${Math.round(activeHook.backgroundOpacity * 255)
              .toString(16)
              .padStart(2, "0")}`,
            fontSize: `${Math.max(16, Math.round(activeHook.fontSize * 0.34))}px`,
            fontWeight: activeHook.bold ? 700 : 500,
            fontStyle: activeHook.italic ? "italic" : "normal",
          }}
        >
          {activeHook.text}
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute left-1/2 max-w-[86%] -translate-x-1/2 rounded-xl px-4 py-2 text-center shadow-xl",
          captionStyle.position === "top" && "top-[14%]",
          captionStyle.position === "middle" && "top-1/2 -translate-y-1/2",
          captionStyle.position === "bottom" && "bottom-[10%]"
        )}
        style={{
          color: captionStyle.primaryColor,
          fontSize: `${Math.max(15, Math.round(captionStyle.fontSize * 0.34))}px`,
          fontFamily: captionStyle.fontFamily,
          WebkitTextStroke: captionStyle.outline ? `1px ${captionStyle.outlineColor}` : undefined,
          backgroundColor: captionStyle.background
            ? `${captionStyle.backgroundColor}${Math.round(captionStyle.backgroundOpacity * 255)
                .toString(16)
                .padStart(2, "0")}`
            : "transparent",
        }}
      >
        {normalizeEntryText(activeCaption) || "Caption preview"}
      </div>
    </>
  );
}
