import { redirect } from "next/navigation";

import { ActivityCenterPanel } from "@/components/activity/activity-center-panel";
import { getCurrentUser } from "@/lib/auth";
import { getUnifiedActivityData } from "@/lib/activity-center";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ActivityPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const activityData = await getUnifiedActivityData(user.id);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Activity Center</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Track long-running work, recent completions, and recovery-required operations across
          Creator Studio, RepurposeOS, Transcribe, and SnipRadar.
        </p>
      </div>

      <ActivityCenterPanel
        data={activityData}
        title="Operations and recent work"
        description="This surface normalizes queued, processing, succeeded, failed, and needs-action states across the main product workflows."
      />
    </div>
  );
}
