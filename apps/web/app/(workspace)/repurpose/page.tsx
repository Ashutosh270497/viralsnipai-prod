"use client";

import { FolderKanban } from "lucide-react";

import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { EmptyState } from "@/components/product-ui/primitives";
import { RepurposeIngestPage } from "@/components/repurpose/repurpose-ingest-page";
import { useRepurpose } from "@/components/repurpose/repurpose-context";

export default function RepurposePage() {
  const { projects } = useRepurpose();

  if (projects.length === 0) {
    return (
      <div className="w-full">
        <EmptyState
          icon={FolderKanban}
          title="Start by creating or selecting a project"
          description="A project keeps your source video, detected clips, captions, exports, and brand settings together."
          secondary={{ label: "View projects", href: "/projects" }}
        >
          <NewProjectDialog triggerLabel="Create project" triggerSize="lg" onSuccessRedirect="/repurpose" />
        </EmptyState>
      </div>
    );
  }

  return <RepurposeIngestPage />;
}
