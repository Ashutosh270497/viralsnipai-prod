"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScriptStyle, ScriptTone, SCRIPT_TEMPLATES } from "@/lib/types/script";
import { cn } from "@/lib/utils";

const scriptFormSchema = z.object({
  videoTitle: z.string().min(5, "Title must be at least 5 characters"),
  videoDescription: z.string().optional(),
  targetDuration: z.number().min(0.5).max(60),
  scriptStyle: z.enum(['educational', 'entertaining', 'storytelling', 'review', 'tutorial']),
  tone: z.enum(['casual', 'professional', 'energetic', 'calm']),
  includeHook: z.boolean(),
  includeCTA: z.boolean(),
  keywords: z.string().optional(),
  additionalContext: z.string().optional(),
  niche: z.string().optional(),
});

type ScriptFormData = z.infer<typeof scriptFormSchema>;

interface ScriptInputFormProps {
  contentIdeaId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialKeywords?: string[];
  onGenerate: (data: any) => Promise<void>;
  isGenerating: boolean;
  onUseTemplate?: (template: keyof typeof SCRIPT_TEMPLATES) => void;
}

export function ScriptInputForm({
  contentIdeaId,
  initialTitle = "",
  initialDescription = "",
  initialKeywords = [],
  onGenerate,
  isGenerating,
  onUseTemplate,
}: ScriptInputFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof SCRIPT_TEMPLATES | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ScriptFormData>({
    resolver: zodResolver(scriptFormSchema),
    defaultValues: {
      videoTitle: initialTitle,
      videoDescription: initialDescription,
      targetDuration: 5,
      scriptStyle: 'educational',
      tone: 'casual',
      includeHook: true,
      includeCTA: true,
      keywords: initialKeywords.join(", "),
      additionalContext: "",
      niche: "",
    },
  });

  const targetDuration = watch("targetDuration");
  const scriptStyle = watch("scriptStyle");
  const tone = watch("tone");
  const includeHook = watch("includeHook");
  const includeCTA = watch("includeCTA");

  const estimatedWords = Math.floor(targetDuration * 150);

  const onSubmit = async (data: ScriptFormData) => {
    const keywords = data.keywords
      ? data.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    await onGenerate({
      contentIdeaId,
      videoTitle: data.videoTitle,
      videoDescription: data.videoDescription || "",
      targetDuration: data.targetDuration,
      scriptStyle: data.scriptStyle,
      tone: data.tone,
      includeHook: data.includeHook,
      includeCTA: data.includeCTA,
      keywords,
      additionalContext: data.additionalContext || "",
      niche: data.niche || "",
    });
  };

  const handleTemplateSelect = (template: keyof typeof SCRIPT_TEMPLATES) => {
    setSelectedTemplate(template);
    onUseTemplate?.(template);

    // Adjust form based on template
    if (template === 'how-to') {
      setValue('scriptStyle', 'tutorial');
      setValue('tone', 'professional');
    } else if (template === 'review') {
      setValue('scriptStyle', 'review');
      setValue('tone', 'casual');
    } else if (template === 'storytelling') {
      setValue('scriptStyle', 'storytelling');
      setValue('tone', 'energetic');
    } else if (template === 'educational') {
      setValue('scriptStyle', 'educational');
      setValue('tone', 'professional');
    } else if (template === 'top-10') {
      setValue('scriptStyle', 'entertaining');
      setValue('tone', 'energetic');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Selection */}
      <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/40 dark:from-white/[0.02] to-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <h3 className="font-semibold">Choose a Template (Optional)</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
            <Button
              key={key}
              type="button"
              variant={selectedTemplate === key ? "default" : "outline"}
              className={cn(
                "h-auto min-h-[80px] flex-col items-start justify-start gap-2 p-4 text-left whitespace-normal transition-all",
                selectedTemplate === key
                  ? "border-violet-400 dark:border-violet-500/30 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-400/30 dark:ring-violet-500/20"
                  : ""
              )}
              onClick={() => handleTemplateSelect(key as keyof typeof SCRIPT_TEMPLATES)}
            >
              <div className="font-semibold text-sm leading-tight">{template.name}</div>
              <div className="text-xs opacity-70 leading-relaxed">{template.structure}</div>
            </Button>
          ))}
        </div>
      </Card>

      {/* Video Title */}
      <div className="space-y-2">
        <Label htmlFor="videoTitle">Video Title *</Label>
        <Input
          id="videoTitle"
          placeholder="e.g., How to Master JavaScript in 30 Days"
          {...register("videoTitle")}
          disabled={isGenerating}
        />
        {errors.videoTitle && (
          <p className="text-sm text-destructive">{errors.videoTitle.message}</p>
        )}
      </div>

      {/* Video Description */}
      <div className="space-y-2">
        <Label htmlFor="videoDescription">Video Description (Optional)</Label>
        <Textarea
          id="videoDescription"
          placeholder="Brief description of what the video will cover..."
          rows={3}
          {...register("videoDescription")}
          disabled={isGenerating}
        />
      </div>

      {/* Duration & Style Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Target Duration */}
        <div className="space-y-2">
          <Label htmlFor="targetDuration">Target Duration *</Label>
          <Select
            value={String(targetDuration)}
            onValueChange={(value) => setValue("targetDuration", Number(value))}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">30 seconds</SelectItem>
              <SelectItem value="1">1 minute</SelectItem>
              <SelectItem value="3">3 minutes</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="8">8 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="20">20 minutes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            ~{estimatedWords} words
          </p>
        </div>

        {/* Script Style */}
        <div className="space-y-2">
          <Label htmlFor="scriptStyle">Script Style *</Label>
          <Select
            value={scriptStyle}
            onValueChange={(value) => setValue("scriptStyle", value as ScriptStyle)}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="educational">Educational</SelectItem>
              <SelectItem value="entertaining">Entertaining</SelectItem>
              <SelectItem value="storytelling">Storytelling</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="tutorial">Tutorial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label htmlFor="tone">Tone *</Label>
        <Select
          value={tone}
          onValueChange={(value) => setValue("tone", value as ScriptTone)}
          disabled={isGenerating}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="casual">Casual & Friendly</SelectItem>
            <SelectItem value="professional">Professional & Authoritative</SelectItem>
            <SelectItem value="energetic">Energetic & Enthusiastic</SelectItem>
            <SelectItem value="calm">Calm & Soothing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Keywords */}
      <div className="space-y-2">
        <Label htmlFor="keywords">SEO Keywords (Optional)</Label>
        <Input
          id="keywords"
          placeholder="javascript, coding, tutorial (comma-separated)"
          {...register("keywords")}
          disabled={isGenerating}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated keywords for SEO optimization
        </p>
      </div>

      {/* Niche */}
      <div className="space-y-2">
        <Label htmlFor="niche">Niche (Optional)</Label>
        <Input
          id="niche"
          placeholder="e.g., Tech, Fitness, Cooking"
          {...register("niche")}
          disabled={isGenerating}
        />
      </div>

      {/* Additional Context */}
      <div className="space-y-2">
        <Label htmlFor="additionalContext">Additional Context (Optional)</Label>
        <Textarea
          id="additionalContext"
          placeholder="Any specific points you want to cover, examples to include, or style preferences..."
          rows={3}
          {...register("additionalContext")}
          disabled={isGenerating}
        />
      </div>

      {/* Options */}
      <div className="space-y-3">
        <Label>Script Options</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeHook}
              onChange={(e) => setValue("includeHook", e.target.checked)}
              disabled={isGenerating}
              className="h-4 w-4"
            />
            <span className="text-sm">Include Hook (First 15 seconds)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeCTA}
              onChange={(e) => setValue("includeCTA", e.target.checked)}
              disabled={isGenerating}
              className="h-4 w-4"
            />
            <span className="text-sm">Include Call-to-Action (CTA)</span>
          </label>
        </div>
      </div>

      {/* Generation Info */}
      <Card className="border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">What You&apos;ll Get:</h4>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>Structured script with {includeHook && 'hook, '}intro, main content, conclusion{includeCTA && ', and CTA'}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>Visual cues for better production ([SHOW], [B-ROLL], [GRAPHICS])</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>Retention optimization tips</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>Timestamp markers for each section</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>SEO keyword integration</span>
          </li>
        </ul>
      </Card>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generating Script...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate Script
          </>
        )}
      </Button>

      {isGenerating && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                AI is crafting your script...
              </p>
              <p className="text-xs text-muted-foreground">
                Optimizing for retention • This may take 30-60 seconds
              </p>
            </div>
          </div>
        </Card>
      )}
    </form>
  );
}
