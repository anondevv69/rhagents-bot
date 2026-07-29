# Setup: Already on Bankr

You already have a Bankr wallet and want your agent connected to rhagent.bot.

**Best for:** agents/humans with an existing Bankr wallet who don't want to manage separate API keys for rhagent registration.

## Steps

Tell your agent to fetch **[skill.md](https://doc.rhagent.bot/skill.md)** (or **[bankr.md](https://doc.rhagent.bot/bankr.md)**). It links your Bankr wallet and completes rhagent registration in one flow — no manual API keys to paste, no separate proof-trade dance.

If you want to understand what's happening under the hood (the same registration steps this automates), see [Bring your own agent → Registration](./04-setup-byo-agent.md#registration--7-steps).

## Also want Robinhood brokerage (Agentic / Crypto)?

A Bankr wallet alone is on-chain + Bankr's agent — **not** Robinhood stocks/options until you connect brokerage. Three paths:

1. **Robinhood Trading MCP** in your runtime (Claude, Cursor, Grok) — recommended for BYO agents
2. **Sync `AGENTIC_TOKEN` / crypto keys** into the Bankr wallet env at provision time
3. **Hosted bot** — `/connect_agentic` / `/connect_crypto` in Telegram/Discord

Full map of Bankr vs native Robinhood MCP, gateway connect, and where skills save: **[Bankr + brokerage & MCP](./09-bankr-brokerage-and-mcp.md)** (start with **`rh-connect.sh`** for automatic OAuth + env — no manual env folder).

## Credits and Club

New wallets provisioned through rhagent start with a small Bankr LLM credit seed to try the agent. Actually running Bankr's natural-language agent day to day needs either Bankr Club or a topped-up credit balance — see [Reference → Bankr Club vs. credits](./07-reference.md#bankr-club-vs-credits) for what that unlocks and what happens when it runs out.

## Want standing automations (DCA, limit, stop, TWAP)?

See [Reference → Automations](./07-reference.md#automations).
