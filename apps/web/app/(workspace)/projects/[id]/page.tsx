import Link from "next/link";
import { redirect } from "next/navigation";

import { TranscribeButton } from "@/components/projects/transcribe-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getProjectWithRelations } from "@/lib/projects";
import { formatDuration } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const project = await getProjectWithRelations(params.id, user.id);
  if (!project) {
    redirect("/projects");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{project.title}</h1>
            {project.topic ? <Badge variant="outline">{project.topic}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Timeline: assets → clips → captions → exports
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/repurpose?projectId=${project.id}`}>Open in RepurposeOS</Link>
          </Button>
          <Button asChild>
            <Link href={`/hooksmith?projectId=${project.id}`}>Update script</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Script</CardTitle>
          <CardDescription>Keep your talking points aligned with Hooksmith.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.script ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-4 text-sm leading-relaxed">
                {project.script.body.split("\n").map((paragraph, index) => (
                  <p key={index} className="mb-2 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(Array.isArray(project.script.hooks) ? project.script.hooks as string[] : []).map((hook) => (
                  <Badge key={hook} variant="secondary">
                    {hook}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No script yet. Generate one with Hooksmith.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Raw uploads or recordings ready for transcription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Upload a source video from the Repurpose tab.</p>
          ) : (
            project.assets.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{asset.type.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {formatDuration((asset.durationSec ?? 0) * 1000)}
                  </p>
                  {asset.transcript ? (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">View transcript</summary>
                      <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-background p-3 text-left text-xs">
                        {asset.transcript}
                      </p>
                    </details>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!asset.transcript ? <TranscribeButton assetId={asset.id} /> : null}
                  <a
                    href={asset.path}
                    className="text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clips</CardTitle>
          <CardDescription>Highlights generated from the latest asset.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.clips.length === 0 ? (
            <p className="text-sm text-muted-foreground">Run auto-highlight detection in RepurposeOS.</p>
          ) : (
            project.clips.map((clip, index) => (
              <div
                key={clip.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">Clip {index + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(clip.endMs - clip.startMs)} • {formatDuration(clip.startMs)} → {formatDuration(clip.endMs)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {clip.captionSrt ? <Badge variant="success">Captioned</Badge> : <Badge variant="warning">Captions pending</Badge>}
                  {clip.previewPath ? (
                    <a href={clip.previewPath} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Preview
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <CardDescription>Queue renders and download the final outputs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.exports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet. Queue one from RepurposeOS.</p>
          ) : (
            project.exports.map((exp) => (
              <div
                key={exp.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{exp.preset}</p>
                  <p className="text-xs text-muted-foreground">Status: {exp.status}</p>
                </div>
                {exp.status === "done" ? (
                  <a href={exp.outputPath} className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
                    Download
                  </a>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <span>Need help? Check the README for FFmpeg setup & troubleshooting.</span>
        <span>Exports are stored locally at /uploads/exports in development.</span>
      </div>
    </div>
  );
}
