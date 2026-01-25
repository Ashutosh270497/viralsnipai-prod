"use client";

import { ChangeEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { srtUtils } from "@/lib/srt-utils";

interface CaptionRow {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface CaptionTableProps {
  captions: CaptionRow[];
  activeCaptionId?: string;
  onSelect?: (captionId: string) => void;
  onUpdate?: (captionId: string, value: Partial<CaptionRow>) => void;
  onDelete?: (captionId: string) => void;
  onInsertAfter?: (captionId: string) => void;
}

export function CaptionTable({
  captions,
  activeCaptionId,
  onDelete,
  onInsertAfter,
  onSelect,
  onUpdate
}: CaptionTableProps) {
  const [editingMap, setEditingMap] = useState<Record<string, string>>({});

  const rows = useMemo(() => captions.sort((a, b) => a.startMs - b.startMs), [captions]);

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>, captionId: string) {
    const value = event.target.value;
    setEditingMap((prev) => ({ ...prev, [captionId]: value }));
  }

  function handleTextBlur(caption: CaptionRow) {
    const draft = editingMap[caption.id];
    if (draft !== undefined && draft !== caption.text) {
      onUpdate?.(caption.id, { text: draft });
    }
  }

  return (
    <div className="space-y-3" data-testid="caption-table-v2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Captions</h3>
          <p className="text-xs text-muted-foreground">Edit text, merge lines, or import/export SRT files.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Button variant="outline" size="sm" type="button" onClick={() => alert("SRT import coming soon")}>Import SRT</Button>
          <Button variant="outline" size="sm" type="button" onClick={() => alert("SRT export coming soon")}>Export SRT</Button>
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-border/60 bg-background/80 shadow-inner">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Start</th>
              <th className="px-4 py-3 text-left">End</th>
              <th className="px-4 py-3 text-left">Caption</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((caption) => {
              const isActive = caption.id === activeCaptionId;
              return (
                <tr
                  key={caption.id}
                  className={cn("transition hover:bg-secondary/40", isActive && "bg-brand-500/10")}
                  onClick={() => onSelect?.(caption.id)}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">{srtUtils.formatDuration(caption.startMs)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{srtUtils.formatDuration(caption.endMs)}</td>
                  <td className="px-4 py-3">
                    <Textarea
                      className="h-20 resize-none text-sm"
                      value={editingMap[caption.id] ?? caption.text}
                      onChange={(event) => handleTextChange(event, caption.id)}
                      onBlur={() => handleTextBlur(caption)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onInsertAfter?.(caption.id);
                        }}
                      >
                        Split
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete?.(caption.id);
                        }}
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-muted-foreground">No captions yet — generate captions to get started.</div>
        ) : null}
      </div>
    </div>
  );
}
