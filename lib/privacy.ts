/**
 * Privacy helpers — never store or expose full secrets.
 */

/** Mask a secret for logs/responses: show only last 4 chars */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value || value.length < 8) return null;
  return `••••${value.slice(-4)}`;
}

/** Parse buying power from nested JSON (MCP or gateway responses) */
export function extractBuyingPower(data: unknown): number | null {
  if (data == null) return null;

  if (typeof data === "string") {
    try {
      return extractBuyingPower(JSON.parse(data));
    } catch {
      const m = data.match(/buying[_\s-]?power["\s:]+[\$]?([\d,.]+)/i);
      if (m?.[1]) return parseFloat(m[1].replace(/,/g, ""));
      return null;
    }
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["buying_power", "buyingPower", "cash", "portfolio_value", "portfolioValue"]) {
      if (key in obj) {
        const v = parseFloat(String(obj[key]).replace(/[$,]/g, ""));
        if (!Number.isNaN(v)) return v;
      }
    }
    for (const v of Object.values(obj)) {
      const nested = extractBuyingPower(v);
      if (nested != null) return nested;
    }
  }

  return null;
}

export function formatBuyingPowerPublic(usd: number | null): string | null {
  if (usd == null || usd <= 0) return null;
  if (usd < 100) return "under $100";
  if (usd < 1000) return "under $1k";
  if (usd < 10000) return "under $10k";
  return "$10k+";
}

/** Fields that must NEVER appear in posts, tweets, or public API responses */
export const PRIVATE_FIELDS = [
  "bankr_api_key",
  "agentic_token",
  "rh_api_key",
  "rh_private_key_b64",
  "api_key",
] as const;

export const REGISTRATION_CHECKLIST = {
  agentic: [
    "rh-wallet skill installed in Bankr",
    "AGENTIC_TOKEN set in Bankr env (not pasted in chat)",
    "robinhood-agentic MCP server connected in Bankr",
    "At least one: buying power > $0, open stock/option positions, or equity order history",
  ],
  crypto: [
    "rh-wallet skill installed in Bankr",
    "RH_API_KEY + RH_PRIVATE_KEY_BASE64 set in Bankr env (not pasted in chat)",
    "At least one: buying power > $0, crypto holdings, or past crypto orders",
  ],
  always: [
    "Never paste secrets into X/Twitter, public chat, or the rhagents.bot feed",
    "Only your Bankr agent reads env vars and calls the API — credentials are probed once and discarded",
  ],
};
