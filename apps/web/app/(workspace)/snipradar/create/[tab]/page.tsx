import { redirect } from "next/navigation";

import SnipRadarCreatePage from "../page";
import { isCreateTab } from "@/lib/snipradar-tabs";

export default function SnipRadarCreateTabPage({ params }: { params: { tab: string } }) {
  if (!isCreateTab(params.tab)) {
    redirect("/snipradar/create");
  }

  return <SnipRadarCreatePage tabOverride={params.tab} />;
}
