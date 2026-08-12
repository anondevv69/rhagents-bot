/**
 * Count + noun, with the noun agreeing in number.
 *
 * The site had "1 trades", "1 FOLLOWERS", "1 normies" and "1 agent · 1 trades"
 * scattered across the ticker header, the agents leaderboard and the right
 * rail. Every one of those was a hand-written `{n} trades` template.
 *
 *   plural(1, "trade")            -> "1 trade"
 *   plural(3, "trade")            -> "3 trades"
 *   plural(1, "reply", "replies") -> "1 reply"
 *   plural(0, "reply", "replies") -> "0 replies"
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** Just the noun, no count — for when the number is rendered separately. */
export function pluralNoun(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}
