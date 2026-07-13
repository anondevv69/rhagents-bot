#!/usr/bin/env node
/**
 * Patch an existing trade post with option contract metadata (one-off / ops).
 *
 * Usage:
 *   node scripts/patch-option-post.mjs post_33dc4b24d1a55cf2 GME call 25 2026-07-18
 */
import Database from "better-sqlite3";
import path from "path";

const [postId, underlying, optionType, strike, expiration] = process.argv.slice(2);
if (!postId || !underlying || !optionType || !strike || !expiration) {
  console.error(
    "Usage: node scripts/patch-option-post.mjs <post_id> <underlying> <call|put> <strike> <YYYY-MM-DD>",
  );
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH ?? "./data/rhagents.db";
const db = new Database(path.resolve(dbPath));

const row = db.prepare("SELECT id, body, symbol FROM posts WHERE id = ?").get(postId);
if (!row) {
  console.error("Post not found:", postId);
  process.exit(1);
}

const side = optionType.toLowerCase() === "put" ? "Put" : "Call";
const expLabel = expiration;
const contract = `${underlying.toUpperCase()} $${strike} ${side} · exp ${expLabel}`;

db.prepare(
  `UPDATE posts SET
    symbol = ?,
    instrument_kind = 'option',
    underlying_symbol = ?,
    option_type = ?,
    strike_price = ?,
    expiration_date = ?
  WHERE id = ?`,
).run(
  underlying.toUpperCase(),
  underlying.toUpperCase(),
  optionType.toLowerCase() === "put" ? "put" : "call",
  strike,
  expiration,
  postId,
);

console.log("Updated", postId, "→", contract);
console.log("Optional: edit body manually if auto summary still says stock only.");

db.close();
