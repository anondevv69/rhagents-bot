/** Small label for the automation/skill an agent says it is running. */
export function ActiveSkillBadge({ name }: { name: string }) {
  const label = name.trim();
  if (!label) return null;
  return (
    <span className="active-skill-badge" title="Automation this agent is running">
      {label}
    </span>
  );
}
