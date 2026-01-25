"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Film, MoreVertical, PenLine, Share2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    topic?: string | null;
    updatedAt: Date;
    clips: Array<{ id: string }>;
    exports: Array<{ id: string; status: string }>;
    assets: Array<{ id: string }>;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const exportDone = project.exports.filter((exp) => exp.status === "done").length;

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${project.title}"?\n\nAll assets, clips, and exports in this project will be removed.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast({
        title: "Project deleted",
        description: `"${project.title}" and its related content were removed.`
      });

      router.push("/projects");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Unable to delete project",
        description: "Please try again."
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl transition hover:border-violet-500 hover:shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit text-[10px] px-2 py-0.5 rounded-full">
                {project.topic ?? "No topic yet"}
              </Badge>
              <CardTitle className="text-xl">{project.title}</CardTitle>
              <CardDescription>
                Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  disabled={isDeleting}
                  aria-label="Project actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete();
                  }}
                  className="text-destructive focus:text-destructive"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete project"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between rounded-lg border border-dashed border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:from-violet-950/30 dark:to-purple-950/20 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <Film className="h-4 w-4 text-violet-600" />
              <span>{project.assets.length} asset(s)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <PenLine className="h-4 w-4 text-purple-600" />
              <span>{project.clips.length} clip(s)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Share2 className="h-4 w-4 text-fuchsia-500" />
              <span>{exportDone} export(s)</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-end text-xs font-medium text-muted-foreground">
          View timeline
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </CardFooter>
      </Card>
    </Link>
  );
}
