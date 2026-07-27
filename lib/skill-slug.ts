/** Stable slug for skill URLs — matches external_id or normalized name. */
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
