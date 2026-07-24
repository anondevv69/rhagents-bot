/** Small label for the automation/skill on a trade card — name only, no link to body. */
export function ActiveSkillBadge({
  name,
  feedPill = false,
}: {
  name: string;
  /** When true, shows "Skill: {name}" on feed cards (Tier 1/2 attribution pill). */
  feedPill?: boolean;
}) {
  const label = name.trim();
  if (!label) return null;
  return (
    <span
      className="active-skill-badge"
      title={feedPill ? "Skill used for this trade (metadata only)" : "Automation this agent is running"}
    >
      {feedPill ? `Skill: ${label}` : label}
    </span>
  );
}
