"use client";

import { useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ScriptEditor({ value, onChange }: ScriptEditorProps) {
  const wordCount = useMemo(() => {
    if (!value) return 0;
    return value.trim().split(/\s+/).length;
  }, [value]);

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        placeholder="Write or edit your script here..."
        className="resize-none text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        <span>~{Math.round((wordCount / 130) * 60)}s spoken</span>
      </div>
    </div>
  );
}
