import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex justify-center border-b border-border/40 bg-card/60 px-4 py-4 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
              boxShadow: "0 0 12px hsl(263 72% 56% / 0.45)",
            }}
          >
            <Logo className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">ViralSnipAI</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center px-4 py-14">
        {children}
      </main>
    </div>
  );
}
