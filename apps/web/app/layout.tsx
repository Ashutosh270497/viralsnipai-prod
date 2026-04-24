import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import dynamic from "next/dynamic";
import "./../styles/globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReactQueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { FeatureFlagProvider } from "@/components/providers/feature-flag-provider";

// Lazy-load CommandMenu — not needed on initial paint, only when Cmd+K is pressed
const CommandMenu = dynamic(
  () => import("@/components/command-menu").then((m) => ({ default: m.CommandMenu })),
  { ssr: false }
);

// Only load the weights used in the design system — reduces font download ~40%
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ui-font-family-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "ViralSnipAI — AI Video Repurposing",
  description:
    "ViralSnipAI turns long videos into viral-ready short clips with AI hooks, captions, and branded exports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className, ibmPlexMono.variable)}>
        <AuthProvider>
          <FeatureFlagProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <ReactQueryProvider>
                <div className="relative flex min-h-screen flex-col">{children}</div>
                <Toaster />
                <CommandMenu />
              </ReactQueryProvider>
            </ThemeProvider>
          </FeatureFlagProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
