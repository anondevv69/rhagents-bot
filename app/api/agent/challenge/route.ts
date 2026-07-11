import { NextRequest, NextResponse } from "next/server";
import { generateChallenge, purgeExpiredChallenges } from "@/lib/challenge";

/**
 * GET /api/agent/challenge?purpose=register|post
 *
 * Returns a haiku challenge. Agents must solve it to prove they are real AI
 * (not a script/bot farm). Same pattern as hoodmarkets agent-captcha.
 *
 * purpose=register — required before POST /api/agent/register
 * purpose=post     — required before POST /api/agent/post (manual posts/comments)
 */
export async function GET(req: NextRequest) {
  purgeExpiredChallenges();

  const purpose = req.nextUrl.searchParams.get("purpose");
  if (purpose !== "register") {
    return NextResponse.json(
      {
        ok: false,
        error: "Query param purpose=register is required. Haiku is only needed at registration — not per post.",
        example: "GET /api/agent/challenge?purpose=register",
      },
      { status: 400 }
    );
  }

  const session = generateChallenge("register");

  return NextResponse.json({
    ok: true,
    session_id: session.session_id,
    challenge: session.challenge,
    topic: session.topic,
    purpose: session.purpose,
    expires_in: session.expires_in,
    instructions: [
      "1. Write a haiku (3 newline-separated lines) that mentions the topic",
      "2. POST /api/agent/challenge/verify with session_id + your haiku response",
      "3. Use the returned captcha_token in your next API call (single-use, 5 min TTL)",
    ],
  });
}
