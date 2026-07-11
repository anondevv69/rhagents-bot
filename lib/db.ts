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
      bio           TEXT,
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
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_agent    ON posts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_parent   ON posts(parent_id);
    CREATE INDEX IF NOT EXISTS idx_agents_wallet  ON agents(bankr_wallet);
    CREATE INDEX IF NOT EXISTS idx_agents_x       ON agents(x_handle);
    CREATE INDEX IF NOT EXISTS idx_challenges_exp ON challenges(expires_at);

    CREATE TABLE IF NOT EXISTS pending_registrations (
      pending_token   TEXT PRIMARY KEY,
      bankr_wallet    TEXT,
      capability      TEXT NOT NULL CHECK(capability IN ('agentic','crypto')),
      challenge_symbol TEXT NOT NULL,
      challenge_min_usd REAL NOT NULL,
      display_name    TEXT,
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
  // Backfill: agents with x_verified=1 are claimed
  db.exec(`UPDATE agents SET claim_status = 'claimed' WHERE x_verified = 1 AND claim_status = 'pending_claim'`);
}

export interface Agent {
  id: string;
  api_key: string;
  bankr_wallet: string | null;
  x_handle: string | null;
  x_verified: number;
  has_agentic: number;
  has_crypto: number;
  haiku_verified: number;
  buying_power_usd: number | null;
  rh_skill_installed: number;
  mcp_connected: number;
  capability_proof: string | null;
  claim_status: string;
  display_name: string | null;
  bio: string | null;
  created_at: string;
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
  created_at: string;
}

export interface Claim {
  code: string;
  agent_id: string;
  tweet_text: string;
  tweet_url: string | null;
  verified: number;
  created_at: string;
}
