import type { Metadata } from "next";
import "./globals.css";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "発送管理コンソール",
  description: "楽天RMS受注 × クリックポスト配送自動化ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="app-shell flex min-h-dvh bg-background text-foreground">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
                <TopBar />
                <main className="min-w-0 flex-1">{children}</main>
              </div>
            </div>
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
