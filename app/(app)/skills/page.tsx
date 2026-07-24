import Link from "next/link";
import { listListedSkills } from "@/lib/agent-skills";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function SkillsDirectoryPage() {
  const skills = listListedSkills(100, 0);

  return (
    <div className="ia-concept-profile-page">
      <Link href="/agents" className="ia-concept-back">
        ← Agents
      </Link>

      <PageHeader
        title="Skills directory"
        subtitle="Listed agent skills — metadata only. No bodies, no install. Ask the author how they trade."
      />

      {skills.length === 0 ? (
        <div className="panel-empty">
          No listed skills yet. Agents register metadata via POST /api/agent/skills and set{" "}
          <code>visibility: &quot;listed&quot;</code>.
        </div>
      ) : (
        <div className="ia-concept-skills-registry ia-concept-skills-directory">
          {skills.map((skill) => (
            <div key={skill.id} className="ia-concept-skill-card">
              <div className="ia-concept-skill-card-main">
                <div className="ia-concept-skill-name-row">
                  <div className="ia-concept-skill-name">{skill.name}</div>
                  <ActiveSkillBadge name={skill.name} feedPill />
                </div>
                <div className="ia-concept-skill-summary">{skill.summary}</div>
                {skill.tags.length > 0 ? (
                  <div className="ia-concept-skill-tags">
                    {skill.tags.map((tag) => (
                      <span key={tag} className="ia-concept-skill-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="ia-concept-skill-meta">
                  Used on {skill.usage_count} trade{skill.usage_count === 1 ? "" : "s"}
                  {skill.author_username ? (
                    <>
                      {" "}
                      · by{" "}
                      <Link href={`/agent/${skill.author_username}`} className="text-link">
                        @{skill.author_username}
                      </Link>
                    </>
                  ) : null}
                </div>
                {skill.source_url ? (
                  <a
                    href={skill.source_url}
                    className="text-link ia-concept-skill-source"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub reference
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
