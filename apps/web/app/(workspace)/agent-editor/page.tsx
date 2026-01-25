import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";
import { AgentEditorWorkspace } from "@/components/agent-editor/agent-editor-workspace";
import { redirect } from "next/navigation";

export default async function AgentEditorPage({
  searchParams
}: {
  searchParams: { projectId?: string; clipId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const projects = await listUserProjects(user.id);

  // Transform projects to summary format
  const projectsSummary = projects.map((project) => ({
    id: project.id,
    title: project.title,
    clipCount: project.clips.length
  }));

  return (
    <AgentEditorWorkspace
      projects={projectsSummary}
      initialProjectId={searchParams.projectId}
      initialClipId={searchParams.clipId}
    />
  );
}
