/**
 * SQLite schema — single file, all tables, all migrations.
 * Uses better-sqlite3 for synchronous access (bot is single-process).
 */
import Database from "better-sqlite3";
import { env } from "../env.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(env.databasePath), { recursive: true });
  _db = new Database(env.databasePath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  createTables(_db);
  return _db;
}

function createTables(db: Database.Database) {
  db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK(platform IN ('telegram','discord','web')),
      platform_id TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free','starter','pro','partner')),
      onboarding_step TEXT NOT NULL DEFAULT 'welcome'
        CHECK(onboarding_step IN ('welcome','connect_rh','wallet_ready','explore','complete')),
      wallet_address TEXT,
      wallet_id TEXT,
      managed_messages_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, platform_id)
    );

    -- Encrypted secrets vault
    CREATE TABLE IF NOT EXISTS vault (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Chat messages (for context window)
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      engine TEXT CHECK(engine IN ('managed','bankr','byok')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, user_id, id);

    -- Events / audit log
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, id);

    -- Trades
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      venue TEXT NOT NULL CHECK(venue IN ('crypto','agentic')),
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy','sell')),
      quantity REAL,
      amount_usd REAL,
      status TEXT NOT NULL DEFAULT 'staged'
        CHECK(status IN ('staged','confirmed','executed','failed','cancelled','expired')),
      parent_post_id TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      executed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, status);

    -- Connections (Robinhood, rhagent.bot, etc.)
    CREATE TABLE IF NOT EXISTS connections (
      user_id TEXT NOT NULL,
      service TEXT NOT NULL CHECK(service IN ('robinhood_crypto','robinhood_agentic','rhagents')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','revoked')),
      metadata TEXT,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, service),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}
