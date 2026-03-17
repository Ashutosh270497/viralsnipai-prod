"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2, Plus, X, ChevronDown, ChevronUp, Lightbulb, Copy } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TitleGeneratorInput } from "@/types/title";
import { toast } from "sonner";

const titleInputSchema = z.object({
  videoTopic: z.string().min(3, "Tell us what your video is about"),
  keywords: z.string().min(1, "Add at least one keyword"),
  targetAudience: z.string().optional(),
  titleStyle: z.enum(['how-to', 'listicle', 'curiosity', 'question', 'authority', 'mixed']),
  maxLength: z.enum(['60', '70', '80']),
});

type TitleInputFormData = z.infer<typeof titleInputSchema>;

interface TitleInputFormProps {
  onGenerate: (input: TitleGeneratorInput) => void;
  isGenerating: boolean;
  defaultValues?: Partial<TitleGeneratorInput>;
}

// Example topics for quick start
const EXAMPLES = [
  {
    topic: "How AI is changing video editing for content creators",
    keywords: ["AI video editing", "content creation", "automation"],
    audience: "YouTube creators"
  },
  {
    topic: "5 mistakes beginners make when starting a podcast",
    keywords: ["podcast tips", "podcasting mistakes", "beginners guide"],
    audience: "aspiring podcasters"
  },
  {
    topic: "The psychology behind viral TikTok videos",
    keywords: ["viral content", "TikTok algorithm", "social media growth"],
    audience: "TikTok creators"
  }
];

export function TitleInputFormV2({ onGenerate, isGenerating, defaultValues }: TitleInputFormProps) {
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(defaultValues?.keywords || []);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TitleInputFormData>({
    resolver: zodResolver(titleInputSchema),
    defaultValues: {
      videoTopic: defaultValues?.videoTopic || "",
      keywords: keywords.join(", "),
      targetAudience: defaultValues?.targetAudience || "YouTube viewers",
      titleStyle: defaultValues?.titleStyle || "mixed",
      maxLength: (defaultValues?.maxLength?.toString() as '60' | '70' | '80') || '70',
    },
  });

  const videoTopic = watch("videoTopic");
  const titleStyle = watch("titleStyle");
  const maxLength = watch("maxLength");

  const handleAddKeyword = () => {
    if (keywordInput.trim() && keywords.length < 10) {
      const newKeywords = [...keywords, keywordInput.trim()];
      setKeywords(newKeywords);
      setValue("keywords", newKeywords.join(", "));
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const newKeywords = keywords.filter((_, i) => i !== index);
    setKeywords(newKeywords);
    setValue("keywords", newKeywords.join(", "));
  };

  const loadExample = (example: typeof EXAMPLES[0]) => {
    setValue("videoTopic", example.topic);
    setKeywords(example.keywords);
    setValue("keywords", example.keywords.join(", "));
    setValue("targetAudience", example.audience);
    toast.success("Example loaded! Click Generate to see titles.");
  };

  const onSubmit = (data: TitleInputFormData) => {
    if (keywords.length === 0) {
      toast.error("Add at least one keyword to continue");
      return;
    }

    const input: TitleGeneratorInput = {
      videoTopic: data.videoTopic,
      keywords,
      targetAudience: data.targetAudience || "YouTube viewers",
      titleStyle: data.titleStyle,
      maxLength: parseInt(data.maxLength) as 60 | 70 | 80,
    };

    onGenerate(input);
  };

  return (
    <div className="space-y-6">
      {/* Quick Examples */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/20 dark:bg-blue-950/20 p-4">
        <div className="mb-3 flex items-start gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              New here? Try an example!
            </h4>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example, i) => (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadExample(example)}
                  disabled={isGenerating}
                  className="text-xs"
                >
                  Example {i + 1}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Video Topic - Simplified */}
        <div className="space-y-2">
          <Label htmlFor="videoTopic" className="text-base flex items-center gap-1">
            What&apos;s your video about?
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="videoTopic"
            placeholder="Example: How to edit YouTube videos 10x faster with AI tools"
            {...register("videoTopic")}
            disabled={isGenerating}
            rows={3}
            className="text-base resize-none"
          />
          {errors.videoTopic && (
            <p className="text-sm text-destructive flex items-center gap-1">
              {errors.videoTopic.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            💡 Be specific - the more details, the better the titles!
          </p>
        </div>

        {/* Keywords - Improved UX */}
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-1">
            Main keywords
            <span className="text-destructive">*</span>
            <span className="text-xs text-muted-foreground font-normal">(Add 2-5 keywords)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Type a keyword and press Enter"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              disabled={isGenerating || keywords.length >= 10}
              className="text-base"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddKeyword}
              disabled={!keywordInput.trim() || keywords.length >= 10 || isGenerating}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
              {keywords.map((keyword, index) => (
                <Badge
                  key={index}
                  variant={index === 0 ? "default" : "secondary"}
                  className="gap-1 py-1 px-3 text-sm"
                >
                  {index === 0 && <span className="text-xs">Primary:</span>}
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(index)}
                    disabled={isGenerating}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {keywords.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Example: &quot;YouTube growth&quot;, &quot;content strategy&quot;, &quot;video marketing&quot;
            </p>
          )}
          {keywords.length > 0 && (
            <p className="text-xs text-muted-foreground">
              ✓ First keyword is your primary keyword (used most prominently)
            </p>
          )}
        </div>

        {/* Advanced Options - Collapsible */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="text-sm font-medium">Advanced Options (Optional)</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showAdvanced && (
            <Card className="p-4 space-y-4 bg-muted/30 dark:bg-muted/20 border-border dark:border-white/[0.07]">
              {/* Target Audience */}
              <div className="space-y-2">
                <Label htmlFor="targetAudience" className="text-sm">
                  Target Audience
                </Label>
                <Input
                  id="targetAudience"
                  placeholder="e.g., aspiring YouTubers, small business owners"
                  {...register("targetAudience")}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Who is this video for? (Default: YouTube viewers)
                </p>
              </div>

              {/* Title Style */}
              <div className="space-y-2">
                <Label htmlFor="titleStyle" className="text-sm">
                  Title Style Preference
                </Label>
                <Select
                  value={titleStyle}
                  onValueChange={(value) => setValue("titleStyle", value as any)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="titleStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (Recommended)</SelectItem>
                    <SelectItem value="how-to">How-To</SelectItem>
                    <SelectItem value="listicle">Listicle</SelectItem>
                    <SelectItem value="curiosity">Curiosity</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="authority">Authority</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Length */}
              <div className="space-y-2">
                <Label htmlFor="maxLength" className="text-sm">
                  Maximum Length
                </Label>
                <Select
                  value={maxLength}
                  onValueChange={(value) => setValue("maxLength", value as any)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="maxLength">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 chars (Mobile)</SelectItem>
                    <SelectItem value="70">70 chars (Recommended)</SelectItem>
                    <SelectItem value="80">80 chars (Maximum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          )}
        </div>

        {/* Submit Button - Prominent */}
        <Button
          type="submit"
          size="lg"
          className="w-full text-base h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-md"
          disabled={isGenerating || keywords.length === 0}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating Your Titles...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate 5 Titles
            </>
          )}
        </Button>

        {/* What You'll Get */}
        {!isGenerating && (
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll get 5 unique, AI-optimized titles ranked by clickthrough potential
          </p>
        )}
      </form>
    </div>
  );
}
