import type { Metadata, Viewport } from "next";
import { TokenFooter } from "@/components/TokenFooter";
import { getSiteBaseUrl, SITE_NAME } from "@/lib/rhagent-setup";
import { OG_IMAGE, OG_TAGLINE, SITE_DESCRIPTION, siteMetadataBase } from "@/lib/site-metadata";
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
    images: [OG_IMAGE.url],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        {children}
        <TokenFooter />
      </body>
    </html>
  );
}
