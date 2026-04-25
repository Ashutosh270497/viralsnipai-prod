import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { AppCard, EmptyState, PageHeader } from "@/components/product-ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const projects = await listUserProjects(user.id);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Projects"
        description="Each project bundles source video, detected clips, captions, brand settings, and exports."
        icon={FolderKanban}
        actions={
          <>
            <Link
              href="/repurpose"
              className="inline-flex h-10 items-center rounded-full border border-border/70 bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/35"
            >
              Create Clip
            </Link>
            <NewProjectDialog onSuccessRedirect="/repurpose" />
          </>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to upload a long video, detect clips, edit captions, and export short-form assets."
          secondary={{ label: "Set up brand kit", href: "/brand-kit" }}
        >
          <NewProjectDialog triggerLabel="Create project" triggerSize="lg" onSuccessRedirect="/repurpose" />
        </EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      <AppCard className="p-6 text-sm text-muted-foreground">
        Tip: define your{" "}
        <Link
          href="/brand-kit"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          brand kit
        </Link>{" "}
        so every export stays visually consistent.
      </AppCard>
    </div>
  );
}
