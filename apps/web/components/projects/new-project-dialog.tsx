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
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export function NewProjectDialog() {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          topic: topic || undefined,
          sourceUrl: sourceUrl || undefined
        }),
        cache: "no-store",
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      toast({
        title: "Project created",
        description: "Let’s upload your source to start repurposing."
      });

      setOpen(false);
      setTitle("");
      setTopic("");
      setSourceUrl("");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Unable to create project",
        description: "Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all">New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kick off a new project</DialogTitle>
          <DialogDescription>
            Name your series or campaign. We’ll keep hooks, assets, clips, and exports organized.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Project title</Label>
            <Input
              id="title"
              placeholder="Product launch Q3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic" optional>
              Topic or theme
            </Label>
            <Input
              id="topic"
              placeholder="AI for go-to-market teams"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceUrl" optional>
              Source URL
            </Label>
            <Textarea
              id="sourceUrl"
              placeholder="https://youtube.com/watch?v=..."
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="h-11 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all">
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
