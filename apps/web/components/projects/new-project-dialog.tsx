"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  CONTENT_GOAL_OPTIONS,
  TARGET_PLATFORM_OPTIONS,
} from "@/lib/onboarding-options";
import type { ContentGoal, TargetPlatform } from "@/lib/validations";

interface NewProjectDialogProps {
  triggerLabel?: string;
  triggerSize?: "sm" | "lg";
  onSuccessRedirect?: string;
}

export function NewProjectDialog({
  triggerLabel = "New project",
  triggerSize = "lg",
  onSuccessRedirect,
}: NewProjectDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform | "">("");
  const [contentGoal, setContentGoal] = useState<ContentGoal | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setTitle("");
    setSourceUrl("");
    setTargetPlatform("");
    setContentGoal("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceUrl: sourceUrl.trim() || undefined,
          targetPlatform: targetPlatform || undefined,
          contentGoal: contentGoal || undefined,
        }),
        cache: "no-store",
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const data = await response.json();
      const projectId = data?.project?.id;

      toast({
        title: "Project created",
        description: "Upload your source to start generating clips.",
      });

      setOpen(false);
      resetForm();

      if (onSuccessRedirect && projectId) {
        router.push(`${onSuccessRedirect}?projectId=${projectId}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Couldn't create project",
        description: "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const triggerClass =
    triggerSize === "sm"
      ? "h-9 rounded-lg px-3 text-xs font-semibold"
      : "h-11 rounded-xl px-4 text-sm font-semibold";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          className={`${triggerClass} bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 text-white shadow-md transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg`}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new clip project</DialogTitle>
          <DialogDescription>
            Best for podcasts, webinars, tutorials, interviews, and long-form videos.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Project title</Label>
            <Input
              id="title"
              placeholder="Founder podcast — episode 12"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl" optional>
              Source URL
            </Label>
            <Input
              id="sourceUrl"
              placeholder="https://youtube.com/watch?v=..."
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              type="url"
            />
            <p className="text-xs text-muted-foreground/70">
              Paste a YouTube URL — or skip and upload a file after creating the project.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetPlatform" optional>
                Target platform
              </Label>
              <Select
                value={targetPlatform || undefined}
                onValueChange={(value) => setTargetPlatform(value as TargetPlatform)}
              >
                <SelectTrigger id="targetPlatform">
                  <SelectValue placeholder="Choose a platform" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_PLATFORM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentGoal" optional>
                Content goal
              </Label>
              <Select
                value={contentGoal || undefined}
                onValueChange={(value) => setContentGoal(value as ContentGoal)}
              >
                <SelectTrigger id="contentGoal">
                  <SelectValue placeholder="Pick a focus" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_GOAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-md transition-all hover:from-emerald-600 hover:to-teal-600"
            >
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
