"use client";

import { RepurposeIngestPage } from "@/components/repurpose/repurpose-ingest-page";
import { useRepurpose } from "@/components/repurpose/repurpose-context";

export default function RepurposePage() {
  const { projects } = useRepurpose();

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        Create a project to start repurposing video content.
      </div>
    );
  }

  return <RepurposeIngestPage />;
}

