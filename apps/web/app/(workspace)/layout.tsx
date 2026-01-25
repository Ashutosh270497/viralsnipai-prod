import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/logo";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { getCurrentUser } from "@/lib/auth";
import { QueryProvider } from "@/lib/providers/query-client-provider";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-r border-border bg-secondary/40 lg:flex lg:flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Logo className="h-6 w-6" />
            Clippers
          </Link>
        </div>
        <WorkspaceNav />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 w-full items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo className="h-6 w-6" />
            <span className="text-base font-semibold">Clippers</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 bg-secondary/20 p-4 lg:p-8">
          <QueryProvider>{children}</QueryProvider>
        </main>
      </div>
    </div>
  );
}
