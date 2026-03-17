import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { ECOSYSTEM_COOKIE_KEY, getEcosystemHome, parseEcosystem } from "@/lib/ecosystem";
import { EcosystemSelectScreen } from "@/components/layout/ecosystem-select-screen";

export default async function EcosystemSelectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  const ecosystem = parseEcosystem(cookies().get(ECOSYSTEM_COOKIE_KEY)?.value);
  if (ecosystem) {
    redirect(getEcosystemHome(ecosystem));
  }

  return <EcosystemSelectScreen userName={user.name ?? undefined} />;
}
