import { HooksmithWorkspace } from "@/components/hooksmith/hooksmith-workspace";
import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";

export default async function HooksmithPage({
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
        <h1 className="text-3xl font-semibold tracking-tight">Hooksmith</h1>
        <p className="text-muted-foreground">Spin up hooks and scripts your audience will actually watch.</p>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          Create a project first to keep scripts organized.
        </div>
      ) : (
        <HooksmithWorkspace
          projects={projects.map((project) => ({
            id: project.id,
            title: project.title
          }))}
          initialProjectId={initialProjectId}
        />
      )}
    </div>
  );
}
