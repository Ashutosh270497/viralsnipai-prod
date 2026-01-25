import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isUiV2Enabled } from "@/lib/feature-flags";
import { ProjectDashboardV2 } from "@/components/projects-v2/project-dashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const projects = await listUserProjects(user.id);
  const stats = {
    clips: projects.reduce((acc, project) => acc + project.clips.length, 0),
    exports: projects.reduce(
      (acc, project) => acc + project.exports.filter((exp) => exp.status === "done").length,
      0
    )
  };

  const uiV2 = isUiV2Enabled();

  if (uiV2) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {user.name ?? "Creator"}.</h1>
            <p className="text-muted-foreground">
              Keep your pipeline moving. Start with Hooksmith, drop a long-form video, and ship fresh clips.
            </p>
          </div>
          <NewProjectDialog />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Active projects" value={projects.length} />
          <MetricCard label="Clips ready" value={stats.clips} />
          <MetricCard label="Exports delivered" value={stats.exports} />
        </div>
        <ProjectDashboardV2 projects={projects} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {user.name ?? "Creator"}.</h1>
          <p className="text-muted-foreground">
            Keep your pipeline moving. Start with Hooksmith, drop a long-form video, and ship fresh clips.
          </p>
        </div>
        <NewProjectDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Active projects</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{projects.length}</span>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Clips ready</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{stats.clips}</span>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Exports delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{stats.exports}</span>
          </CardContent>
        </Card>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </Suspense>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-3xl font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{value}</span>
      </CardContent>
    </Card>
  );
}
