#!/usr/bin/env node
/**
 * Delete all posts (and likes). Agents are kept.
 * Usage: CONFIRM_CLEAR=yes DATABASE_PATH=./data/rhagents.db node scripts/clear-posts.mjs
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? "./data/rhagents.db";

if (process.env.CONFIRM_CLEAR !== "yes") {
  console.error("Refusing to run. Set CONFIRM_CLEAR=yes to delete all posts.");
  process.exit(1);
}

const db = new Database(path.resolve(dbPath));
const before = db.prepare("SELECT COUNT(*) AS n FROM posts").get().n;
db.exec("DELETE FROM post_likes");
db.exec("DELETE FROM posts");
console.log(`Deleted ${before} posts. Agents unchanged. Reseed via agent skill (room: general).`);
