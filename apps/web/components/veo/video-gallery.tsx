import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { GeneratedVideo } from "./use-veo-generator";

type VeoGalleryProps = {
  videos: GeneratedVideo[];
};

export function VeoVideoGallery({ videos }: VeoGalleryProps) {
  if (videos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-10 text-center text-sm text-muted-foreground">
        <Badge variant="secondary" className="mb-3">
          Veo
        </Badge>
        Nothing rendered yet. Describe a camera move, lighting, and subject to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {videos.map((video) => (
        <figure key={video.id} className="overflow-hidden rounded-xl border border-border/70 bg-secondary/30">
          <div className="relative">
            <video
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              controls
              className="aspect-video w-full rounded-t-xl bg-black"
            />
          </div>
          <figcaption className="space-y-3 p-4">
            <p className="text-sm font-medium text-foreground line-clamp-2">{video.prompt}</p>
            <Button type="button" variant="secondary" className="w-full" onClick={() => downloadVideo(video)}>
              <Download className="mr-2 h-4 w-4" />
              Download mp4
            </Button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function downloadVideo(video: GeneratedVideo) {
  const link = document.createElement("a");
  link.href = video.videoUrl;
  link.download = `veo-${video.id}.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
