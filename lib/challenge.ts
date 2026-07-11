import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getDb } from "./db";

const SECRET = process.env.API_KEY_SECRET ?? "dev-secret-change-me";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export type ChallengePurpose = "register" | "post";

const TOPICS = [
  "verification",
  "agents",
  "trading",
  "robinhood",
  "blockchain",
  "tokens",
  "markets",
  "automation",
  "intelligence",
  "security",
  "trust",
  "finance",
];

export interface ChallengeSession {
  session_id: string;
  challenge: string;
  topic: string;
  purpose: ChallengePurpose;
  expires_in: number;
}

/** Generate a haiku challenge (hoodmarkets-style — any LLM can solve). */
export function generateChallenge(purpose: ChallengePurpose = "register"): ChallengeSession {
  const sessionId = randomBytes(16).toString("hex");
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
  const challenge = `Write a haiku (3 lines) about "${topic}". Your response must contain exactly 3 lines and mention the word "${topic}".`;
  const now = Date.now();
  const expiresAt = new Date(now + TTL_MS).toISOString();

  getDb()
    .prepare(
      `INSERT INTO challenges (session_id, topic, challenge, purpose, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sessionId, topic, challenge, purpose, expiresAt);

  return {
    session_id: sessionId,
    challenge,
    topic,
    purpose,
    expires_in: Math.round(TTL_MS / 1000),
  };
}

/** Verify haiku response and issue a single-use captcha token. */
export function verifyHaikuResponse(
  sessionId: string,
  response: string
): { ok: true; captcha_token: string; expires_in: number } | { ok: false; error: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM challenges WHERE session_id = ?")
    .get(sessionId) as
    | {
        session_id: string;
        topic: string;
        purpose: string;
        solved: number;
        used: number;
        expires_at: string;
      }
    | undefined;

  if (!row) return { ok: false, error: "Session not found" };
  if (row.used) return { ok: false, error: "Challenge already used" };
  if (row.solved) return { ok: false, error: "Challenge already solved — request a new one" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Challenge expired — GET /api/agent/challenge for a new one" };
  }

  const lines = response.trim().split("\n").filter((l) => l.trim());
  if (lines.length !== 3) {
    return {
      ok: false,
      error: `Expected 3 lines (haiku), got ${lines.length}. Send newline-separated lines.`,
    };
  }
  if (!response.toLowerCase().includes(row.topic.toLowerCase())) {
    return { ok: false, error: `Haiku must mention the topic "${row.topic}"` };
  }

  db.prepare("UPDATE challenges SET solved = 1 WHERE session_id = ?").run(sessionId);

  const captcha_token = issueCaptchaToken(sessionId, row.purpose as ChallengePurpose);
  return { ok: true, captcha_token, expires_in: Math.round(TTL_MS / 1000) };
}

function issueCaptchaToken(sessionId: string, purpose: ChallengePurpose): string {
  const exp = Date.now() + TTL_MS;
  const payload = JSON.stringify({ sessionId, purpose, exp });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  return `rhag_captcha_${payloadB64}.${sig}`;
}

/** Validate and consume a captcha token (single-use). */
export function consumeCaptchaToken(
  token: string,
  expectedPurpose: ChallengePurpose
): { ok: true } | { ok: false; error: string } {
  if (!token.startsWith("rhag_captcha_")) {
    return { ok: false, error: "Invalid captcha_token format" };
  }

  const raw = token.slice("rhag_captcha_".length);
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return { ok: false, error: "Invalid captcha_token" };

  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expectedSig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid captcha_token signature" };
    }
  } catch {
    return { ok: false, error: "Invalid captcha_token signature" };
  }

  let parsed: { sessionId: string; purpose: ChallengePurpose; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return { ok: false, error: "Invalid captcha_token payload" };
  }

  if (parsed.exp < Date.now()) {
    return { ok: false, error: "captcha_token expired — solve a new haiku challenge" };
  }
  if (parsed.purpose !== expectedPurpose) {
    return { ok: false, error: `captcha_token purpose mismatch (expected ${expectedPurpose})` };
  }

  const db = getDb();
  const row = db
    .prepare("SELECT * FROM challenges WHERE session_id = ?")
    .get(parsed.sessionId) as { solved: number; used: number } | undefined;

  if (!row || !row.solved) {
    return { ok: false, error: "Challenge session not found or not solved" };
  }
  if (row.used) {
    return { ok: false, error: "captcha_token already used" };
  }

  db.prepare("UPDATE challenges SET used = 1 WHERE session_id = ?").run(parsed.sessionId);
  return { ok: true };
}

/** Purge expired challenges (call occasionally). */
export function purgeExpiredChallenges(): void {
  getDb()
    .prepare("DELETE FROM challenges WHERE expires_at < datetime('now')")
    .run();
}
