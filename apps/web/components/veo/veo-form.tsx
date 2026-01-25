import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

import type { GeneratedVideo } from "./use-veo-generator";

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type VeoFormState = {
  prompt: string;
  negativePrompt: string;
  stylePreset: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
};

type VeoFormProps = {
  form: VeoFormState;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onChange: <K extends keyof VeoFormState>(key: K, value: VeoFormState[K]) => void;
  isGenerating: boolean;
  progress: number;
  error: string | null;
  canGenerate: boolean;
};

const ASPECT_RATIOS: Array<{ value: AspectRatio; label: string }> = [
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "1:1", label: "Square (1:1)" },
  { value: "4:5", label: "Social (4:5)" }
];

const DURATIONS = Array.from({ length: 9 }, (_, index) => {
  const seconds = index + 4;
  return { value: String(seconds), label: `${seconds} seconds` };
});

export function VeoForm({
  form,
  onSubmit,
  onReset,
  onChange,
  isGenerating,
  progress,
  error,
  canGenerate
}: VeoFormProps) {
  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="veo-prompt">Prompt</Label>
        <Textarea
          id="veo-prompt"
          value={form.prompt}
          onChange={(event) => onChange("prompt", event.target.value)}
          rows={4}
          placeholder="Tracking shot through a bustling night market in Mumbai, neon signage, warm cinematic lighting..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Aspect ratio</Label>
          <Select
            value={form.aspectRatio}
            onValueChange={(value) => onChange("aspectRatio", value as AspectRatio)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select
            value={String(form.durationSeconds)}
            onValueChange={(value) => onChange("durationSeconds", Number.parseInt(value, 10))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="veo-style">Style hint</Label>
          <Input
            id="veo-style"
            value={form.stylePreset}
            onChange={(event) => onChange("stylePreset", event.target.value)}
            placeholder="eg. documentary, timelapse, moody noir"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="veo-negative">Negative prompt</Label>
          <Input
            id="veo-negative"
            value={form.negativePrompt}
            onChange={(event) => onChange("negativePrompt", event.target.value)}
            placeholder="Avoid: text overlays, motion blur"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Progress value={progress} aria-label="Veo generation progress" className="h-2" />
        <p className="text-xs text-muted-foreground">
          {isGenerating ? "Rendering…" : error ? `Error: ${error}` : "Veo renders ~6-12 second clips in seconds."}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={isGenerating || !canGenerate}>
          <Film className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating…" : "Generate video"}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset} disabled={isGenerating}>
          Clear
        </Button>
      </div>
    </form>
  );
}
