"use client";

import { useState } from "react";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
  onPromptsGenerated: (prompts: Omit<GeneratedPrompts, 'reasoning'>) => void;
}

const CONTENT_TYPES = [
  { value: "business", label: "Business / Entrepreneurship" },
  { value: "fitness", label: "Fitness / Health" },
  { value: "education", label: "Education / Tutorial" },
  { value: "entertainment", label: "Entertainment / Comedy" },
  { value: "personal_development", label: "Personal Development" },
  { value: "cooking", label: "Cooking / Food" },
  { value: "technology", label: "Technology / Software" },
  { value: "lifestyle", label: "Lifestyle / Vlog" },
  { value: "other", label: "Other" },
];

const PLATFORMS = [
  { value: "YouTube Shorts", label: "YouTube Shorts" },
  { value: "TikTok", label: "TikTok" },
  { value: "Instagram Reels", label: "Instagram Reels" },
  { value: "All Platforms", label: "All Platforms" },
];

export function AIPromptGeneratorDialog({ onPromptsGenerated }: AIPromptGeneratorDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);

  // Form state
  const [context, setContext] = useState("");
  const [contentType, setContentType] = useState("");
  const [platform, setPlatform] = useState<string>("YouTube Shorts");
  const [customInstructions, setCustomInstructions] = useState("");

  // Generated prompts
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompts | null>(null);

  const handleGenerate = async () => {
    if (!context.trim() && !useTemplate) {
      toast({
        variant: "destructive",
        title: "Context required",
        description: "Please describe your video content or enable quick template mode.",
      });
      return;
    }

    if (useTemplate && !contentType) {
      toast({
        variant: "destructive",
        title: "Content type required",
        description: "Please select a content type for template generation.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/repurpose/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: context || `${contentType} content for ${platform}`,
          contentType,
          platform,
          customInstructions: customInstructions || undefined,
          useTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate prompts");
      }

      const data = await response.json();
      setGeneratedPrompts(data.prompts);

      toast({
        title: "Prompts generated!",
        description: "Review and apply the AI-generated prompts below.",
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
      title: "Prompts applied!",
      description: "The generated prompts have been filled in.",
    });

    // Reset and close
    setGeneratedPrompts(null);
    setContext("");
    setCustomInstructions("");
    setOpen(false);
  };

  const handleReset = () => {
    setGeneratedPrompts(null);
    setContext("");
    setContentType("");
    setCustomInstructions("");
    setUseTemplate(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 dark:border-violet-800 dark:from-violet-950 dark:to-purple-950 dark:text-violet-300 shadow-sm"
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
            Let AI create optimized prompts for detecting viral moments in your video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Template Mode Toggle */}
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-4">
            <input
              type="checkbox"
              id="useTemplate"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <div className="flex-1">
              <Label htmlFor="useTemplate" className="text-sm font-semibold cursor-pointer">
                Quick Template Mode
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use pre-built templates for faster generation (no AI call needed)
              </p>
            </div>
          </div>

          {/* Context Input */}
          {!useTemplate && (
            <div className="space-y-2">
              <Label htmlFor="context" className="text-sm font-semibold">
                Video Context <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Describe your video content, main topics, and what makes it valuable
              </p>
              <textarea
                id="context"
                className="mt-2 h-24 w-full resize-y rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ex: This is a 30-minute podcast interview about AI productivity tools for solopreneurs. We discuss specific workflows, tools like ChatGPT and Notion, and share real transformation stories with metrics."
              />
            </div>
          )}

          {/* Content Type */}
          <div className="space-y-2">
            <Label htmlFor="contentType" className="text-sm font-semibold">
              Content Type {useTemplate && <span className="text-red-500">*</span>}
            </Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform" className="text-sm font-semibold">
              Target Platform
            </Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Instructions */}
          {!useTemplate && (
            <div className="space-y-2">
              <Label htmlFor="customInstructions" className="text-sm font-semibold">
                Custom Instructions (Optional)
              </Label>
              <textarea
                id="customInstructions"
                className="mt-2 h-20 w-full resize-y rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-200"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Ex: Focus on the first 15 minutes only, emphasize specific tool names, avoid technical jargon"
              />
            </div>
          )}

          {/* Generate Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Prompts
                </>
              )}
            </Button>
            {generatedPrompts && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="h-10 rounded-xl"
              >
                Reset
              </Button>
            )}
          </div>

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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Brief
                  </Label>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {generatedPrompts.brief}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Audience
                  </Label>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {generatedPrompts.audience}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Tone
                  </Label>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {generatedPrompts.tone}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Call to Action
                  </Label>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {generatedPrompts.callToAction}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-violet-200/60 bg-white/50 p-3 dark:border-violet-800/40 dark:bg-violet-950/30">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Why these prompts?
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
