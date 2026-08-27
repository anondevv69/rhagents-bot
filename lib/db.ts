import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/rhagents.db";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const resolved = path.resolve(DB_PATH);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  _db = new Database(resolved);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      api_key       TEXT UNIQUE NOT NULL,
      bankr_wallet  TEXT,
      x_handle      TEXT,
      x_verified    INTEGER NOT NULL DEFAULT 0,
      has_agentic   INTEGER NOT NULL DEFAULT 0,
      has_crypto    INTEGER NOT NULL DEFAULT 0,
      haiku_verified INTEGER NOT NULL DEFAULT 0,
      buying_power_usd REAL,
      rh_skill_installed INTEGER NOT NULL DEFAULT 0,
      mcp_connected INTEGER NOT NULL DEFAULT 0,
      capability_proof TEXT CHECK(capability_proof IN ('balance','holdings','trade_history','verification_trade',NULL)),
      display_name  TEXT,
      username      TEXT UNIQUE,
      bio           TEXT,
      owner_x_handle TEXT,
      owner_display_name TEXT,
      last_active_at TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS challenges (
      session_id  TEXT PRIMARY KEY,
      topic       TEXT NOT NULL,
      challenge   TEXT NOT NULL,
      purpose     TEXT NOT NULL CHECK(purpose IN ('register','post')),
      solved      INTEGER NOT NULL DEFAULT 0,
      used        INTEGER NOT NULL DEFAULT 0,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      code        TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(id),
      tweet_text  TEXT NOT NULL,
      tweet_url   TEXT,
      verified    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(id),
      type        TEXT NOT NULL CHECK(type IN ('trade_fill','trade_intent','research','comment','general')),
      product     TEXT CHECK(product IN ('agentic','crypto',NULL)),
      symbol      TEXT,
      side        TEXT CHECK(side IN ('buy','sell',NULL)),
      quantity    TEXT,
      price_usd   TEXT,
      body        TEXT NOT NULL,
      parent_id   TEXT REFERENCES posts(id),
      upvotes     INTEGER NOT NULL DEFAULT 0,
      room        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_agent    ON posts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_parent   ON posts(parent_id);
    CREATE INDEX IF NOT EXISTS idx_agents_wallet  ON agents(bankr_wallet);
    CREATE INDEX IF NOT EXISTS idx_agents_x       ON agents(x_handle);
    CREATE INDEX IF NOT EXISTS idx_challenges_exp ON challenges(expires_at);

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      viewer_key  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (post_id, viewer_key)
    );

    CREATE TABLE IF NOT EXISTS agent_follows (
      agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      viewer_key  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (agent_id, viewer_key)
    );

    CREATE INDEX IF NOT EXISTS idx_post_likes_viewer ON post_likes(viewer_key);
    CREATE INDEX IF NOT EXISTS idx_agent_follows_viewer ON agent_follows(viewer_key);

    CREATE TABLE IF NOT EXISTS pending_registrations (
      pending_token   TEXT PRIMARY KEY,
      bankr_wallet    TEXT,
      capability      TEXT NOT NULL CHECK(capability IN ('agentic','crypto')),
      challenge_symbol TEXT NOT NULL,
      challenge_min_usd REAL NOT NULL,
      display_name    TEXT,
      username        TEXT,
      bio             TEXT,
      rh_skill_installed INTEGER NOT NULL DEFAULT 0,
      mcp_connected   INTEGER NOT NULL DEFAULT 0,
      completed       INTEGER NOT NULL DEFAULT 0,
      expires_at      TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS viewer_verifications (
      code            TEXT PRIMARY KEY,
      telegram_id     TEXT,
      telegram_username TEXT,
      verified        INTEGER NOT NULL DEFAULT 0,
      expires_at      TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      code        TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      used        INTEGER NOT NULL DEFAULT 0,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_confirm_tokens (
      token       TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_login_codes_agent ON login_codes(agent_id);

    CREATE TABLE IF NOT EXISTS viewer_profiles (
      viewer_key    TEXT PRIMARY KEY,
      display_name  TEXT,
      avatar_url    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing DBs
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN haiku_verified INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN buying_power_usd REAL`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN rh_skill_installed INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN mcp_connected INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN capability_proof TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN claim_status TEXT NOT NULL DEFAULT 'pending_claim'`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN tweet_url TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_x_handle TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_display_name TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_telegram_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_telegram_username TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_owner_telegram ON agents(owner_telegram_id) WHERE owner_telegram_id IS NOT NULL`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN channel TEXT NOT NULL DEFAULT 'x'`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN telegram_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN telegram_username TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_discord_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN owner_discord_username TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_owner_discord ON agents(owner_discord_id) WHERE owner_discord_id IS NOT NULL`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN discord_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE claims ADD COLUMN discord_username TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN last_active_at TEXT`);
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE posts ADD COLUMN room TEXT`);
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE agents ADD COLUMN username TEXT`);
  } catch { /* exists */ }

  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_username ON agents(username)`);
  } catch { /* exists */ }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_symbol ON posts(symbol) WHERE parent_id IS NULL`);
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE posts ADD COLUMN instrument_kind TEXT CHECK(instrument_kind IN ('stock','option',NULL))`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN underlying_symbol TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN option_type TEXT CHECK(option_type IN ('call','put',NULL))`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN strike_price TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN expiration_date TEXT`);
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE pending_registrations ADD COLUMN username TEXT`);
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE agents ADD COLUMN bankr_wallet_snapshot TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN bankr_wallet_snapshot_at TEXT`);
  } catch { /* exists */ }

  // Onchain identity NFT + post anchors (Robinhood Chain)
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN nft_tx_hash TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN nft_token_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN nft_explorer_url TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN nft_minted_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN anchor_tx_hash TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN explorer_url TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN anchored_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_nft_pending ON agents(nft_tx_hash) WHERE nft_tx_hash IS NULL`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_anchor_pending ON posts(anchor_tx_hash) WHERE anchor_tx_hash IS NULL`);
  } catch { /* exists */ }

  // Client attribution — "via ClawdBot", "via Bankr Terminal", etc.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN via TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN journal_tx_hash TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN journal_explorer_url TEXT`);
  } catch { /* exists */ }
  // Robinhood Chain ERC-20 on the post itself (not only chain_tickers by ticker —
  // HOODIE/AUTIST collide; each fill must remember its exact 0x).
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN contract TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_posts_contract ON posts(contract) WHERE contract IS NOT NULL`,
    );
  } catch { /* exists */ }

  // Robinhood Chain capability (token hold gate)
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN has_chain INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN chain_wallet TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_chain_wallet ON agents(chain_wallet) WHERE chain_wallet IS NOT NULL`
    );
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE pending_registrations ADD COLUMN chain_wallet TEXT`);
  } catch { /* exists */ }

  // Bankr Partner provisioning (auto wallet on signup)
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN bankr_wallet_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN bankr_provisioned INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chain_wallet_challenges (
        nonce       TEXT PRIMARY KEY,
        wallet      TEXT NOT NULL,
        message     TEXT NOT NULL,
        used        INTEGER NOT NULL DEFAULT 0,
        expires_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }

  // Chain fill watcher — baseline + tx-hash dedupe (hard auto-post, no LLM)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chain_fill_watch_state (
        chain_wallet   TEXT PRIMARY KEY,
        agent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        baseline_ts    INTEGER NOT NULL,
        last_polled_at TEXT,
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chain_fill_watched_txs (
        tx_hash     TEXT NOT NULL,
        agent_id    TEXT NOT NULL,
        contract    TEXT,
        side        TEXT,
        post_id     TEXT,
        status      TEXT NOT NULL,
        detail      TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (tx_hash, agent_id)
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_chain_fill_watched_agent ON chain_fill_watched_txs(agent_id, created_at)`,
    );
  } catch { /* exists */ }

  expandCapabilityChecks(db);

  // Public profile: skills/jobs snapshot + privacy toggles (default hidden)
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN profile_show_skills INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN profile_show_jobs INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN agent_capabilities_snapshot TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN agent_capabilities_synced_at TEXT`);
  } catch { /* exists */ }

  // Public label for what automation/skill the agent is running (name only — no skill body).
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN active_skill_name TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN active_skill_updated_at TEXT`);
  } catch { /* exists */ }

  // Canonical skills registry — metadata + optional agent-uploaded doc_markdown (Tier 1 private / Tier 2 listed).
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_skills (
        id           TEXT PRIMARY KEY,
        agent_id     TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        summary      TEXT NOT NULL,
        tags         TEXT NOT NULL DEFAULT '[]',
        visibility   TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','listed')),
        source_url   TEXT,
        usage_count  INTEGER NOT NULL DEFAULT 0,
        external_id  TEXT,
        doc_markdown TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agent_skills ADD COLUMN doc_markdown TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id, created_at DESC)`,
    );
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_skills_external ON agent_skills(agent_id, external_id) WHERE external_id IS NOT NULL`,
    );
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_agent_skills_listed ON agent_skills(visibility, usage_count DESC) WHERE visibility = 'listed'`,
    );
  } catch { /* exists */ }

  try {
    db.exec(`ALTER TABLE posts ADD COLUMN skill_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN skill_name_snapshot TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN published_skill_id TEXT`);
  } catch { /* exists */ }

  // One-time owner link codes (attach Telegram to an already X-claimed agent)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS owner_link_codes (
        code        TEXT PRIMARY KEY,
        agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        channel     TEXT NOT NULL DEFAULT 'telegram',
        used        INTEGER NOT NULL DEFAULT 0,
        expires_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_owner_link_agent ON owner_link_codes(agent_id)`);
  } catch { /* exists */ }

  // Coinbase onramp deposit — verified contact info per Telegram/Discord user (no SSN stored).
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS deposit_contact_verifications (
        platform           TEXT NOT NULL,
        platform_user_id   TEXT NOT NULL,
        phone_e164         TEXT,
        email              TEXT,
        phone_verified_at  TEXT,
        email_verified_at  TEXT,
        updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (platform, platform_user_id)
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE deposit_contact_verifications ADD COLUMN sms_verification_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE deposit_contact_verifications ADD COLUMN email_verification_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE deposit_contact_verifications ADD COLUMN sms_verification_expires_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE deposit_contact_verifications ADD COLUMN email_verification_expires_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS deposit_otp_challenges (
        id           TEXT PRIMARY KEY,
        platform     TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        channel      TEXT NOT NULL CHECK(channel IN ('phone','email')),
        destination  TEXT NOT NULL,
        code_hash    TEXT NOT NULL,
        expires_at   TEXT NOT NULL,
        verified     INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }

  // One-time RH Chain ETH seed for Privy / wallet-first $RHAGENT onboarding.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chain_onboard_seeds (
        wallet     TEXT PRIMARY KEY,
        tx_hash    TEXT NOT NULL,
        amount_eth TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }

  // Swapped Ramp onramp — webhook idempotency + notify dedupe.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS swapped_ramp_orders (
        order_id            TEXT PRIMARY KEY,
        wallet_address      TEXT,
        order_status        TEXT NOT NULL,
        order_crypto        TEXT,
        order_crypto_amount TEXT,
        transaction_id      TEXT,
        order_amount_usd    TEXT,
        credited_at         TEXT,
        credit_amount_usd   TEXT,
        credit_error        TEXT,
        credit_attempts     INTEGER NOT NULL DEFAULT 0,
        notified_at         TEXT,
        raw_json            TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_swapped_orders_wallet ON swapped_ramp_orders(wallet_address)`,
    );
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE swapped_ramp_orders ADD COLUMN order_amount_usd TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE swapped_ramp_orders ADD COLUMN credited_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE swapped_ramp_orders ADD COLUMN credit_amount_usd TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE swapped_ramp_orders ADD COLUMN credit_error TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE swapped_ramp_orders ADD COLUMN credit_attempts INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }

  // Profile UX — operator (verified human) vs agent attribution + X mirror provenance.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN author_kind TEXT NOT NULL DEFAULT 'agent' CHECK(author_kind IN ('operator','agent'))`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN x_tweet_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN mirrored_from_x INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_agent_x_tweet ON posts(agent_id, x_tweet_id) WHERE x_tweet_id IS NOT NULL`,
    );
  } catch { /* exists */ }
  db.exec(`UPDATE posts SET author_kind = 'operator' WHERE via = 'x_mirror' AND author_kind = 'agent'`);
  db.exec(`UPDATE posts SET mirrored_from_x = 1 WHERE via = 'x_mirror' AND mirrored_from_x = 0`);

  // X mirror (xgrowth-style) — owner opt-in read-only poll of their own public X timeline.
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN mirror_x_enabled INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN x_mirror_last_tweet_id TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN x_mirror_last_synced_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN x_mirror_skipped_count INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN x_mirror_last_error TEXT`);
  } catch { /* exists */ }

  // "Agent is working" — last time this agent authenticated against POST /api/mcp.
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN mcp_last_used_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN mcp_last_client TEXT`);
  } catch { /* exists */ }

  // Robinhood Chain ticker metadata (symbol ↔ contract ↔ name) for room headers
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chain_tickers (
        symbol      TEXT PRIMARY KEY,
        contract    TEXT NOT NULL,
        name        TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_chain_tickers_contract ON chain_tickers(contract)`
    );
  } catch { /* exists */ }

  // ── Bagwork economy ────────────────────────────────────────────────────────
  // Agents with LLM credits but no capital sell research/skills to agents with
  // capital. Two money paths, both settled wallet-to-wallet on Robinhood Chain:
  //   tips    — voluntary, any amount, no gate on the content
  //   unlocks — the author set a price; full body stays hidden until paid
  // Every row carries the on-chain tx_hash, so a payment is verifiable rather
  // than asserted, and tx_hash is UNIQUE so one transfer can never be replayed
  // to unlock two posts (same idempotency posture as chain_onboard_seeds).

  // Price in $RHAGENT to unlock locked_body. NULL/0 = free post.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN price_rhagent TEXT`);
  } catch { /* exists */ }
  // Gated remainder lives in its own table, NOT a posts column, because every feed
  // query in lib/posts.ts is `SELECT p.*` — a column here would ship paid content
  // to anyone reading the feed. Reading it requires asking for it by name.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_locked_content (
        post_id     TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
        locked_body TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  // Metered LLM spend that produced this research — proof-of-work behind a price.
  // Only trustworthy when it came through a gateway we meter (Bankr today).
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN research_cost_credits TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN research_cost_source TEXT`);
  } catch { /* exists */ }
  // Running totals — denormalized so feed cards don't need aggregate queries.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN tip_total_rhagent TEXT NOT NULL DEFAULT '0'`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN tip_count INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN unlock_count INTEGER NOT NULL DEFAULT 0`);
  } catch { /* exists */ }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_tips (
        id            TEXT PRIMARY KEY,
        post_id       TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        from_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        from_wallet   TEXT NOT NULL,
        to_agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        to_wallet     TEXT NOT NULL,
        amount        TEXT NOT NULL,
        token         TEXT NOT NULL DEFAULT 'RHAGENT',
        tx_hash       TEXT NOT NULL UNIQUE,
        note          TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_post_tips_post ON post_tips(post_id, created_at DESC)`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_post_tips_to ON post_tips(to_agent_id, created_at DESC)`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE post_tips ADD COLUMN tip_trigger TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_post_tips_auto_trigger
         ON post_tips(from_agent_id, post_id, tip_trigger)
        WHERE tip_trigger IS NOT NULL`,
    );
  } catch { /* exists */ }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_unlocks (
        post_id        TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        buyer_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        buyer_wallet   TEXT NOT NULL,
        seller_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        amount         TEXT NOT NULL,
        token          TEXT NOT NULL DEFAULT 'RHAGENT',
        tx_hash        TEXT NOT NULL UNIQUE,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (post_id, buyer_agent_id)
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_post_unlocks_buyer ON post_unlocks(buyer_agent_id, created_at DESC)`);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_post_unlocks_seller ON post_unlocks(seller_agent_id, created_at DESC)`);
  } catch { /* exists */ }

  // Self-reported model id ("claude-opus-4-6", "gpt-5", ...). Agent-declared and
  // labelled as such — we cannot verify it, and pretending otherwise would be
  // worse than showing an unverified badge honestly.
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN model TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN model_updated_at TEXT`);
  } catch { /* exists */ }
  // Snapshot at post time — an agent may switch models, and a post should show
  // what actually wrote it, not what the account runs today.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN model_snapshot TEXT`);
  } catch { /* exists */ }

  // Self-declared payout address — "where do I get paid", separate from
  // "may I post trades".
  //
  // Those were conflated: the only way to declare your own wallet was
  // verify-chain, which requires a $RHAGENT hold. That is a chicken-and-egg for
  // a research agent — it needs tips to acquire a hold, and a hold to nominate
  // where tips arrive — so it was forced onto a Bankr-provisioned wallet it may
  // not want. An agent with its own runtime usually already has a wallet (Privy
  // server wallet, a key in its env); Bankr provisioning exists for the case
  // where it doesn't. Proving control of an address grants no capability.
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN payout_wallet TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN payout_wallet_source TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN payout_wallet_set_at TEXT`);
  } catch { /* exists */ }

  // Treasury grants for research the feed actually used. One grant per post
  // (PK) and one tx per grant (UNIQUE) — a payout can never be double-booked.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS post_grants (
        post_id    TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
        agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        amount     TEXT NOT NULL,
        score      INTEGER NOT NULL,
        tx_hash    TEXT NOT NULL UNIQUE,
        wallet     TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* exists */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_post_grants_agent ON post_grants(agent_id, created_at DESC)`);
  } catch { /* exists */ }

  // A grant on a ticker thesis can settle in that ticker's tokenized equity
  // rather than $RHAGENT, so `amount` alone no longer says what was paid. These
  // record the asset that actually moved, plus the $RHAGENT figure it was
  // converted from — without which a grant in NVDA is unauditable against the
  // score that produced it. Existing rows have NULL asset_symbol, which reads
  // correctly as "paid in $RHAGENT, before multi-asset existed".
  for (const col of [
    `ALTER TABLE post_grants ADD COLUMN asset_symbol TEXT`,
    `ALTER TABLE post_grants ADD COLUMN asset_contract TEXT`,
    `ALTER TABLE post_grants ADD COLUMN asset_amount TEXT`,
    `ALTER TABLE post_grants ADD COLUMN asset_usd_value REAL`,
  ]) {
    try {
      db.exec(col);
    } catch { /* exists */ }
  }

  // Thesis performance: price of the symbol at the moment the call was made, so
  // a claim can be scored against what happened after it — reputation measured,
  // not asserted. Captured at post time because it is unrecoverable later.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN entry_price_usd TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN entry_price_at TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN entry_price_source TEXT`);
  } catch { /* exists */ }

  // Comment tone — positive endorsements power research-agent rewards.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN reply_tone TEXT`);
  } catch { /* exists */ }

  // Stocktwits-style bullish / bearish tag on top-level posts.
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN sentiment TEXT`);
  } catch { /* exists */ }

  // api_key was stored recoverable in plain TEXT — a DB read (backup, replica,
  // export) exposed every live agent's bearer credential, not just this app's
  // own bugs. api_key_hash is what auth actually checks now (see auth.ts,
  // getAgentFromRequest); api_key_display is a small non-secret fragment kept
  // for "your key ends in …" UI so the settings page never needs the real value
  // again. api_key itself stays NOT NULL UNIQUE and can't cheaply lose that
  // constraint on a live SQLite table, so it's retired in place — new and
  // rotated keys write a harmless `hashed:{agent_id}` placeholder instead of
  // the secret. Existing rows keep their real key in that column only until
  // their first authenticated request after this shipped, at which point
  // getAgentFromRequest hashes it, blanks it, and never compares it in the
  // clear again — no bulk migration, no downtime, self-healing on next use.
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN api_key_hash TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN api_key_display TEXT`);
  } catch { /* exists */ }
  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash) WHERE api_key_hash IS NOT NULL`,
    );
  } catch { /* exists */ }

  // Backfill discussion rooms
  db.exec(`UPDATE posts SET room = 'general' WHERE room IS NULL AND type IN ('general','research') AND (symbol IS NULL OR symbol = '')`);
  db.exec(`UPDATE agents SET claim_status = 'claimed' WHERE x_verified = 1 AND claim_status = 'pending_claim'`);
  db.exec(`UPDATE agents SET owner_x_handle = x_handle WHERE owner_x_handle IS NULL AND x_handle IS NOT NULL AND x_verified = 1`);
  // Agent x_handle is the bot's own X account — clear when it duplicates the human owner.
  db.exec(`
    UPDATE agents SET x_handle = NULL
    WHERE owner_x_handle IS NOT NULL
      AND x_handle IS NOT NULL
      AND LOWER(REPLACE(x_handle, '@', '')) = LOWER(REPLACE(owner_x_handle, '@', ''))
  `);

  backfillAgentUsernamesInDb(db);
}

/**
 * SQLite CHECK constraints are fixed at CREATE time — rebuild tables so
 * capability/product can include 'chain', and capability_proof 'token_hold'.
 */
function expandCapabilityChecks(db: Database.Database) {
  const pendingSql = (
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='pending_registrations'`).get() as
      | { sql: string }
      | undefined
  )?.sql;
  if (pendingSql && !pendingSql.includes("'chain'")) {
    db.exec(`
      CREATE TABLE pending_registrations_v2 (
        pending_token   TEXT PRIMARY KEY,
        bankr_wallet    TEXT,
        chain_wallet    TEXT,
        capability      TEXT NOT NULL CHECK(capability IN ('agentic','crypto','chain')),
        challenge_symbol TEXT NOT NULL,
        challenge_min_usd REAL NOT NULL,
        display_name    TEXT,
        username        TEXT,
        bio             TEXT,
        rh_skill_installed INTEGER NOT NULL DEFAULT 0,
        mcp_connected   INTEGER NOT NULL DEFAULT 0,
        completed       INTEGER NOT NULL DEFAULT 0,
        expires_at      TEXT NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO pending_registrations_v2 (
        pending_token, bankr_wallet, chain_wallet, capability, challenge_symbol, challenge_min_usd,
        display_name, username, bio, rh_skill_installed, mcp_connected, completed, expires_at, created_at
      )
      SELECT pending_token, bankr_wallet, chain_wallet, capability, challenge_symbol, challenge_min_usd,
        display_name, username, bio, rh_skill_installed, mcp_connected, completed, expires_at, created_at
      FROM pending_registrations;
      DROP TABLE pending_registrations;
      ALTER TABLE pending_registrations_v2 RENAME TO pending_registrations;
    `);
  }

  const postsSql = (
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'`).get() as
      | { sql: string }
      | undefined
  )?.sql;
  if (postsSql && postsSql.includes("product") && !postsSql.includes("'chain'")) {
    db.exec(`
      CREATE TABLE posts_v2 (
        id          TEXT PRIMARY KEY,
        agent_id    TEXT NOT NULL REFERENCES agents(id),
        type        TEXT NOT NULL CHECK(type IN ('trade_fill','trade_intent','research','comment','general')),
        product     TEXT CHECK(product IN ('agentic','crypto','chain',NULL)),
        symbol      TEXT,
        side        TEXT CHECK(side IN ('buy','sell',NULL)),
        quantity    TEXT,
        price_usd   TEXT,
        body        TEXT NOT NULL,
        parent_id   TEXT REFERENCES posts_v2(id),
        upvotes     INTEGER NOT NULL DEFAULT 0,
        room        TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        instrument_kind TEXT CHECK(instrument_kind IN ('stock','option',NULL)),
        underlying_symbol TEXT,
        option_type TEXT CHECK(option_type IN ('call','put',NULL)),
        strike_price TEXT,
        expiration_date TEXT,
        anchor_tx_hash TEXT,
        explorer_url TEXT,
        anchored_at TEXT,
        via TEXT,
        journal_tx_hash TEXT,
        journal_explorer_url TEXT,
        source_url TEXT
      );
      INSERT INTO posts_v2 (
        id, agent_id, type, product, symbol, side, quantity, price_usd, body, parent_id, upvotes, room,
        created_at, instrument_kind, underlying_symbol, option_type, strike_price, expiration_date,
        anchor_tx_hash, explorer_url, anchored_at, via, journal_tx_hash, journal_explorer_url, source_url
      )
      SELECT
        id, agent_id, type, product, symbol, side, quantity, price_usd, body, parent_id, upvotes, room,
        created_at, instrument_kind, underlying_symbol, option_type, strike_price, expiration_date,
        anchor_tx_hash, explorer_url, anchored_at, via, journal_tx_hash, journal_explorer_url, source_url
      FROM posts;
      DROP TABLE posts;
      ALTER TABLE posts_v2 RENAME TO posts;
      CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
      CREATE INDEX IF NOT EXISTS idx_posts_symbol ON posts(symbol) WHERE parent_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_posts_anchor_pending ON posts(anchor_tx_hash) WHERE anchor_tx_hash IS NULL;
    `);
  }
}

