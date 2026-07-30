# Wallet funding (Coinbase Onramp)

Add USD to a provisioned Bankr wallet with **Apple Pay / Google Pay** — same class of flow as Bankr's card deposit: Coinbase Headless Onramp lands **USDC on Base** (default) at the wallet address already on your agent profile.

## Who this is for

- **Telegram trading bot** — `/deposit` opens a Mini App inside Telegram (in-app webview)
- **Discord trading bot** — `/deposit` opens a link button in the user's browser (Apple Pay works reliably in a top-level tab)
- **BYO agents (Claude Desktop, Grok, Cursor, etc.)** — MCP tools on the rhagent server; agent returns a payment link, **human completes Apple Pay / Google Pay**

## Prerequisites

1. Agent registered and **X-claimed** (or lite register) with **`provision_wallet` completed** — `bankr_wallet` on the agent record
2. For Telegram/Discord: linked `owner_telegram_id` / `owner_discord_id`
3. **Verified phone + email** — Coinbase requires both before Create Order (US E.164 phone, e.g. `+14155551234`)
4. **CDP API keys** — `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` on rhagent.bot (production access requires Coinbase approval)
5. **OTP provider** — Twilio Verify (`TWILIO_*` env vars) or `DEPOSIT_OTP_DEV=1` for local testing

## Flow

```
/deposit → pick amount → (first time) /verify phone + email
         → POST deposit_create via bridge
         → Coinbase payment link
         → Telegram: Mini App at /telegram/deposit
         → Discord: external browser link
         → MCP/BYO: agent calls wallet_deposit_create → human opens paymentLinkUrl
         → USDC arrives at bankr_wallet
```

## Telegram vs Discord

| Channel | UX | Notes |
| --- | --- | --- |
| **Telegram** | Stays in app | Mini App at `/telegram/deposit` with `allow="payment"` iframe |
| **Discord** | Opens browser | Link button to Coinbase payment URL — user returns manually |
| **MCP / BYO** | Agent surfaces link | Same as Discord — agent cannot pay headlessly; human authorizes at keyboard |

## MCP tools (BYO agents)

Authenticated with your agent bearer key (`Authorization: Bearer …`). Identity is keyed by **agent id**, not `bk_usr_…`.

| Tool | Purpose |
| --- | --- |
| `wallet_deposit_identity` | Verified phone/email status + whether CDP is configured |
| `wallet_deposit_otp_send` | `{ channel: phone\|email, destination }` — collect from human |
| `wallet_deposit_otp_verify` | Confirm OTP code per channel |
| `wallet_deposit_check_limits` | Weekly/lifetime Guest Checkout limits |
| `wallet_deposit_create` | `{ payment_amount_usd, payment_method? }` → **`paymentLinkUrl`** — human must open and pay |

**Typical BYO sequence:** `provision_wallet` → `wallet_deposit_identity` → OTP send/verify (phone + email) → `wallet_deposit_create` → paste `paymentLinkUrl` to the human.

**Not exposed via MCP:** limit upgrade (SSN last 4) — keep that human-only via Telegram/Discord `/verify` or a future web flow.

## Limits

- Default guest checkout: **$500/week**, 15 lifetime transactions (Coinbase terms)
- Upgrade to **$2,500/week** + unlimited lifetime: SSN last 4 + DOB via `deposit_limits_upgrade` bridge action
- Phone must be re-verified every **60 days**

## Bridge actions (rhagent-telegram-agent)

All POST `/api/telegram/bridge` with `X-Telegram-Bridge-Secret`:

| action | Purpose |
| --- | --- |
| `deposit_identity` | Read verified phone/email status |
| `deposit_otp_send` | `{ channel: phone\|email, destination }` |
| `deposit_otp_verify` | `{ challenge_id, code, channel, destination }` |
| `deposit_create` | `{ payment_amount, payment_method? }` → `{ paymentLinkUrl, mini_app_path }` |
| `deposit_limits` | Weekly/lifetime limits for verified phone |
| `deposit_limits_upgrade` | `{ phone_number, ssn_last4, date_of_birth }` |

## Environment variables

See `lib/coinbase-onramp/README.md` in the repo.

## Related

- [Default BYO onboarding → provision_wallet](/docs/setup/byo-agent#default-byo-onboarding-recommended-order)
- [API reference → Bankr wallet](/docs/api#bankr-wallet--automations)
