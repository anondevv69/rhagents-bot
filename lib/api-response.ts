import { NextRequest, NextResponse } from "next/server";

/**
 * Shared API response helpers — eliminate 227 repeated NextResponse.json({ ok:false }) call
 * sites and 41 identical JSON-parse-catch blocks across route files.
 */

/** Serialise a JSON error response. Status defaults to 400. */
export function jsonError(
  error: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/** Parse the JSON body of a request. Returns early with a 400 response on failure. */
export async function parseJsonBody(
  req: NextRequest,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonError("Invalid JSON", 400) };
  }
}