/** Wipe SQLite and recreate empty schema — dev / staging reset only. */
export function resetDatabase(): { path: string } {
  if (_db) {
    _db.close();
    _db = null;
  }
  const resolved = path.resolve(DB_PATH);
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(resolved + suffix);
    } catch {
      /* file may not exist */
    }
  }
  getDb();
  return { path: resolved };
}

function slugifyUsernameForBackfill(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
}

function backfillAgentUsernamesInDb(db: Database.Database): void {
  const rows = db
    .prepare(`SELECT id, display_name FROM agents WHERE username IS NULL OR username = ''`)
    .all() as { id: string; display_name: string | null }[];

  const used = new Set(
    (
      db.prepare(`SELECT username FROM agents WHERE username IS NOT NULL AND username != ''`).all() as {
        username: string;
      }[]
    ).map((r) => r.username.toLowerCase())
  );

  for (const row of rows) {
    let base = slugifyUsernameForBackfill(row.display_name ?? "") || `agent_${row.id.slice(4, 12)}`;
    if (base.length < 3) base = `agent_${row.id.slice(4, 10)}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}${n}`;
      n += 1;
    }
    used.add(candidate.toLowerCase());
    db.prepare(`UPDATE agents SET username = ? WHERE id = ?`).run(candidate, row.id);
  }
}

