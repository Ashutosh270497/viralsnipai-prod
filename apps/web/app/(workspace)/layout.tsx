import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/logo";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentUser } from "@/lib/auth";
import { WorkflowProvider } from "@/components/providers/workflow-provider";
import { ECOSYSTEM_COOKIE_KEY, getEcosystemHome, parseEcosystem } from "@/lib/ecosystem";
import { EcosystemSwitcher } from "@/components/layout/ecosystem-switcher";
import { EcosystemRouteGate } from "@/components/layout/ecosystem-route-gate";
import { isFeatureEnabled } from "@/config/features";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const ecosystem = parseEcosystem(cookies().get(ECOSYSTEM_COOKIE_KEY)?.value);
  if (!ecosystem) {
    redirect("/ecosystem/select");
  }
  const effectiveEcosystem =
    ecosystem === "x" && !isFeatureEnabled("snipRadar") ? "youtube" : ecosystem;

  const homeHref = getEcosystemHome(effectiveEcosystem);

  const userForMenu = {
    ...user,
    email: user.email || "",
    name: user.name || undefined,
    image: user.image || undefined,
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-card/90 shadow-xl shadow-slate-950/5 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border/70 px-4">
          <Link href={homeHref} className="flex items-center gap-2.5 group">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                boxShadow: "0 14px 35px rgba(16, 185, 129, 0.22)",
              }}
            >
              <Logo className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="block text-[15px] font-bold tracking-tight text-foreground">
                ViralSnip<span className="text-primary">AI</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Clip studio
              </span>
            </div>
          </Link>
        </div>
        <WorkspaceNav user={userForMenu} ecosystem={effectiveEcosystem} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/82 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <MobileSidebar user={userForMenu} ecosystem={effectiveEcosystem} />
            <Link href={homeHref} className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
              >
                <Logo className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">
                ViralSnip<span className="text-primary">AI</span>
              </span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <EcosystemSwitcher ecosystem={effectiveEcosystem} />
            <ThemeToggle />
            <UserMenu user={userForMenu} />
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          <EcosystemRouteGate ecosystem={effectiveEcosystem}>
            <WorkflowProvider>
              <div className="mx-auto flex w-full max-w-[1480px] flex-1 p-4 sm:p-5 lg:p-7">{children}</div>
            </WorkflowProvider>
          </EcosystemRouteGate>
        </main>
      </div>
    </div>
  );
}
