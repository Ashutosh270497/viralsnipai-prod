"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Film, MoreVertical, PenLine, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppCard, StatusBadge } from "@/components/product-ui/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const blockCardOpenRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportDone = project.exports.filter((exp) => exp.status === "done").length;

  async function readDeleteError(response: Response) {
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      return body.message ?? body.error ?? "Failed to delete project";
    } catch {
      return "Failed to delete project";
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await readDeleteError(response));
      }

      setIsDeleted(true);
      setConfirmOpen(false);
      toast({
        title: "Project deleted",
        description: `"${project.title}" and its related content were removed.`
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Unable to delete project",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function blockCardOpen() {
    blockCardOpenRef.current = true;
    window.setTimeout(() => {
      blockCardOpenRef.current = false;
    }, 0);
  }

  function openProject() {
    if (!isDeleting && !blockCardOpenRef.current && !confirmOpen) {
      router.push(`/projects/${project.id}`);
    }
  }

  function handleKeyboardOpen(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject();
    }
  }

  if (isDeleted) {
    return null;
  }

  return (
    <>
      <AppCard
        className="h-full p-5"
        interactive
        role="link"
        tabIndex={0}
        onClick={openProject}
        onKeyDown={handleKeyboardOpen}
        aria-label={`Open project ${project.title}`}
      >
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
                onPointerDown={(event) => {
                  event.stopPropagation();
                  blockCardOpen();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  blockCardOpen();
                }}
                disabled={isDeleting}
                aria-label="Project actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-50"
              onPointerDown={(event) => {
                event.stopPropagation();
                blockCardOpen();
              }}
              onClick={(event) => {
                event.stopPropagation();
                blockCardOpen();
              }}
            >
              <DropdownMenuItem
                onPointerDown={(event) => {
                  event.stopPropagation();
                  blockCardOpen();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  blockCardOpen();
                  setConfirmOpen(true);
                }}
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  blockCardOpen();
                  setConfirmOpen(true);
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          onPointerDown={(event) => {
            event.stopPropagation();
            blockCardOpen();
          }}
          onClick={(event) => {
            event.stopPropagation();
            blockCardOpen();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{project.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and its assets, clips, and exports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
