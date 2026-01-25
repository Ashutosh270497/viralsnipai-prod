"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  Filter,
  ListFilter,
  MoreVertical,
  PlaySquare,
  Search,
  Share2,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type ProjectForDashboard = {
  id: string;
  title: string;
  topic?: string | null;
  updatedAt: Date;
  assets: Array<{ id: string; type?: string | null }>;
  clips: Array<{ id: string; previewPath?: string | null }>;
  exports: Array<{ id: string; status: string }>;
};

type DashboardView = "grid" | "list";

export function ProjectDashboardV2({ projects }: { projects: ProjectForDashboard[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<DashboardView>("grid");
  const router = useRouter();
  const { toast } = useToast();

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => `${project.title} ${project.topic ?? ""}`.toLowerCase().includes(query));
  }, [projects, searchQuery]);

  async function handleDelete(projectId: string, projectTitle: string) {
    const confirmed = window.confirm(`Delete "${projectTitle}"? All assets, clips, and exports will be removed.`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Failed to delete project");
      }
      toast({ title: "Project deleted", description: `${projectTitle} and associated clips were removed.` });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Unable to delete project", description: "Please try again." });
    }
  }

  return (
    <div className="space-y-6" data-testid="projects-dashboard-v2">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-1 items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects, topics, or platforms"
            className="border-none bg-transparent text-sm outline-none focus-visible:ring-0"
          />
          <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground" type="button">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Filters
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            className={view === "grid" ? "h-9 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-sm" : "h-9 text-xs rounded-xl border-border/50 hover:border-border"}
          >
            <PlaySquare className="mr-1.5 h-4 w-4" aria-hidden /> Grid
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={view === "list" ? "h-9 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-sm" : "h-9 text-xs rounded-xl border-border/50 hover:border-border"}
          >
            <ListFilter className="mr-1.5 h-4 w-4" aria-hidden /> List
          </Button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectTile key={project.id} project={project} onDelete={handleDelete} />
          ))}
          {filteredProjects.length === 0 ? <EmptyState /> : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/50 backdrop-blur-sm shadow-sm">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last edited</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="transition hover:bg-secondary/40">
                  <td className="px-4 py-4">
                    <Link href={`/projects/${project.id}`} className="flex flex-col">
                      <span className="font-medium text-foreground">{project.title}</span>
                      <span className="text-xs text-muted-foreground">{project.topic ?? "No topic yet"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <StatusChips project={project} />
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ProjectActions
                      project={project}
                      onDelete={(projectId) => handleDelete(projectId, project.title)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProjects.length === 0 ? <EmptyState className="py-12" /> : null}
        </div>
      )}
    </div>
  );
}

function ProjectTile({ project, onDelete }: { project: ProjectForDashboard; onDelete: (id: string, title: string) => void }) {
  const router = useRouter();
  const exportDone = project.exports.filter((exp) => exp.status === "done").length;
  const thumbnailClip = project.clips.find((clip) => clip.previewPath);
  const assetCount = project.assets.length;

  return (
    <Card className="h-full overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/projects/${project.id}`} className="block">
        <CardHeader className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-violet-500/15 via-purple-500/15 to-fuchsia-500/10">
            {thumbnailClip?.previewPath ? (
              <Image
                src={thumbnailClip.previewPath}
                alt="Project preview"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview yet</div>
            )}
            <Badge variant="secondary" className="absolute left-3 top-3 text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm bg-background/90 shadow-sm">
              {project.topic ?? "No topic"}
            </Badge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">{project.title}</CardTitle>
              <CardDescription>
                Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
              </CardDescription>
            </div>
            <ProjectActions
              project={project}
              onDelete={() => onDelete(project.id, project.title)}
              onNavigate={() => router.push(`/projects/${project.id}`)}
            />
          </div>
        </CardHeader>
      </Link>
      <CardContent className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <StatusChip icon={<CalendarClock className="h-4 w-4" aria-hidden />} label={`${assetCount} asset(s)`} />
        <StatusChip icon={<PlaySquare className="h-4 w-4" aria-hidden />} label={`${project.clips.length} clip(s)`} />
        <StatusChip icon={<Share2 className="h-4 w-4" aria-hidden />} label={`${exportDone} export(s)`} />
      </CardContent>
    </Card>
  );
}

function ProjectActions({
  project,
  onDelete,
  onNavigate
}: {
  project: ProjectForDashboard;
  onDelete: (projectId: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={(event) => event.preventDefault()}
          aria-label="Project actions"
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50">
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>Share preview</DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(event) => {
            event.preventDefault();
            onDelete(project.id);
          }}
        >
          Delete
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onNavigate?.();
          }}
        >
          Open project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusChip({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm px-2.5 py-1 text-[11px]">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function StatusChips({ project }: { project: ProjectForDashboard }) {
  const exportDone = project.exports.filter((exp) => exp.status === "done").length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <StatusChip icon={<PlaySquare className="h-4 w-4 text-violet-600" aria-hidden />} label={`${project.clips.length} clips`} />
      <StatusChip icon={<Share2 className="h-4 w-4 text-fuchsia-500" aria-hidden />} label={`${exportDone} exports`} />
    </div>
  );
}

function EmptyState({ className }: { className?: string }) {
  return (
    <div className={cn("col-span-full flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 px-6 py-16 text-center text-sm", className)}>
      <div className="rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-6">
        <PlaySquare className="h-12 w-12 text-muted-foreground/70" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-foreground">No projects match your filters</p>
        <p className="text-muted-foreground">Clear filters or create a new project to get started.</p>
      </div>
      <Button asChild size="sm" className="h-9 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-sm">
        <Link href="/projects#new">New project</Link>
      </Button>
    </div>
  );
}
