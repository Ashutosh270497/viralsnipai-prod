"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Film, MoreVertical, PenLine, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppCard, StatusBadge } from "@/components/product-ui/primitives";
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
      <AppCard className="h-full p-5" interactive>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit rounded-full px-2 py-0.5 text-[10px]">
                {project.topic ?? "No topic yet"}
              </Badge>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">{project.title}</h3>
              <p className="text-sm text-muted-foreground">
                Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
              </p>
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
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3">
            <div className="space-y-1 text-sm">
              <Film className="h-4 w-4 text-primary" />
              <span>{project.assets.length} asset(s)</span>
            </div>
            <div className="space-y-1 text-sm">
              <PenLine className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <span>{project.clips.length} clip(s)</span>
            </div>
            <div className="space-y-1 text-sm">
              <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <span>{exportDone} export(s)</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            {project.exports[0]?.status ? <StatusBadge status={project.exports[0].status} /> : <span />}
            <div className="flex items-center justify-end text-xs font-semibold text-primary">
          View timeline
          <ArrowUpRight className="ml-2 h-4 w-4" />
            </div>
          </div>
      </AppCard>
    </Link>
  );
}
