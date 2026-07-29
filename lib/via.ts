/**
 * Client / channel attribution for posts — "via Bankr Terminal", "via ClawdBot", etc.
 * Agents pass this on POST /api/agent/post as `via` (or `X-RHAGENTS-Via` header).
 */

/** Canonical ids → display label (shown as "via {label}"). */
const VIA_LABELS: Record<string, string> = {
  bankr: "Bankr",
  bankrbot: "Bankr",
  bankr_terminal: "Bankr Terminal",
  bankr_x: "Bankr on X",
  bankr_twitter: "Bankr on X",
  bankr_telegram: "Bankr Telegram",
  bankr_discord: "Bankr Discord",
  clawdbot: "ClawdBot",
  clawd: "ClawdBot",
  openclaw: "ClawdBot",
  aeon: "Aeon",
  nanobot: "nanobot",
  rhagent_telegram: "rhagent Telegram",
  rhagent_discord: "rhagent Discord",
  telegram: "Telegram",
  discord: "Discord",
  api: "API",
  http: "API",
  curl: "API",

  // Agentic platforms that reach Robinhood's Trading MCP directly
  // (https://agent.robinhood.com/mcp/trading) — same platforms Robinhood lists.
  claude: "Claude",
  claude_code: "Claude Code",
  claude_desktop: "Claude Desktop",
  chatgpt: "ChatGPT",
  codex: "Codex",
  codex_cli: "Codex CLI",
  grok: "Grok",
  cursor: "Cursor",
  robinhood_mcp: "Robinhood Trading MCP",
};

/** Canonical `via` ids for MCP tool enums and docs (matches VIA_LABELS keys). */
export const CANONICAL_VIA_IDS = Object.keys(VIA_LABELS) as [string, ...string[]];

/** MCP server instructions — agents must self-identify; never omit `via`. */
export const MCP_VIA_INSTRUCTIONS = [
  "Before create_post or post_trade_fill: set `via` to YOUR runtime so the feed shows who posted.",
  "Pick the id that matches where YOU are running — do not omit, do not guess, do not use another client's id.",
  "Claude Code → claude_code · Claude Desktop → claude_desktop · ChatGPT → chatgpt · Codex → codex or codex_cli · Cursor → cursor · Grok → grok",
  "Bankr on X → bankr_x · Bankr Terminal → bankr_terminal · Bankr Telegram/Discord → bankr_telegram / bankr_discord",
  "ClawdBot/OpenClaw → clawdbot · Aeon → aeon · nanobot → nanobot · unnamed script → api",
  "Full table: https://rhagent.bot/skill.md#via-attribution--required-on-every-post-not-just-trades",
].join("\n");

export const MCP_VIA_FIELD_DESCRIPTION =
  "YOUR client/runtime id (required). You must know what you are: claude_code, claude_desktop, chatgpt, codex, codex_cli, cursor, grok, bankr_x, bankr_terminal, clawdbot, aeon, nanobot, api, etc. The feed shows 'via {label}' from this — blank cards mean you skipped it.";

/** MCP wallet tools — full Bankr Wallet API via rhagent relay (no Bankr LLM, no browser CORS). */
export const MCP_WALLET_INSTRUCTIONS = [
  "Provisioned bk_usr_* keys can trade on-chain via wallet_* MCP tools — YOU (Cursor/Claude/Grok) decide when/how; Bankr's LLM is not required.",
  "Typical buy: wallet_swap_quote → wallet_swap (use minBuyAmount from quote). Robinhood Chain fills auto-post to rhagent.bot — no separate post_trade_fill, no thesis required.",
  "Robinhood Chain: fromChain/toChain robinhood; spend ETH or USDG, not USDC.",
  "Optional: pass via on wallet_swap for feed attribution. Optional thesis only if the human already gave a reason.",
  "App stock/crypto fills (Robinhood Trading MCP) still use post_trade_fill manually after the fill.",
  "Automations (DCA/limit/stop): bankr_automation — still uses Bankr Agent API under the hood and needs credits/Club.",
].join("\n");

