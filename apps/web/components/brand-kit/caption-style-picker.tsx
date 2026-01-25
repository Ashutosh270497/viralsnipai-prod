"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CaptionStyle {
  karaoke: boolean;
  outline: boolean;
  position: "bottom" | "top" | "middle";
}

interface CaptionStylePickerProps {
  value: CaptionStyle;
  onChange: (value: CaptionStyle) => void;
}

export function CaptionStylePicker({ value, onChange }: CaptionStylePickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 px-4 py-3">
        <div>
          <Label className="text-sm font-medium">Karaoke highlight</Label>
          <p className="text-xs text-muted-foreground">Animate captions word-by-word.</p>
        </div>
        <Switch checked={value.karaoke} onCheckedChange={(karaoke) => onChange({ ...value, karaoke })} />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 px-4 py-3">
        <div>
          <Label className="text-sm font-medium">Outline</Label>
          <p className="text-xs text-muted-foreground">Add a contrasting outline for readability.</p>
        </div>
        <Switch checked={value.outline} onCheckedChange={(outline) => onChange({ ...value, outline })} />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Caption position</Label>
        <Select
          value={value.position}
          onValueChange={(position: CaptionStyle["position"]) => onChange({ ...value, position })}
        >
          <SelectTrigger className="rounded-lg">
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom">Bottom</SelectItem>
            <SelectItem value="middle">Middle</SelectItem>
            <SelectItem value="top">Top</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
