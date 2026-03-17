"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const generateCalendarSchema = z.object({
  niche: z.string().min(3, "Niche must be at least 3 characters"),
  durationDays: z.number().int().min(7).max(30),
  userSkillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

type GenerateCalendarFormData = z.infer<typeof generateCalendarSchema>;

interface GenerateCalendarFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNiche?: string;
}

export function GenerateCalendarForm({ open, onOpenChange, defaultNiche }: GenerateCalendarFormProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<GenerateCalendarFormData>({
    resolver: zodResolver(generateCalendarSchema),
    defaultValues: {
      niche: defaultNiche || "",
      durationDays: 30,
      userSkillLevel: "intermediate",
    },
  });

  const durationDays = watch("durationDays");
  const userSkillLevel = watch("userSkillLevel");

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateCalendarFormData) => {
      const res = await fetch("/api/content-calendar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: data.niche,
          startDate: new Date().toISOString(),
          durationDays: data.durationDays,
          userSkillLevel: data.userSkillLevel,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate calendar");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["content-calendars"] });
      toast({
        title: "Calendar Generated!",
        description: `Successfully created ${data.ideas?.length || 0} video ideas for your content calendar.`,
      });
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const onSubmit = async (data: GenerateCalendarFormData) => {
    setIsGenerating(true);
    generateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Content Calendar
          </DialogTitle>
          <DialogDescription>
            Create an AI-powered content calendar with strategic video ideas tailored to your niche.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Niche Input */}
          <div className="space-y-2">
            <Label htmlFor="niche">Your Niche *</Label>
            <Input
              id="niche"
              placeholder="e.g., AI Tutorials, Fitness, Gaming, Cooking"
              {...register("niche")}
              disabled={isGenerating}
            />
            {errors.niche && (
              <p className="text-sm text-destructive">{errors.niche.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The specific topic or category for your YouTube channel
            </p>
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label htmlFor="duration">Calendar Duration *</Label>
            <Select
              value={String(durationDays)}
              onValueChange={(value) => setValue("durationDays", Number(value))}
              disabled={isGenerating}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days (1 Week)</SelectItem>
                <SelectItem value="14">14 Days (2 Weeks)</SelectItem>
                <SelectItem value="30">30 Days (1 Month)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How many days of content ideas to generate
            </p>
          </div>

          {/* Skill Level */}
          <div className="space-y-2">
            <Label htmlFor="skillLevel">Your Skill Level</Label>
            <Select
              value={userSkillLevel}
              onValueChange={(value) => setValue("userSkillLevel", value as "beginner" | "intermediate" | "advanced")}
              disabled={isGenerating}
            >
              <SelectTrigger id="skillLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner - Just starting out</SelectItem>
                <SelectItem value="intermediate">Intermediate - Have some experience</SelectItem>
                <SelectItem value="advanced">Advanced - Experienced creator</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Helps tailor video complexity to your experience level
            </p>
          </div>

          {/* Generation Info */}
          <div className="rounded-lg border border-border dark:border-white/[0.07] bg-muted/50 dark:bg-secondary/20 p-4">
            <h4 className="mb-2 text-sm font-semibold">What You&apos;ll Get:</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• {durationDays} strategic video ideas</li>
              <li>• 30% trending + 50% evergreen + 20% experimental mix</li>
              <li>• Virality scores and view estimates</li>
              <li>• Hook suggestions and thumbnail concepts</li>
              <li>• SEO-optimized keywords for each idea</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Calendar
                </>
              )}
            </Button>
          </div>

          {isGenerating && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
              <p className="text-sm text-muted-foreground">
                AI is analyzing your niche and generating strategic video ideas...
                <br />
                <span className="text-xs">This may take 30-60 seconds</span>
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
