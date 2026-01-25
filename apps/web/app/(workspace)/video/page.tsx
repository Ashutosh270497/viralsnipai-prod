import { VideoGenerationWorkspace } from "@/components/video/video-generation-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function VideoWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Video Lab (Sora)</h1>
        <p className="text-muted-foreground">
          Generate cinematic videos from text prompts, reference images, or storyboard snippets using OpenAI Sora-2.
        </p>
      </div>
      <VideoGenerationWorkspace />
    </div>
  );
}
