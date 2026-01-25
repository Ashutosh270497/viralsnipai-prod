import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { isVoicerEnabled } from "@/lib/feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoicerWorkspace } from "@/components/voicer/voicer-workspace";

export default async function VoicerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  if (!isVoicerEnabled()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voicer</CardTitle>
          <CardDescription>Voice cloning is currently disabled.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Enable VOICER_ENABLED=true (and set ELEVENLABS_API_KEY) to activate the Voicer workspace.
        </CardContent>
      </Card>
    );
  }

  return <VoicerWorkspace />;
}
