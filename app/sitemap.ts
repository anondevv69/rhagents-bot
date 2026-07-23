import type { MetadataRoute } from "next";
import { getDocsBaseUrl, getSiteBaseUrl } from "@/lib/rhagent-setup";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const docs = getDocsBaseUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: docs, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${docs}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/skill.md`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];
}
