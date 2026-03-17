"use client";

import { useState } from "react";
import { Sparkles, Wand2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface GeneratedPrompts {
  brief: string;
  audience: string;
  tone: string;
  callToAction: string;
  reasoning: string;
}

interface AIPromptGeneratorDialogProps {
  onPromptsGenerated: (prompts: Omit<GeneratedPrompts, "reasoning">) => void;
  transcript?: string | null;
  videoTitle?: string;
}

const PLATFORMS = [
  { value: "YouTube Shorts", label: "YouTube Shorts" },
  { value: "TikTok", label: "TikTok" },
  { value: "Instagram Reels", label: "Instagram Reels" },
  { value: "All Platforms", label: "All Platforms" },
];

export function AIPromptGeneratorDialog({
  onPromptsGenerated,
  transcript,
  videoTitle,
}: AIPromptGeneratorDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [platform, setPlatform] = useState<string>("YouTube Shorts");
  const [customInstructions, setCustomInstructions] = useState("");

  const [generatedPrompts, setGeneratedPrompts] =
    useState<GeneratedPrompts | null>(null);

  const hasTranscript = !!transcript && transcript.trim().length > 20;

  const handleGenerate = async () => {
    if (!hasTranscript) {
      toast({
        variant: "destructive",
        title: "No transcript available",
        description:
          "Ingest a video first so the AI can analyze its content.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/repurpose/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript!.slice(0, 12000),
          videoTitle: videoTitle || undefined,
          platform,
          customInstructions: customInstructions || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate prompts");
      }

      const data = await response.json();
      setGeneratedPrompts(data.prompts);

      toast({
        title: "Prompts generated from video analysis",
        description:
          "Review the prompts below — they're tailored to your video content.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Could not generate prompts. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedPrompts) return;

    onPromptsGenerated({
      brief: generatedPrompts.brief,
      audience: generatedPrompts.audience,
      tone: generatedPrompts.tone,
      callToAction: generatedPrompts.callToAction,
    });

    toast({
      title: "Prompts applied",
      description: "The video-specific prompts have been filled in.",
    });

    setGeneratedPrompts(null);
    setCustomInstructions("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 dark:border-violet-800 dark:from-violet-950 dark:to-purple-950 dark:text-violet-300 shadow-sm"
          disabled={!hasTranscript}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          AI Generate Prompts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-600" />
            AI Prompt Generator
          </DialogTitle>
          <DialogDescription>
            Analyzes your video transcript to create optimized detection prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Transcript status */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Video transcript loaded
                {videoTitle && (
                  <span className="font-normal text-emerald-600 dark:text-emerald-400">
                    {" "}— {videoTitle}
                  </span>
                )}
              </p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                {Math.round((transcript?.length ?? 0) / 5)} words will be
                analyzed to generate tailored prompts.
              </p>
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Target Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem showIndicator key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Custom Instructions (Optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Guide the AI — e.g. &quot;focus on the first 10 minutes&quot; or
              &quot;emphasize controversial takes&quot;
            </p>
            <textarea
              className="mt-1 h-20 w-full resize-y rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ex: Focus on the startup growth advice, skip the personal anecdotes"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing transcript...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Video & Generate Prompts
              </>
            )}
          </Button>

          {/* Generated Prompts Display */}
          {generatedPrompts && (
            <div className="space-y-4 rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 to-purple-50/60 p-5 dark:border-violet-800 dark:from-violet-950/50 dark:to-purple-950/40">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                  Generated Prompts
                </h3>
                <Button
                  onClick={handleApply}
                  size="sm"
                  className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700"
                >
                  Apply All
                </Button>
              </div>

              <div className="space-y-3">
                {(
                  [
                    ["Brief", generatedPrompts.brief],
                    ["Audience", generatedPrompts.audience],
                    ["Tone", generatedPrompts.tone],
                    ["Call to Action", generatedPrompts.callToAction],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      {label}
                    </Label>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {value}
                    </p>
                  </div>
                ))}

                <div className="mt-4 rounded-lg border border-violet-200/60 bg-white/50 p-3 dark:border-violet-800/40 dark:bg-violet-950/30">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Analysis reasoning
                  </Label>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {generatedPrompts.reasoning}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
