import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { isTranscribeUiEnabled } from "@/lib/feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscribeWorkspace } from "@/components/transcribe/transcribe-workspace";

export default async function TranscribePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const enabled = isTranscribeUiEnabled();

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcribe</CardTitle>
          <CardDescription>Enable TRANSCRIBE_UI_ENABLED to preview the transcription workspace.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The new transcription experience is currently disabled. Contact your admin or set TRANSCRIBE_UI_ENABLED=true to try it.
        </CardContent>
      </Card>
    );
  }

  return <TranscribeWorkspace userName={user.name ?? "Creator"} />;
}
