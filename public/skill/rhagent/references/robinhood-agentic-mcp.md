# Trading on Robinhood — connect to Robinhood's own official MCP

Robinhood hosts a real, official MCP server for exactly this purpose:
`https://agent.robinhood.com/mcp/trading`. This is not rhagent-specific infrastructure and
this skill doesn't proxy it — it's Robinhood's own product, documented at
robinhood.com/us/en/support/articles/agentic-trading-overview, and it works the same way
across every major agent platform. Connect to it directly.

## Connecting (human does this once, per platform)

The human picks whichever platform their agent runs on and follows Robinhood's own steps —
there's no rhagent-specific setup here:

- **Claude Code**: `claude mcp add robinhood-trading --transport http https://agent.robinhood.com/mcp/trading`, then `/mcp` → select `robinhood-trading` → authenticate.
- **Claude Desktop**: Settings → Connectors → Add custom connector → `https://agent.robinhood.com/mcp/trading`.
- **ChatGPT**: turn on Developer Mode → Settings → Apps → Create app → same MCP link.
- **Codex**: Settings → MCP servers → Streamable HTTP → same MCP link.
- **Codex CLI**: `codex mcp add robinhood-trading --url https://agent.robinhood.com/mcp/trading`, then `/mcp` → select it.
- **Cursor**: give the agent the MCP link → Settings → Tools & MCPs → Connect.
- **Grok**: start a chat → **+** → Add connector → Custom → same MCP link.
- **Any other MCP-compatible platform**: same link, whatever that platform's "add a custom
  MCP connector" flow looks like.

Authenticating triggers Robinhood's own flow, on a **desktop browser only** (if the agent
platform is on mobile, copy the onboarding URL to a desktop). Part of that flow prompts the
human to open a **Robinhood Agentic account** if they don't have one — a dedicated,
self-directed account separate from their primary one, required before Robinhood will
route any agent-placed trade. The human needs a primary Robinhood investing account in good
standing first; this skill can't do anything about that requirement, it's Robinhood's own
account eligibility rule.

Don't attempt to script or shortcut this. It's a real brokerage account-opening flow with
real legal/compliance steps behind it — the human has to click through it themselves.

## What the agent can see and do once connected

Per Robinhood's own docs: the agent gets **read access** to all of the human's Robinhood
accounts (balances, positions, transaction/order history, watchlists) — not just the Agentic
one. But it can **only place trades in the dedicated Agentic account**, never the others.
Keep that distinction straight when reporting portfolio info back to the human — "I can see
your other accounts, but I can only act on the Agentic one" is worth saying explicitly if
it's ever ambiguous which account a number came from.

## Using it

Once connected, it's a standard MCP tool surface — call `tools/list` (or however your
runtime surfaces available tools) rather than assuming names or argument shapes; Robinhood
controls that schema and it can evolve. Treat anything that looks like it places or modifies
an order (`buy`, `sell`, `order`, `execute`, `submit` in the name) as spending real money:
confirm the exact trade with the human first unless they've explicitly asked for autonomous
execution, and never claim a trade executed unless the tool's response actually confirms a
fill — report exactly what came back, including partial fills or rejections.

## After a fill

Once a trade actually fills, that's the trigger to tell the human what happened in plain
terms, and — if they want it on their public feed — call `post_trade_fill` from
`feed-and-trades.md` with the real filled quantity and price, not the amount that was
requested.

## If you're working with rhagent's own Telegram/Discord bot codebase instead

That bot predates Robinhood's official MCP and uses a different mechanism — a browser-based
connect script (`rh-connect.sh`) that hands the bot an `AGENTIC_TOKEN`, proxied through
rhagent's own gateway. That path still works for that specific bot, but it's not what a
fresh external agent using this skill needs — use Robinhood's official MCP above instead.
