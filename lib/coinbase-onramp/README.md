# Coinbase Headless Onramp — rhagent.bot

Fund provisioned Bankr wallets via Apple Pay / Google Pay (Coinbase Guest Checkout / Headless Onramp).

## Layout

| Path | Purpose |
| --- | --- |
| `lib/coinbase-onramp/onramp-client.ts` | CDP JWT + Create Order / Limits / Upgrade |
| `lib/coinbase-onramp/wallet-lookup.ts` | Maps Telegram/Discord user → `agents.bankr_wallet` |
| `lib/coinbase-onramp/identity-store.ts` | SQLite verified contact + OTP challenges |
| `lib/coinbase-onramp/identity-verification.ts` | Twilio Verify or `DEPOSIT_OTP_DEV` |
| `lib/coinbase-onramp/deposit-routes.ts` | Core handlers |
| `lib/coinbase-onramp/deposit-bridge.ts` | Telegram/Discord bridge action adapters |
| `app/api/bankr/deposit/*` | HTTP routes (bridge-auth only) |
| `app/api/telegram/bridge` | `deposit_*` actions |
| `public/telegram/deposit/index.html` | Telegram Mini App |

## Env vars

```bash
CDP_API_KEY_ID=organizations/.../apiKeys/...
CDP_API_KEY_SECRET="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
COINBASE_ONRAMP_NETWORK=base          # default
COINBASE_ONRAMP_ASSET=USDC            # default
COINBASE_ONRAMP_SANDBOX=1             # prefix partnerUserRef with sandbox-
TELEGRAM_MINIAPP_BASE=https://rhagent.bot/telegram/deposit

# OTP — pick one:
DEPOSIT_OTP_DEV=1                     # logs 6-digit code to server console
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```

## rhagent-telegram-agent integration

Wire `/deposit` and `/verify` commands to call rhagentsite bridge:

```typescript
await fetch("https://rhagent.bot/api/telegram/bridge", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Telegram-Bridge-Secret": process.env.TELEGRAM_BRIDGE_SECRET!,
  },
  body: JSON.stringify({
    action: "deposit_create",
    platform: "telegram",
    telegram_id: String(ctx.from.id),
    payment_amount: "25",
  }),
});
```

Telegram: reply with `web_app` button using `mini_app_path` from response.
Discord: reply with link button using `paymentLinkUrl`.

## Not implemented here

- Telegram/Discord command handlers live in **rhagent-telegram-agent** (separate repo/service)
- End-to-end sandbox payment test against live Coinbase + real Telegram client
- Automatic `$500 → $2,500` upgrade prompt UX

## Docs

[doc.rhagent.bot/docs/reference/wallet-funding](/docs/reference/wallet-funding)
