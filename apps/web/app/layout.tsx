import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./../styles/globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ReactQueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { FeatureFlagProvider } from "@/components/providers/feature-flag-provider";
import { CommandMenu } from "@/components/command-menu";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: "Clippers — Hooksmith & RepurposeOS",
  description:
    "Create scroll-stopping hooks, scripts, and social-ready clips with AI-assisted editing, burnt-in captions, and brand-safe exports."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <FeatureFlagProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <ReactQueryProvider>
              <div className="relative flex min-h-screen flex-col">{children}</div>
              <Toaster />
              <CommandMenu />
            </ReactQueryProvider>
          </ThemeProvider>
        </FeatureFlagProvider>
      </body>
    </html>
  );
}
