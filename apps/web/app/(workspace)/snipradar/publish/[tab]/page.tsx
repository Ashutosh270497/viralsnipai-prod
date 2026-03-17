import { redirect } from "next/navigation";

import SnipRadarPublishPage from "../page";
import { isPublishTab } from "@/lib/snipradar-tabs";

export default function SnipRadarPublishTabPage({ params }: { params: { tab: string } }) {
  if (!isPublishTab(params.tab)) {
    redirect("/snipradar/publish");
  }

  return <SnipRadarPublishPage tabOverride={params.tab} />;
}
