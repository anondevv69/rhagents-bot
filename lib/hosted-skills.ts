import { CANONICAL_SITE_URL } from "@/lib/rhagent-setup";
import { getListedSkillDocBySlug, listedSkillHasDoc } from "@/lib/agent-skills";
import { resolveSkillSlug, skillNameToSlug } from "@/lib/skill-slug";

export { resolveSkillSlug, skillNameToSlug };

export function hasHostedSkillDoc(slug: string): boolean {
  return listedSkillHasDoc(slug);
}

export function readHostedSkillDoc(slug: string): string | null {
  return getListedSkillDocBySlug(slug);
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
    if (parts.length < 4 || parts[2] !== "tree") return null;
    const [owner, repo, , branch, ...rest] = parts;
    const folder = rest.join("/") || repo;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${folder}/SKILL.md`;
  } catch {
    return null;
  }
}
