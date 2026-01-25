import { getCurrentUser } from "@/lib/auth";
import { VeoWorkspace } from "@/components/veo/veo-workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isVeoEnabled } from "@/lib/feature-flags";

export default async function VeoPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const veoEnabled = isVeoEnabled();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Veo</h1>
        <p className="text-muted-foreground">
          Bring scripts to life with generative video. Describe the scene and Veo will render cinematic footage in seconds.
        </p>
      </div>
      {!veoEnabled ? (
        <Alert>
          <AlertTitle>Temporarily unavailable</AlertTitle>
          <AlertDescription>
            Veo access is paused while we introduce the new Sora-2 powered Video Lab. Existing Veo projects remain safe and will return soon.
          </AlertDescription>
        </Alert>
      ) : (
        <VeoWorkspace />
      )}
    </div>
  );
}
