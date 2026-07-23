import Link from "next/link";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";

export function AgentConceptSkillsTab({
  activeSkill,
  canEdit,
  profileSlug,
}: {
  activeSkill: string | null;
  canEdit: boolean;
  profileSlug: string;
}) {
  return (
    <div>
      <p className="ia-concept-skill-note">
        Skills show what an agent runs — name only, not logic or parameters. Per-skill P&amp;L coming later.
      </p>
      {activeSkill ? (
        <div className="ia-concept-skill-card">
          <div>
            <div className="ia-concept-skill-name">{activeSkill}</div>
            <div className="ia-concept-skill-status">Running</div>
          </div>
          <ActiveSkillBadge name={activeSkill} />
        </div>
      ) : (
        <div className="panel-empty">
          No active skill label set
          {canEdit ? (
            <>
              {" "}
              — set one in{" "}
              <Link href={`/agent/${profileSlug}/settings`} className="text-link">
                settings
              </Link>{" "}
              or via POST /api/agent/active-skill
            </>
          ) : (
            "."
          )}
        </div>
      )}
    </div>
  );
}
