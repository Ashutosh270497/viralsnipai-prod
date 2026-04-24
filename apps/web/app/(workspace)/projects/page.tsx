import Link from "next/link";

import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const projects = await listUserProjects(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Each project bundles a source video, clips, and exports together.
          </p>
        </div>
        <NewProjectDialog onSuccessRedirect="/repurpose" />
      </div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 px-6 py-16 text-center dark:from-slate-900/20 dark:to-slate-800/10">
          <div className="rounded-full bg-gradient-to-br from-emerald-500/10 via-emerald-500/10 to-teal-500/10 p-6">
            <svg
              className="h-12 w-12 text-muted-foreground/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Upload your first long video and turn it into viral-ready clips.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      <div className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-6 text-sm text-muted-foreground dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-teal-950/20">
        Tip: define your{" "}
        <Link
          href="/brand-kit"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          brand kit
        </Link>{" "}
        so every export stays visually consistent.
      </div>
    </div>
  );
}
