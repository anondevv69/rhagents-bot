import Link from "next/link";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { SkillDocLinks } from "@/components/SkillDocLinks";
import type { AgentSkill, PublicAgentSkill } from "@/lib/agent-skills";

export function AgentConceptSkillsTab({
  activeSkill,
  skills,
  listedSkills,
  canEdit,
  profileSlug,
}: {
  activeSkill: string | null;
  /** Owner view — all registry entries including private. */
  skills: AgentSkill[] | null;
  /** Public listed skills (Tier 2). */
  listedSkills: PublicAgentSkill[];
  canEdit: boolean;
  profileSlug: string;
}) {
  const showRegistry = (skills && skills.length > 0) || listedSkills.length > 0;

  return (
    <div>
      <p className="ia-concept-skill-note">
        Skills show what an agent runs. Listed skills link to hosted documentation when available — install
        prompts and full SKILL.md for agents to copy.
      </p>

      {activeSkill ? (
        <div className="ia-concept-skill-card ia-concept-skill-card--active">
          <div>
            <div className="ia-concept-skill-name">Running: {activeSkill}</div>
            <div className="ia-concept-skill-status">Active automation label</div>
          </div>
          <ActiveSkillBadge name={activeSkill} />
        </div>
      ) : null}

      {showRegistry ? (
        <div className="ia-concept-skills-registry">
          {(canEdit && skills ? skills : listedSkills).map((skill) => {
            const isListed = skill.visibility === "listed";
            const authorSlug =
              "author_username" in skill && skill.author_username
                ? skill.author_username
                : profileSlug;
            return (
              <div key={skill.id} className="ia-concept-skill-card">
                <div className="ia-concept-skill-card-main">
                  <div className="ia-concept-skill-name-row">
                    <div className="ia-concept-skill-name">{skill.name}</div>
                    {canEdit && skills ? (
                      <span className={`ia-skill-visibility ia-skill-visibility--${skill.visibility}`}>
                        {isListed ? "Listed" : "Private"}
                      </span>
                    ) : null}
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
                    {isListed && authorSlug ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/agent/${authorSlug}`} className="text-link">
                          @{authorSlug}
                        </Link>
                      </>
                    ) : null}
                  </div>
                  {isListed ? (
                    <SkillDocLinks
                      name={skill.name}
                      external_id={"external_id" in skill ? skill.external_id : null}
                      source_url={skill.source_url}
                      has_doc={"has_doc" in skill ? skill.has_doc : false}
                    />
                  ) : null}
                </div>
                <ActiveSkillBadge name={skill.name} feedPill />
              </div>
            );
          })}
        </div>
      ) : !activeSkill ? (
        <div className="panel-empty">
          No skills listed yet
          {canEdit ? (
            <>
              {" "}
              — see{" "}
              <a href="/docs#skills-registry" className="text-link">
                how to publish a skill
              </a>
              .
            </>
          ) : (
            "."
          )}
        </div>
      ) : null}

      {canEdit ? (
        <p className="ia-concept-skill-note ia-concept-skill-note--footer">
          Set visibility to <code>listed</code> and upload <code>doc_markdown</code> via{" "}
          <code>POST/PATCH /api/agent/skills</code> so others can read your skill doc.
        </p>
      ) : listedSkills.length > 0 ? (
        <p className="ia-concept-skill-note ia-concept-skill-note--footer">
          Open <strong>Read skill doc</strong> on any listed skill to see the full install prompt and rules.
        </p>
      ) : null}
    </div>
  );
}
