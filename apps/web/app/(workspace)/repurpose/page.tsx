export const dynamic = "force-dynamic";
export const revalidate = 0;

import { RepurposeWorkspace } from "@/components/repurpose/repurpose-workspace";
import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";

export default async function RepurposePage({
  searchParams
}: {
  searchParams?: { projectId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const projects = await listUserProjects(user.id);
  const initialProjectId = searchParams?.projectId;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">RepurposeOS</h1>
        <p className="text-muted-foreground">
          Upload a long-form asset, slice highlights, burn captions, and export for every channel.
        </p>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          Create a project to start repurposing video content.
        </div>
      ) : (
        <RepurposeWorkspace
          projects={projects.map((project) => ({ id: project.id, title: project.title }))}
          initialProjectId={initialProjectId}
        />
      )}
    </div>
  );
}
