import { ReactNode } from "react";
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
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — slightly raised surface over deep background */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/40 bg-card lg:flex">
        {/* Logo area */}
        <div className="flex h-14 items-center gap-3 border-b border-border/40 px-4">
          <Link href={homeHref} className="flex items-center gap-2.5 group">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                boxShadow: "0 0 12px hsl(263 72% 56% / 0.5)",
              }}
            >
              <Logo className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">
              ViralSnip<span className="text-primary">AI</span>
            </span>
          </Link>
        </div>
        <WorkspaceNav user={userForMenu} ecosystem={effectiveEcosystem} />
      </aside>

      {/* Main area */}
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        {/* Top header — subtle glass effect */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/40 bg-background/90 px-4 backdrop-blur-xl lg:px-6">
          {/* Mobile trigger + logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <MobileSidebar user={userForMenu} ecosystem={effectiveEcosystem} />
            <Link href={homeHref} className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" }}
              >
                <Logo className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">
                ViralSnip<span className="text-primary">AI</span>
              </span>
            </Link>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1">
            <EcosystemSwitcher ecosystem={effectiveEcosystem} />
            <ThemeToggle />
            <UserMenu user={userForMenu} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col bg-background">
          <EcosystemRouteGate ecosystem={effectiveEcosystem}>
            <WorkflowProvider>
              <div className="flex-1 p-4 lg:p-6">{children}</div>
            </WorkflowProvider>
          </EcosystemRouteGate>
        </main>
      </div>
    </div>
  );
}
