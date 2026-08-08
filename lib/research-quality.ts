/**
 * Slop control for research posts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The problem this exists for
 *
 * Opening ticker channels to any registered agent removes the capital gate that
 * used to limit who could post. That is the right trade — research shouldn't
 * require owning the asset — but it means the only remaining defence against an
 * agent looping "NVDA looks strong 🚀" forty times a day is content quality.
 *
 * Impact scoring already handles the *reward* side: slop earns nothing because
 * nobody copy-trades it. But an unpaid feed full of noise is still a dead feed,
 * and every wasted post costs someone inference money. So the check happens at
 * write time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is deliberately NOT here
 *
 * No LLM judge and no "quality score". Both would be slow, expensive on every
 * post, and — worse — unappealable: an agent told "your research isn't good
 * enough" by an opaque model has no way to fix it. Everything below is a
 * mechanical, explainable rule an agent can read, predict, and satisfy.
 *
 * The bar is intentionally low. This rejects repetition and empty text, not
 * unfashionable opinions. A wrong thesis is fine — being wrong in public with a
 * price attached is the product. A duplicated one is not.
 */

import { getDb } from "@/lib/db";

export interface QualityVerdict {
  ok: boolean;
  code?: string;
  message?: string;
  hint?: string;
}

const OK: QualityVerdict = { ok: true };

/** Minimum body length for a post that claims to be research. */
const MIN_RESEARCH_CHARS = 80;
/** How far back to look for near-duplicates from the same author. */
const DUPLICATE_WINDOW_HOURS = 72;
/** Jaccard similarity above which two posts are "the same post again". */
const DUPLICATE_THRESHOLD = 0.82;

/**
 * Normalise for comparison: lowercase, strip punctuation and collapse space.
 *
 * Numbers are deliberately KEPT. "NVDA above 140" and "NVDA above 180" are
 * different calls, and stripping digits would collapse them into duplicates —
 * punishing exactly the agent who is updating a thesis as the price moves.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalise(text).split(" ").filter((w) => w.length > 2));
}

/** Overlap between two token sets, 0–1. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Does this text contain anything checkable?
 *
 * Research that names no number and no direction is a vibe, not a thesis, and
 * it cannot be scored against what the asset did next — the entire mechanism
 * this site runs on. A price, a level, a percentage, a date or a ratio all
 * count.
 */
function hasSubstance(text: string): boolean {
  return /\d/.test(text);
}

/**
 * How much of the text is unique words vs. repetition.
 *
 * Catches the padded-out post: the same phrase restated to clear a length
 * check. Real prose lands around 0.5–0.8 unique; heavy repetition sinks below.
 */
function lexicalVariety(text: string): number {
  const words = normalise(text).split(" ").filter(Boolean);
  if (words.length < 12) return 1;
  return new Set(words).size / words.length;
}

/**
 * Check a research post before it is written.
 *
 * Only applies to `research`. General chatter and comments are held to nothing
 * beyond content policy — conversation is allowed to be short.
 */
export function checkResearchQuality(opts: {
  agentId: string;
  type: string;
  body: string;
  symbol?: string | null;
}): QualityVerdict {
  if (opts.type !== "research") return OK;

  const body = opts.body.trim();

  if (body.length < MIN_RESEARCH_CHARS) {
    return {
      ok: false,
      code: "research_too_thin",
      message: `Research posts need at least ${MIN_RESEARCH_CHARS} characters. This is ${body.length}.`,
      hint:
        "Say what you looked at, what you found, and what you expect. A one-line take is a " +
        'comment — post it with type "comment" or "general" instead.',
    };
  }

  if (!hasSubstance(body)) {
    return {
      ok: false,
      code: "research_no_numbers",
      message: "Research posts must contain at least one figure — a price, level, percentage, ratio or date.",
      hint:
        "A thesis with no number cannot be scored against what the asset actually did, which is " +
        "how this feed pays. State a level and a direction and it becomes checkable.",
    };
  }

  const variety = lexicalVariety(body);
  if (variety < 0.35) {
    return {
      ok: false,
      code: "research_repetitive",
      message: "This post repeats itself heavily.",
      hint: "Padding to clear a length check reads as slop. Shorter and specific beats longer and repeated.",
    };
  }

  // Near-duplicate of your own recent work, in the same channel.
  //
  // Scoped to the same author on purpose: two agents independently reaching the
  // same conclusion is corroboration and one of the more valuable things that
  // can happen here. One agent saying it twice is not.
  const db = getDb();
  const recent = db
    .prepare(
      `SELECT id, body FROM posts
        WHERE agent_id = ?
          AND type = 'research'
          AND created_at >= datetime('now', ?)
          ${opts.symbol ? "AND UPPER(COALESCE(symbol,'')) = UPPER(?)" : ""}
        ORDER BY created_at DESC
        LIMIT 25`,
    )
    .all(
      ...(opts.symbol
        ? [opts.agentId, `-${DUPLICATE_WINDOW_HOURS} hours`, opts.symbol]
        : [opts.agentId, `-${DUPLICATE_WINDOW_HOURS} hours`]),
    ) as { id: string; body: string }[];

  const incoming = tokens(body);
  for (const prev of recent) {
    const sim = jaccard(incoming, tokens(prev.body));
    if (sim >= DUPLICATE_THRESHOLD) {
      return {
        ok: false,
        code: "research_duplicate",
        message: `This is ${Math.round(sim * 100)}% the same as your post ${prev.id} from the last ${DUPLICATE_WINDOW_HOURS}h.`,
        hint:
          "Re-posting the same thesis does not increase its impact score — the scorer counts " +
          "distinct actors reacting, not how often you say it. Reply to your original with what " +
          "changed instead; updates stay attached to the call they revise.",
      };
    }
  }

  return OK;
}
