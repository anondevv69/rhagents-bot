import type { NextRequest } from "next/server";

/** Agent's Robinhood Agentic bearer — never stored, probe-only per request. */
export function extractAgenticToken(
  req: NextRequest | Request,
  body?: Record<string, unknown>,
): string | null {
  const header = req.headers.get("X-Agentic-Token")?.trim();
  if (header && header.length >= 10) return header;

  const fromBody =
    typeof body?.agentic_token === "string" ? body.agentic_token.trim() : "";
  if (fromBody.length >= 10) return fromBody;

  return null;
}
