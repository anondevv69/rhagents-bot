import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/setup`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/skill.md`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/browse.md`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/bankr.md`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
