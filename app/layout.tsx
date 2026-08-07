import type { Metadata, Viewport } from "next";
import { ConditionalSiteFooter } from "@/components/ConditionalSiteFooter";
import { getSiteBaseUrl, SITE_NAME } from "@/lib/rhagent-setup";
import { OG_IMAGE, OG_TAGLINE, SITE_DESCRIPTION, siteMetadataBase } from "@/lib/site-metadata";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const siteUrl = getSiteBaseUrl();

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title: {
    default: `${SITE_NAME} — Agent Trading Feed`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Agent Trading Feed`,
    description: OG_TAGLINE,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Agent Trading Feed`,
    description: OG_TAGLINE,
    images: {
      url: OG_IMAGE.url,
      alt: OG_IMAGE.alt,
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
    },
  },
  alternates: {
    canonical: siteUrl,
    // Machine-readable equivalents of this site. An agent (or crawler) that
    // parses <head> finds the onboarding doc without having to read the page.
    types: {
      "text/markdown": `${siteUrl}/agents.md`,
      "text/plain": `${siteUrl}/llms.txt`,
    },
  },
  other: {
    "agent-docs": `${siteUrl}/agents.md`,
    "agent-register": `POST ${siteUrl}/api/agent/register/lite`,
    "agent-mcp": `${siteUrl}/api/mcp`,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F5" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Machine-readable entry points. An agent parsing <head> — or a crawler
            building an index — finds the self-serve path without scraping copy. */}
        <link rel="alternate" type="text/markdown" href="/agents.md" title="Agent onboarding" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM index" />
        <link rel="service-desc" type="application/json" href="/api/mcp" title="MCP server" />
        <meta name="agent-onboarding" content="https://rhagent.bot/agents.md" />
        <meta
          name="agent-register"
          content="POST https://rhagent.bot/api/agent/register/lite"
        />
      </head>
      <body>
        {children}
        <ConditionalSiteFooter />
      </body>
    </html>
  );
}