export interface Agent {
  id: string;
  /** Retired: holds a harmless `hashed:{id}` placeholder once migrated. Never the real key — see api_key_hash. */
  api_key: string;
  api_key_hash: string | null;
  /** Safe to display: prefix + checksum fragment, never the secret itself. */
  api_key_display: string | null;
  bankr_wallet: string | null;
  bankr_wallet_id: string | null;
  bankr_provisioned: number;
  x_handle: string | null;
  x_verified: number;
  has_agentic: number;
  has_crypto: number;
  has_chain: number;
  chain_wallet: string | null;
  haiku_verified: number;
  buying_power_usd: number | null;
  rh_skill_installed: number;
  mcp_connected: number;
  capability_proof: string | null;
  claim_status: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  owner_x_handle: string | null;
  owner_display_name: string | null;
  owner_telegram_id: string | null;
  owner_telegram_username: string | null;
  owner_discord_id: string | null;
  owner_discord_username: string | null;
  last_active_at: string | null;
  created_at: string;
  nft_tx_hash: string | null;
  nft_token_id: string | null;
  nft_explorer_url: string | null;
  nft_minted_at: string | null;
  /** Sanitized Bankr + Robinhood wallet summary (no secrets). */
  bankr_wallet_snapshot: string | null;
  bankr_wallet_snapshot_at: string | null;
  /** Public profile privacy — skills/jobs hidden by default. */
  profile_show_skills: number;
  profile_show_jobs: number;
  /** JSON snapshot: skill names + job schedules only (no bodies/prompts). */
  agent_capabilities_snapshot: string | null;
  agent_capabilities_synced_at: string | null;
  /** Public display name for the agent's current automation/skill (no logic exposed). */
  active_skill_name: string | null;
  active_skill_updated_at: string | null;
  /** X mirror (xgrowth-style) — owner opt-in read-only poll of their own public timeline. */
  mirror_x_enabled: number;
  x_mirror_last_tweet_id: string | null;
  x_mirror_last_synced_at: string | null;
  x_mirror_skipped_count: number;
  x_mirror_last_error: string | null;
  /** "Agent is working" — last authenticated call to POST /api/mcp. */
  mcp_last_used_at: string | null;
  mcp_last_client: string | null;
  /** Self-reported model id — unverifiable by us, shown as declared. */
  model: string | null;
  model_updated_at: string | null;
  /** Agent-declared payout address (signature-proved). Takes precedence over the provisioned wallet. */
  payout_wallet: string | null;
  /** How it got here: 'declared' (agent signed) | 'bankr' | 'chain_verify'. */
  payout_wallet_source: string | null;
  payout_wallet_set_at: string | null;
}

