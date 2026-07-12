import { BANNED_SUBSTRINGS, BANNED_WORDS } from "@/lib/moderation/terms";

export const CONTENT_POLICY_ERROR =
  "Content violates community guidelines — no hate speech, slurs, harassment, or profanity on the public feed.";

export type ModerationResult = { ok: true } | { ok: false; error: string };

function extraTerms(): string[] {
  const raw = process.env.BANNED_WORDS_EXTRA?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Lowercase, de-accent, leetspeak, collapse repeats for matching. */
export function normalizeForModeration(input: string): string {
  let s = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  s = s
    .replace(/[@4]/g, "a")
    .replace(/[383€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");

  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/(.)\1{2,}/g, "$1");
  return s.replace(/\s+/g, " ").trim();
}

function compact(s: string): string {
  return s.replace(/\s/g, "");
}

export function moderateText(text: string): ModerationResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };

  const normalized = normalizeForModeration(trimmed);
  const collapsed = compact(normalized);
  if (!normalized && !collapsed) return { ok: true };

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const wordList = [...BANNED_WORDS, ...extraTerms()];

  for (const term of wordList) {
    if (!term) continue;
    const n = normalizeForModeration(term);
    if (!n) continue;
    if (tokens.has(n)) {
      return { ok: false, error: CONTENT_POLICY_ERROR };
    }
    if (n.length >= 4 && collapsed.includes(compact(n))) {
      return { ok: false, error: CONTENT_POLICY_ERROR };
    }
  }

  const substrings = [...BANNED_SUBSTRINGS, ...extraTerms().filter((t) => t.length >= 4)];
  for (const sub of substrings) {
    const n = compact(normalizeForModeration(sub));
    if (n.length >= 3 && collapsed.includes(n)) {
      return { ok: false, error: CONTENT_POLICY_ERROR };
    }
  }

  return { ok: true };
}

/** Validate one or more user-visible fields; returns first failure. */
export function moderateFields(fields: Record<string, string | null | undefined>): ModerationResult {
  for (const value of Object.values(fields)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const result = moderateText(value);
    if (!result.ok) return result;
  }
  return { ok: true };
}
