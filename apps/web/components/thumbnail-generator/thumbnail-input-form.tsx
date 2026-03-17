"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ThumbnailGeneratorInput } from "@/types/thumbnail";

const thumbnailInputSchema = z.object({
  videoTitle: z.string().min(5, "Video title is required"),
  niche: z.string().min(2, "Niche is required"),
  thumbnailStyle: z.enum(['bold', 'minimal', 'dramatic', 'informative', 'meme']),
  mainSubject: z.enum(['person', 'product', 'text', 'abstract', 'split-screen']),
  colorScheme: z.enum(['vibrant', 'dark', 'bright', 'professional', 'auto']),
  includeText: z.boolean(),
  textOverlay: z.string().max(30).optional(),
  faceExpression: z.enum(['excited', 'shocked', 'serious', 'happy', 'focused']).optional(),
});

type ThumbnailInputFormData = z.infer<typeof thumbnailInputSchema>;

interface ThumbnailInputFormProps {
  onGenerate: (input: ThumbnailGeneratorInput) => void;
  isGenerating: boolean;
  defaultValues?: Partial<ThumbnailGeneratorInput>;
}

export function ThumbnailInputForm({ onGenerate, isGenerating, defaultValues }: ThumbnailInputFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ThumbnailInputFormData>({
    resolver: zodResolver(thumbnailInputSchema),
    defaultValues: {
      videoTitle: defaultValues?.videoTitle || "",
      niche: defaultValues?.niche || "",
      thumbnailStyle: defaultValues?.thumbnailStyle || "bold",
      mainSubject: defaultValues?.mainSubject || "person",
      colorScheme: defaultValues?.colorScheme || "vibrant",
      includeText: defaultValues?.includeText ?? true,
      textOverlay: defaultValues?.textOverlay || "",
      faceExpression: defaultValues?.faceExpression,
    },
  });

  const thumbnailStyle = watch("thumbnailStyle");
  const mainSubject = watch("mainSubject");
  const colorScheme = watch("colorScheme");
  const includeText = watch("includeText");
  const faceExpression = watch("faceExpression");

  const onSubmit = (data: ThumbnailInputFormData) => {
    const input: ThumbnailGeneratorInput = {
      contentIdeaId: defaultValues?.contentIdeaId,
      videoTitle: data.videoTitle,
      niche: data.niche,
      thumbnailStyle: data.thumbnailStyle,
      mainSubject: data.mainSubject,
      colorScheme: data.colorScheme,
      includeText: data.includeText,
      textOverlay: data.textOverlay,
      faceExpression: data.faceExpression,
    };

    onGenerate(input);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Video Title */}
      <div className="space-y-2">
        <Label htmlFor="videoTitle">Video Title *</Label>
        <Textarea
          id="videoTitle"
          placeholder="e.g., How to Grow YouTube Fast in 2026"
          {...register("videoTitle")}
          disabled={isGenerating}
          rows={2}
        />
        {errors.videoTitle && (
          <p className="text-sm text-destructive">{errors.videoTitle.message}</p>
        )}
      </div>

      {/* Niche */}
      <div className="space-y-2">
        <Label htmlFor="niche">Niche *</Label>
        <Input
          id="niche"
          placeholder="e.g., YouTube Growth, Tech Reviews, Cooking"
          {...register("niche")}
          disabled={isGenerating}
        />
        {errors.niche && (
          <p className="text-sm text-destructive">{errors.niche.message}</p>
        )}
      </div>

      {/* Thumbnail Style */}
      <div className="space-y-2">
        <Label htmlFor="thumbnailStyle">Thumbnail Style</Label>
        <Select
          value={thumbnailStyle}
          onValueChange={(value) => setValue("thumbnailStyle", value as any)}
          disabled={isGenerating}
        >
          <SelectTrigger id="thumbnailStyle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bold">Bold (High Contrast, Bright Colors)</SelectItem>
            <SelectItem value="minimal">Minimal (Clean, Simple)</SelectItem>
            <SelectItem value="dramatic">Dramatic (Dark, Cinematic)</SelectItem>
            <SelectItem value="informative">Informative (Educational, Professional)</SelectItem>
            <SelectItem value="meme">Meme (Fun, Relatable)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Subject */}
      <div className="space-y-2">
        <Label htmlFor="mainSubject">Main Subject</Label>
        <Select
          value={mainSubject}
          onValueChange={(value) => setValue("mainSubject", value as any)}
          disabled={isGenerating}
        >
          <SelectTrigger id="mainSubject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="person">Person (Face/Expression)</SelectItem>
            <SelectItem value="product">Product (Item Focus)</SelectItem>
            <SelectItem value="text">Text (Typography Focus)</SelectItem>
            <SelectItem value="abstract">Abstract (Shapes/Patterns)</SelectItem>
            <SelectItem value="split-screen">Split-Screen (Before/After)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label htmlFor="colorScheme">Color Scheme</Label>
        <Select
          value={colorScheme}
          onValueChange={(value) => setValue("colorScheme", value as any)}
          disabled={isGenerating}
        >
          <SelectTrigger id="colorScheme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vibrant">Vibrant (Bright, Saturated)</SelectItem>
            <SelectItem value="dark">Dark (Moody, Mysterious)</SelectItem>
            <SelectItem value="bright">Bright (Light, Cheerful)</SelectItem>
            <SelectItem value="professional">Professional (Corporate, Subdued)</SelectItem>
            <SelectItem value="auto">Auto (AI Chooses)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Include Text Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border dark:border-white/[0.07] bg-muted/20 dark:bg-white/[0.02] p-4">
        <div className="space-y-0.5">
          <Label htmlFor="includeText">Include Text Overlay</Label>
          <p className="text-xs text-muted-foreground">
            Add large, bold text to your thumbnail (Max 3-5 words)
          </p>
        </div>
        <Switch
          id="includeText"
          checked={includeText}
          onCheckedChange={(checked) => setValue("includeText", checked)}
          disabled={isGenerating}
        />
      </div>

      {/* Text Overlay (conditional) */}
      {includeText && (
        <div className="space-y-2">
          <Label htmlFor="textOverlay">Text Overlay</Label>
          <Input
            id="textOverlay"
            placeholder="e.g., 10K SUBS, BEST METHOD, HOW TO"
            {...register("textOverlay")}
            disabled={isGenerating}
            maxLength={30}
          />
          <p className="text-xs text-muted-foreground">
            Keep it short and impactful. ALL CAPS works well for thumbnails.
          </p>
        </div>
      )}

      {/* Face Expression (conditional) */}
      {mainSubject === 'person' && (
        <div className="space-y-2">
          <Label htmlFor="faceExpression">Face Expression</Label>
          <Select
            value={faceExpression || ''}
            onValueChange={(value) => setValue("faceExpression", value as any)}
            disabled={isGenerating}
          >
            <SelectTrigger id="faceExpression">
              <SelectValue placeholder="Choose expression..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excited">Excited</SelectItem>
              <SelectItem value="shocked">Shocked</SelectItem>
              <SelectItem value="serious">Serious</SelectItem>
              <SelectItem value="happy">Happy</SelectItem>
              <SelectItem value="focused">Focused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Info Card */}
      <Card className="border-violet-300 dark:border-primary/20 bg-violet-50 dark:bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">What You&apos;ll Get:</h4>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• 3 AI-generated thumbnail variations (1280x720)</li>
          <li>• CTR prediction score for each thumbnail</li>
          <li>• Mobile readability analysis</li>
          <li>• Improvement suggestions from AI</li>
          <li>• Download in optimized PNG format</li>
        </ul>
      </Card>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-md"
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generating Thumbnails...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate 3 Thumbnail Variations
          </>
        )}
      </Button>
    </form>
  );
}