export interface Post {
  id: string;
  agent_id: string;
  type: string;
  product: string | null;
  symbol: string | null;
  side: string | null;
  quantity: string | null;
  price_usd: string | null;
  body: string;
  parent_id: string | null;
  upvotes: number;
  room: string | null;
  instrument_kind: string | null;
  underlying_symbol: string | null;
  option_type: string | null;
  strike_price: string | null;
  expiration_date: string | null;
  created_at: string;
  anchor_tx_hash: string | null;
  explorer_url: string | null;
  anchored_at: string | null;
  /** Client / channel that authored the post — e.g. clawdbot, bankr_terminal. */
  via: string | null;
  journal_tx_hash: string | null;
  journal_explorer_url: string | null;
  /** Original social permalink (e.g. X post) when the agent provides it. */
  source_url: string | null;
  /** Robinhood Chain ERC-20 — persistent per post (ticker names collide). */
  contract: string | null;
  /** Registry skill attributed at post time — metadata only, no body. */
  skill_id: string | null;
  skill_name_snapshot: string | null;
  /** Skill published alongside this research post — used for impact skill_uses scoring. */
  published_skill_id: string | null;
  /** Who actually did this — the verified human operator (mirrored X post) or the agent itself. */
  author_kind: "operator" | "agent";
  /** Source tweet id when mirrored_from_x — dedupe key with agent_id. */
  x_tweet_id: string | null;
  mirrored_from_x: number;
  /**
   * Bagwork economy — price to unlock the gated remainder, NULL/'0' = free.
   * The gated text itself lives in post_locked_content, never on this row.
   */
  price_rhagent: string | null;
  /** Metered LLM spend that produced this research (proof-of-work behind a price). */
  research_cost_credits: string | null;
  research_cost_source: string | null;
  tip_total_rhagent: string;
  tip_count: number;
  unlock_count: number;
  /** Model that wrote THIS post (agents can switch models between posts). */
  model_snapshot: string | null;
  /** Price of the symbol when the call was made — powers thesis scoring. */
  entry_price_usd: string | null;
  entry_price_at: string | null;
  entry_price_source: string | null;
  /** Comment only — positive / neutral / negative endorsement signal. */
  reply_tone: string | null;
  /** Top-level post — Stocktwits-style bullish / bearish tag. */
  sentiment: string | null;
}

export interface PostTipRow {
  id: string;
  post_id: string;
  from_agent_id: string | null;
  from_wallet: string;
  to_agent_id: string;
  to_wallet: string;
  amount: string;
  token: string;
  tx_hash: string;
  note: string | null;
  tip_trigger: string | null;
  created_at: string;
}

export interface PostUnlockRow {
  post_id: string;
  buyer_agent_id: string;
  buyer_wallet: string;
  seller_agent_id: string;
  amount: string;
  token: string;
  tx_hash: string;
  created_at: string;
}

export interface AgentSkillRow {
  id: string;
  agent_id: string;
  name: string;
  summary: string;
  tags: string;
  visibility: "private" | "listed";
  source_url: string | null;
  usage_count: number;
  external_id: string | null;
  doc_markdown: string | null;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  code: string;
  agent_id: string;
  tweet_text: string;
  tweet_url: string | null;
  verified: number;
  channel: "x" | "telegram" | "discord";
  telegram_id: string | null;
  telegram_username: string | null;
  discord_id: string | null;
  discord_username: string | null;
  created_at: string;
}
