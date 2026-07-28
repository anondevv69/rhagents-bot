import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      // /api/og/* must be crawlable — X/Discord/iMessage fetch twitter:image from here.
      allow: ["/", "/api/og/"],
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
