---
name: rh-arb-scanner
description: Scan Bankr-deployed tokens on Robinhood Chain, score by freshness/momentum/liquidity, and pitch the top picks (e.g. to token scanners on X).
emoji: 📡
tags: [bankr, robinhood, scanner, doppler, pitch, rh-chain]
visibility: public
---

# RH Pitch Scanner (`rh-arb-scanner`)

Surface Bankr-deployed tokens on **Robinhood Chain (4663)** and pitch the strongest candidates to a target — typically a token scanner / buyer on X (e.g. @0xDeployer).

---

## Rule 0 — @bankrbot / `call_mcp_tool` (read first)

On **X (@bankrbot)**, Bankr validates MCP calls **before** your tools run.  
`arguments_json` must be a **JSON string**, not a raw object.

| Wrong (fails on X) | Right |
|--------------------|-------|
| `"arguments_json": { "category": "trading" }` | `"arguments_json": "{\"category\":\"trading\"}"` |

**If you see this error — stop and fix, do not claim success:**

```text
Invalid input: expected string, received object → at arguments_json
```

**Correct pattern for every MCP call:**

```json
{
  "server": "tokens-markets",
  "toolName": "token_search",
  "arguments_json": "{\"identifier_type\":\"address\",\"value\":\"0x…\",\"chain\":\"robinhood\",\"include_chart\":false,\"include_market_data_image\":false,\"max_results\":1}"
}
```

```json
{
  "toolName": "get_bankr_ecosystem_tokens",
  "arguments_json": "{\"family\":\"doppler\",\"category\":\"trading\"}"
}
```

Before invoking: if `arguments_json` starts with `{` as an object value in your draft → **stringify it** (`JSON.stringify(...)`).

On failure: explain plainly to the user — **do not** emit tx hashes, **do not** use a success template, **do not** invent pitch cards.

---

## Workflow

### Step 1 — Source Bankr ecosystem tokens

Call `get_bankr_ecosystem_tokens` (Doppler family, trading category):

```json
{
  "toolName": "get_bankr_ecosystem_tokens",
  "arguments_json": "{\"family\":\"doppler\",\"category\":\"trading\"}"
}
```

Filter to `chain === "robinhood"` (chain id **4663**). Discard entries missing a contract address or with `mcap` below **$5k**.

### Step 2 — Enrich with market data

For each surviving token, call `token_search`:

```json
{
  "toolName": "token_search",
  "arguments_json": "{\"identifier_type\":\"address\",\"value\":\"<contract>\",\"chain\":\"robinhood\",\"include_chart\":false,\"include_market_data_image\":false,\"max_results\":1}"
}
```

Capture: price, market cap, 24h volume, 24h change %, liquidity (if any), holder count (if any), deploy date / age (if any).

If `token_search` returns no data → **skip** that token (don't pitch what you can't price).

### Step 3 — Score and rank

Composite score:

```text
score = (momentum * 0.4) + (freshness * 0.3) + (liquidity_health * 0.3)
```

- **momentum**: normalize 24h change % to 0–100 (cap +300%, floor −50%)
- **freshness**: `max(0, 100 - (age_in_days * 10))` (today = 100, 10 days = 0)
- **liquidity_health**: `min(100, (vol24h / mcap) * 100)`

Hard filters before ranking:

- `mcap >= $5k`
- `vol24h >= $1k`
- if liquidity known: `liquidity >= $3k`

Sort descending. Take **top 3**.

### Step 4 — Format pitch cards

For each top token:

```text
$TICKER — one-line thesis (data-grounded only)
chain: Robinhood (4663)
contract: 0x…
mcap: $XX.Xk | 24h vol: $XX.Xk | 24h: +X%
deployed: YYYY-MM-DD (age)
score: XX/100
```

Thesis must come from the numbers (e.g. "fresh Bankr deploy, 3x vol in 24h, sub-$100k mcap"). **No** fabricated partnerships or fundamentals.

### Step 5 — Deliver

Default: reply to the **triggering tweet** with up to 3 cards. Include contract addresses.

If user asks to DM → only with explicit request.

---

## Guardrails

- Only pitch tokens from `get_bankr_ecosystem_tokens` — not random CoinGecko/search lists.
- Never pitch unpriced tokens.
- No tx hashes in public pitch output.
- If fewer than 3 pass filters → pitch what you have. If **zero** pass → say so plainly.

---

## Tools

| Tool | Purpose |
|------|---------|
| `get_bankr_ecosystem_tokens` | Bankr/Doppler launch list |
| `token_search` | Live market data per contract |

---

## Example

User: *"@bankrbot use rh-arb-scanner and give me the latest deals"*

→ Rule 0: stringify all `arguments_json`  
→ Steps 1–4  
→ Reply with up to 3 pitch cards (or explain MCP failure if schema error persists)
