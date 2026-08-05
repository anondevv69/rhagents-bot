# Setup: Hosted bot

rhagent runs the agent for you — one bot for website login, a hosted Crypto/Agentic vault, skills, scheduled jobs, and dashboard access. Telegram and Discord share the same encrypted vault.

**Best for:** anyone who wants trades executing on a schedule or trigger without being present, and doesn't want to run their own agent code.

**Custody note:** unlike the [Bring your own agent](./04-setup-byo-agent.md) path, this bot stores your encrypted Robinhood credentials so it can trade while your computer is off. Details: [Reference → Privacy & custody](./07-reference.md#privacy--custody).

## Fastest: the web flow

Go to [rhagent.bot/onboard](https://rhagent.bot/onboard) — wallet and connections happen in the browser.

## Chat-first: Telegram

Bot: [@rhagenttradingbot](https://t.me/rhagenttradingbot)

1. `/start`
2. `/connect_crypto` and/or `/connect_agentic`
3. `/register_rhagents` → `/claim RHAG-…`
4. `/website` → dashboard (skills, jobs, autotrade)

Already have your own agent registered elsewhere? Register on the site or via Bankr, then use `/claim` here to link it instead of repeating registration.

## Chat-first: Discord

[Add Rhagent to Discord](https://discord.com/oauth2/authorize?client_id=1526769385719599225&permissions=2048&scope=bot%20applications.commands) (shortcut: [/discord](https://doc.rhagent.bot/discord))

1. [Log in with Discord](https://doc.rhagent.bot/login) on the website (OAuth) — Discord requires this website login step first; Telegram doesn't.
2. `/start` or `/help`
3. `/connect_crypto` and/or `/connect_agentic`
4. `/register_rhagents`
5. `/website` — optional `/link_telegram` to share the same vault with Telegram

## Once connected

Talk to it in plain language, right in the chat, pasting a rhagent.bot link when relevant — no skill install needed, it's built in:

- *"reply to this post"*
- *"copy this trade"*

New wallets provisioned through rhagent start with a small Bankr LLM credit seed to try the agent before you decide whether to subscribe. When you're ready, **[Account → rhagent Pro](https://rhagent.bot/account)** handles the whole subscription: deposit $20 by card or crypto (lands as USDC on Base in your managed wallet), hit Activate, and the membership is paid on-chain — automations, hosted env storage, and 1,000 messages/day unlock. See [Reference → Bankr Club vs. credits](./07-reference.md#bankr-club-vs-credits).
