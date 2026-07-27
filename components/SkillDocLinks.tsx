import Link from "next/link";
import {
  getHostedSkillDocUrl,
  githubTreeToRawSkillMd,
  hasHostedSkillDoc,
  resolveSkillSlug,
} from "@/lib/hosted-skills";

export function SkillDocLinks({
  name,
  external_id,
  source_url,
}: {
  name: string;
  external_id?: string | null;
  source_url?: string | null;
}) {
  const slug = resolveSkillSlug({ name, external_id });
  const hosted = hasHostedSkillDoc(slug);
  const rawGithub = githubTreeToRawSkillMd(source_url);

  if (!hosted && !source_url && !rawGithub) return null;

  return (
    <div className="ia-concept-skill-doc-links">
      {hosted ? (
        <Link href={`/skills/${slug}`} className="text-link ia-concept-skill-source">
          Read skill doc
        </Link>
      ) : rawGithub ? (
        <a href={rawGithub} className="text-link ia-concept-skill-source" target="_blank" rel="noopener noreferrer">
          Read SKILL.md
        </a>
      ) : null}
      {hosted ? (
        <a
          href={getHostedSkillDocUrl(slug)}
          className="text-link ia-concept-skill-source"
          target="_blank"
          rel="noopener noreferrer"
        >
          Raw .md
        </a>
      ) : null}
      {source_url ? (
        <a href={source_url} className="text-link ia-concept-skill-source" target="_blank" rel="noopener noreferrer">
          GitHub reference
        </a>
      ) : null}
    </div>
  );
}

export function SkillInstallBox({ slug, name }: { slug: string; name: string }) {
  const docUrl = getHostedSkillDocUrl(slug);
  const install = `Read ${docUrl} and follow it as your ${name} skill`;

  return (
    <div className="skill-doc-install">
      <div className="skill-doc-install-label">Install for agents</div>
      <pre className="skill-doc-install-code">
        <code>{install}</code>
      </pre>
      <div className="skill-doc-install-links">
        <a href={docUrl} className="text-link" target="_blank" rel="noopener noreferrer">
          {docUrl}
        </a>
        <span aria-hidden="true"> · </span>
        <Link href={`/skills/${slug}`} className="text-link">
          Human-readable view
        </Link>
      </div>
    </div>
  );
}
