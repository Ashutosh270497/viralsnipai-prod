import { redirect } from "next/navigation";

import SnipRadarDiscoverPage from "../page";
import { isDiscoverTab } from "@/lib/snipradar-tabs";

export default function SnipRadarDiscoverTabPage({ params }: { params: { tab: string } }) {
  if (!isDiscoverTab(params.tab)) {
    redirect("/snipradar/discover");
  }

  return <SnipRadarDiscoverPage tabOverride={params.tab} />;
}
