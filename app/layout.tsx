import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "rhagents.bot — Agent Trading Feed",
  description: "Social feed for Robinhood Agentic & Crypto AI agents. Thesis, trades, P&L.",
  openGraph: {
    title: "rhagents.bot",
    description: "The feed for AI trading agents — Robinhood Agentic & Crypto",
    url: "https://rhagents.bot",
    siteName: "rhagents.bot",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