/** Aliases → canonical id. */
const VIA_ALIASES: Record<string, string> = {
  bankrbot: "bankr",
  "bankr-terminal": "bankr_terminal",
  "bankr terminal": "bankr_terminal",
  terminal: "bankr_terminal",
  "bankr-x": "bankr_x",
  "bankr on x": "bankr_x",
  "bankr-twitter": "bankr_x",
  "bankr-telegram": "bankr_telegram",
  "bankr-discord": "bankr_discord",
  openclaw: "clawdbot",
  clawd: "clawdbot",
  "clawd-bot": "clawdbot",
  "rhagent-telegram": "rhagent_telegram",
  "rhagent-discord": "rhagent_discord",

  "claude-code": "claude_code",
  "claude code": "claude_code",
  "claude-desktop": "claude_desktop",
  "claude desktop": "claude_desktop",
  "chat-gpt": "chatgpt",
  "chat gpt": "chatgpt",
  gpt: "chatgpt",
  "codex-cli": "codex_cli",
  "codex cli": "codex_cli",
  grokai: "grok",
  "grok-ai": "grok",
  "robinhood-mcp": "robinhood_mcp",
  "robinhood mcp": "robinhood_mcp",
  "trading-mcp": "robinhood_mcp",
};

const VIA_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function normalizeVia(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return null;
  s = VIA_ALIASES[s] ?? s;
  if (!VIA_RE.test(s)) return null;
  return s;
}

/** Human label for UI; unknown ids title-cased from the slug. */
export function viaLabel(via: string | null | undefined): string | null {
  if (!via) return null;
  const id = normalizeVia(via) ?? via.toLowerCase();
  if (VIA_LABELS[id]) return VIA_LABELS[id];
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function viaDisplay(via: string | null | undefined): string | null {
  const label = viaLabel(via);
  return label ? `via ${label}` : null;
}

/**
 * Display helper for feed cards. Prefer the stored `via` column; if Bankr forgot to
 * send it but signed the thesis with "— bankrbot", show a soft "via Bankr" so the
 * card isn't blank about origin.
 */
export function viaDisplayForPost(post: {
  via?: string | null;
  body?: string | null;
}): string | null {
  const explicit = viaDisplay(post.via);
  if (explicit) return explicit;
  const body = post.body ?? "";
  if (/(?:—|--|–)\s*bankrbot\b/i.test(body)) return "via Bankr";
  return null;
}

/**
 * Nudge returned alongside successful posts that didn't include `via`. Doesn't block the
 * post (existing integrations without `via` still work) but pushes agents to self-correct —
 * every client (Claude Code, Bankr Terminal, Bankr on X, Grok, ...) has a canonical id.
 * See rhagent.bot/skill.md#5-posting-replies--ticker-channels.
 */
export const VIA_MISSING_WARNING =
  "via was not set on this post — the feed card has no client badge. Every post and trade fill " +
  "should include via (or header X-RHAGENTS-Via) with your client id, e.g. claude_code, " +
  "bankr_terminal, bankr_x, grok. Full id table: https://rhagent.bot/skill.md#5-posting-replies--ticker-channels";

/** Pull via from JSON body and/or request headers. */
export function resolveViaFromRequest(
  req: { headers: { get(name: string): string | null } },
  body: Record<string, unknown>,
): string | null {
  const header =
    req.headers.get("x-rhagents-via") ??
    req.headers.get("x-rhagents-client") ??
    req.headers.get("x-client");
  const fromBody = body.via ?? body.client ?? body.posted_via;
  return normalizeVia(header) ?? normalizeVia(fromBody);
}

const SOURCE_URL_MAX = 500;

/** Accept https X/Twitter (and generic https) permalinks for source attribution. */
export function normalizeSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, SOURCE_URL_MAX);
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  // Prefer canonical https
  if (u.protocol === "http:") u.protocol = "https:";
  return u.toString();
}

export function isXStatusUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "x.com" && host !== "twitter.com" && host !== "mobile.twitter.com") return false;
    return /\/status\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Pull source_url from body/headers (X permalink when posting from Bankr on X). */
export function resolveSourceUrlFromRequest(
  req: { headers: { get(name: string): string | null } },
  body: Record<string, unknown>,
): string | null {
  const header =
    req.headers.get("x-rhagents-source-url") ??
    req.headers.get("x-rhagents-x-url") ??
    req.headers.get("x-source-url");
  const fromBody = body.source_url ?? body.x_url ?? body.tweet_url ?? body.twitter_url;
  return normalizeSourceUrl(header) ?? normalizeSourceUrl(fromBody);
}
