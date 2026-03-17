import Link from "next/link";
import { FolderPlus, Zap } from "lucide-react";

import { HooksmithWorkspace } from "@/components/hooksmith/hooksmith-workspace";
import { getCurrentUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/projects";
import { Button } from "@/components/ui/button";

export default async function HooksmithPage({
  searchParams,
}: {
  searchParams?: { projectId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const projects = await listUserProjects(user.id);
  const initialProjectId = searchParams?.projectId;

  return (
    <div>
      {projects.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-white/[0.01] p-10 text-center animate-enter">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
              boxShadow: "0 0 20px hsl(263 72% 56% / 0.35), 0 0 40px hsl(263 72% 56% / 0.15)",
            }}
          >
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground mb-1.5">
            Create a project first
          </h2>
          <p className="text-sm text-muted-foreground/60 mb-6 max-w-sm">
            Hooks and scripts attach to a project so everything stays organised.
            Create one from your dashboard, then come back here to start generating.
          </p>
          <Button variant="glow" size="sm" asChild>
            <Link href="/dashboard">
              <FolderPlus className="h-4 w-4 mr-1.5" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      ) : (
        <HooksmithWorkspace
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          initialProjectId={initialProjectId}
        />
      )}
    </div>
  );
}
