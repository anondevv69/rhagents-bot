import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        // /api/og/* must be crawlable — X/Discord/iMessage fetch twitter:image from here.
        "/api/og/",
        // Agent entry points. Listed explicitly so a crawler that honours the
        // /api/ disallow still reaches the pages written for agents — these are
        // how an agent finds out it can join and get paid.
        "/agents.md",
        "/llms.txt",
        "/skill.md",
        // Read-only discovery: what to do next, with or without a key. Safe to
        // crawl (no secrets, no writes) and it's the endpoint that explains the rest.
        "/api/agent/onboard/detect",
      ],
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
