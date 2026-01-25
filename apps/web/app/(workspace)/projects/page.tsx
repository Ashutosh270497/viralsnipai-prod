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
          <p className="text-muted-foreground">All of your Hooksmith scripts, assets, clips, and exports.</p>
        </div>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 px-6 py-16 text-center">
          <div className="rounded-full bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-6">
            <svg className="h-12 w-12 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground">Create your first project to start organizing your content.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      <div className="rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:from-violet-950/30 dark:to-purple-950/20 p-6 text-sm text-muted-foreground">
        Need more structure? <Link href="/brand-kit" className="text-violet-600 dark:text-violet-400 hover:underline font-medium">Define your brand kit</Link> so exports stay consistent.
      </div>
    </div>
  );
}
