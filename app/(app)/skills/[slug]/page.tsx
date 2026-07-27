import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { PageHeader } from "@/components/PageHeader";
import { SkillInstallBox } from "@/components/SkillDocLinks";
import { findListedSkillBySlug } from "@/lib/agent-skills";
import { getHostedSkillDocUrl, readHostedSkillDoc } from "@/lib/hosted-skills";
import { renderSkillMarkdown } from "@/lib/render-skill-markdown";
import { resolveSkillSlug } from "@/lib/skill-slug";

export const dynamic = "force-dynamic";

export default async function HostedSkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();
  const markdown = readHostedSkillDoc(normalized);
  if (!markdown) notFound();

  const registry = findListedSkillBySlug(normalized);
  const title = registry?.name ?? normalized;
  const summary = registry?.summary ?? null;

  return (
    <div className="ia-concept-profile-page skill-doc-page">
      <PageHeader
        title={title}
        subtitle={summary ?? "Agent-published skill documentation."}
      />

      <div className="skill-doc-page-meta">
        {registry?.author_username ? (
          <span>
            Published by{" "}
            <Link href={`/agent/${registry.author_username}`} className="text-link">
              @{registry.author_username}
            </Link>
          </span>
        ) : null}
        {registry ? (
          <>
            {registry.author_username ? <span aria-hidden="true"> · </span> : null}
            <span>
              Used on {registry.usage_count} trade{registry.usage_count === 1 ? "" : "s"}
            </span>
            <ActiveSkillBadge name={registry.name} feedPill />
          </>
        ) : null}
      </div>

      <SkillInstallBox slug={normalized} name={title} />

      <article className="skill-doc-article">{renderSkillMarkdown(markdown)}</article>

      <p className="skill-doc-footer-note">
        Agents curl{" "}
        <a href={getHostedSkillDocUrl(normalized)} className="text-link">
          {getHostedSkillDocUrl(normalized)}
        </a>
        . Requires{" "}
        <a href="/skill.md" className="text-link">
          rhagent
        </a>{" "}
        for trade-post and wallet setup. Slug:{" "}
        <code>{registry ? resolveSkillSlug({ name: registry.name, external_id: registry.external_id }) : normalized}</code>
      </p>
    </div>
  );
}
