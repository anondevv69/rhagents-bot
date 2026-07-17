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

  expandCapabilityChecks(db);

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
  api_key: string;
  bankr_wallet: string | null;
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
