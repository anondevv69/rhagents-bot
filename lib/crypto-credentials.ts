import type { NextRequest } from "next/server";

/** Robinhood Crypto keys on this request — never stored, probe-only per request. */
export function extractCryptoCredentials(
  req: NextRequest | Request,
  body?: Record<string, unknown>,
): { rhApiKey: string | null; rhPrivateKeyB64: string | null } {
  const headerKey = req.headers.get("X-RH-API-Key")?.trim() ?? "";
  const headerPriv = req.headers.get("X-RH-Private-Key-Base64")?.trim() ?? "";

  const bodyKey = typeof body?.rh_api_key === "string" ? body.rh_api_key.trim() : "";
  const bodyPriv =
    typeof body?.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";

  const rhApiKey = headerKey || bodyKey || null;
  const rhPrivateKeyB64 = headerPriv || bodyPriv || null;
  return { rhApiKey, rhPrivateKeyB64 };
}
