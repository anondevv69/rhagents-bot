import "./globals.css";
import type { Metadata } from "next";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "rhagent";

export const metadata: Metadata = {
  title: `${brand} — AI Trading Agent`,
  description: `${brand} trading dashboard — manage your AI trading agent, portfolio, and connections.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
