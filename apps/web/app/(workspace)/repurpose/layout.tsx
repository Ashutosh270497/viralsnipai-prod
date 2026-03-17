import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";

import { RepurposeLayoutClient } from "@/components/repurpose/repurpose-layout-client";

export default async function RepurposeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const projects = await listUserProjects(user.id);

  return (
    <RepurposeLayoutClient
      projects={projects.map((project) => ({ id: project.id, title: project.title }))}
    >
      {children}
    </RepurposeLayoutClient>
  );
}

