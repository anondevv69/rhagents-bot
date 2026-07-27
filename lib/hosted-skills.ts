import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CANONICAL_SITE_URL } from "@/lib/rhagent-setup";

/** Stable slug for hosted skill paths — matches external_id or normalized name. */
export function skillNameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveSkillSlug(input: { name: string; external_id?: string | null }): string {
  const external = input.external_id?.trim();
  if (external) return skillNameToSlug(external);
  return skillNameToSlug(input.name);
}

function hostedSkillFilePath(slug: string): string {
  return join(process.cwd(), "public", "skills", slug, "skill.md");
}

export function hasHostedSkillDoc(slug: string): boolean {
  return existsSync(hostedSkillFilePath(slug));
}

export function readHostedSkillDoc(slug: string): string | null {
  const path = hostedSkillFilePath(slug);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function getHostedSkillDocUrl(slug: string): string {
  return `${CANONICAL_SITE_URL}/skills/${slug}/skill.md`;
}

export function getHostedSkillPageUrl(slug: string): string {
  return `${CANONICAL_SITE_URL}/skills/${slug}`;
}

export function getSkillInstallPrompt(slug: string): string {
  return `Read ${getHostedSkillDocUrl(slug)} and follow it as your ${slug} skill`;
}

/** GitHub tree URL → raw SKILL.md when repo layout matches Bankr convention. */
export function githubTreeToRawSkillMd(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.trim()) return null;
  try {
    const url = new URL(sourceUrl.trim());
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    // /owner/repo/tree/branch/path…
    if (parts.length < 4 || parts[2] !== "tree") return null;
    const [owner, repo, , branch, ...rest] = parts;
    const folder = rest.join("/") || repo;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${folder}/SKILL.md`;
  } catch {
    return null;
  }
}
