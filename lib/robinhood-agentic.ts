/**
 * Validate Robinhood Agentic stock tickers via MCP get_equity_quotes.
 * Uses the agent's own AGENTIC_TOKEN (passed per request) — not a server secret.
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const MCP_ACCEPT = "application/json, text/event-stream";

const okCache = new Map<string, number>();

export type QuoteValidation = "valid" | "invalid" | "unknown";

/** Parse JSON or SSE (text/event-stream) MCP responses from the gateway. */
export function parseMcpHttpBody(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through to SSE */
    }
  }

  const dataLines: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      const payload = t.slice(5).trim();
      if (payload && payload !== "[DONE]") dataLines.push(payload);
    }
  }

  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]!);
    } catch {
      continue;
    }
  }

  return trimmed;
}

function walkText(node: unknown): string {
  const chunks: string[] = [];
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      chunks.push(v);
      try {
        walk(JSON.parse(v));
      } catch {
        /* plain text */
      }
      return;
    }
    if (typeof v === "object") {
      if (Array.isArray(v)) {
        for (const item of v) walk(item);
        return;
      }
      for (const val of Object.values(v as Record<string, unknown>)) walk(val);
    }
  };
  walk(node);
  return chunks.join("\n");
}

function hasQuotePrice(text: string): boolean {
  if (/\$?\d+\.?\d*/.test(text)) return true;
  return ["LAST", "PRICE", "QUOTE", "BID", "ASK", "CLOSE", "MARK"].some((k) => text.includes(k));
}

/** Classify MCP get_equity_quotes payload — unknown = transport/parse/auth, not "bad ticker". */
export function classifyEquityQuote(payload: unknown, symbol: string): QuoteValidation {
  if (payload == null) return "unknown";
  if (typeof payload === "string") {
    const upper = payload.toUpperCase();
    if (upper.includes("JWT") && upper.includes("FAIL")) return "unknown";
    return classifyEquityQuote(parseMcpHttpBody(payload), symbol);
  }
  if (typeof payload !== "object") return "unknown";

  const obj = payload as Record<string, unknown>;
  if (obj.error) return "unknown";

  const result = obj.result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.isError === true) return "invalid";
  }

  const text = walkText(payload).toUpperCase();
  const sym = symbol.toUpperCase();
  if (!text.includes(sym)) return "invalid";

  const bad = [
    "NOT FOUND",
    "INVALID SYMBOL",
    "UNKNOWN SYMBOL",
    "NO QUOTE",
    "UNRECOGNIZED",
    "COULD NOT FIND",
    "DOES NOT EXIST",
    "NOT TRADABLE",
  ];
  if (bad.some((b) => text.includes(b))) return "invalid";

  if (hasQuotePrice(text)) return "valid";
  if (text.includes("HAS_TRADED") || text.includes('"ACTIVE"')) return "valid";

  return "unknown";
}

export function equityQuoteValid(payload: unknown, symbol: string): boolean {
  return classifyEquityQuote(payload, symbol) === "valid";
}

type McpRawResult = {
  status: number;
  body: unknown;
  sessionId: string | null;
};

async function agenticMcpRaw(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  sessionId: string | null = null,
): Promise<McpRawResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: MCP_ACCEPT,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(`${GW}/v1/agentic/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  const body = parseMcpHttpBody(text);
  const nextSession =
    res.headers.get("Mcp-Session-Id") ?? res.headers.get("mcp-session-id") ?? sessionId;

  return { status: res.status, body, sessionId: nextSession };
}

/** MCP tool call with session + SSE parsing (shared by validate + capability probe). */
export async function callAgenticMcpTool(
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; body: unknown }> {
  if (!token || token.length < 10) {
    return { ok: false, status: 401, body: { error: "token_missing" } };
  }

  const sessionId = await openAgenticSession(token);
  const call = await agenticMcpRaw(
    token,
    "tools/call",
    { name, arguments: args },
    sessionId,
  );

  if (call.status === 401 || call.status === 403) {
    return { ok: false, status: call.status, body: call.body };
  }
  if (call.status >= 400) {
    return { ok: false, status: call.status, body: call.body };
  }
  return { ok: true, body: call.body };
}

async function openAgenticSession(token: string): Promise<string | null> {
  const init = await agenticMcpRaw(token, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "rhagents-validate", version: "1" },
  });

  if (init.status === 401 || init.status === 403) return null;
  if (init.status >= 400) return null;

  const sessionId = init.sessionId;
  if (sessionId) {
    await agenticMcpRaw(token, "notifications/initialized", {}, sessionId);
  }
  return sessionId;
}

async function agenticQuoteCall(token: string, symbol: string): Promise<unknown> {
  const result = await callAgenticMcpTool(token, "get_equity_quotes", { symbols: [symbol] });
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      return { error: "token_rejected", status: result.status, detail: result.body };
    }
    return null;
  }
  return result.body;
}

/** True if Robinhood MCP confirms a real equity quote for this ticker using the agent's token. */
export async function validateRobinhoodAgenticSymbolWithToken(
  symbol: string,
  agenticToken: string,
): Promise<boolean> {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return false;
  if (!agenticToken || agenticToken.length < 10) return false;

  const now = Date.now();
  const okAt = okCache.get(sym);
  if (okAt && now - okAt < LOOKUP_TTL_MS) return true;

  try {
    const body = await agenticQuoteCall(agenticToken, sym);
    const verdict = classifyEquityQuote(body, sym);

    if (verdict === "valid") {
      okCache.set(sym, now);
      return true;
    }

    // unknown = parse/auth/transport — do not negative-cache (token may work locally)
    return false;
  } catch {
    return false;
  }
}
