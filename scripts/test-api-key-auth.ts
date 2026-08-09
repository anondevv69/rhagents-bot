#!/usr/bin/env tsx
/**
 * Auth regression tests. Run: npx tsx scripts/test-api-key-auth.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this file exists
 *
 * When api_key stopped being stored in plaintext, the column could not simply
 * be dropped — it is NOT NULL UNIQUE and SQLite will not cheaply relax that on
 * a live table — so migrated rows keep a placeholder there: `hashed:{agent_id}`.
 *
 * The first version of that change also kept a plaintext fallback lookup
 * against the same column, for keys not yet migrated. Those two facts combined
 * into a full authentication bypass: agent ids are public, so
 * `Authorization: Bearer hashed:rha_…` matched the placeholder row and
 * authenticated as that agent. The hashing change would have opened a trivial
 * takeover on every account it had just "protected".
 *
 * The guard is two lines in getAgentFromRequest. This file is here so nobody
 * removes them as redundant — including a future me reading that function and
 * seeing a prefix check that looks like belt-and-braces.
 */

import { createHash, randomBytes } from "crypto";
import Database from "better-sqlite3";

const SECRET = "test-secret";
const RETIRED = "hashed:";
const REAL = "rhagents_";

const hashApiKey = (k: string) => createHash("sha256").update(`${SECRET}:${k}`).digest("hex");
const genKey = (id: string) => `${REAL}${id}_${randomBytes(24).toString("base64url")}_abcd1234`;
const maskApiKey = (k: string) =>
  k.length < 20 ? "rhagents_••••••••" : `${k.slice(0, 16)}…${k.slice(-4)}`;
const cols = (id: string, raw: string) => ({
  api_key: `${RETIRED}${id}`,
  api_key_hash: hashApiKey(raw),
  api_key_display: maskApiKey(raw),
});

const db = new Database(":memory:");
db.exec(
  `CREATE TABLE agents (id TEXT PRIMARY KEY, api_key TEXT UNIQUE NOT NULL,
     api_key_hash TEXT, api_key_display TEXT)`,
);
db.exec(`CREATE UNIQUE INDEX idx_hash ON agents(api_key_hash) WHERE api_key_hash IS NOT NULL`);

/**
 * Mirror of lib/auth.ts getAgentFromRequest, minus the HTTP header parsing.
 * Kept in step with that function deliberately — if you change the lookup
 * there, change it here and watch these still pass.
 */
function getAgentFromKey(key: string): { id: string } | null {
  if (!key) return null;

  const byHash = db.prepare("SELECT * FROM agents WHERE api_key_hash = ?").get(hashApiKey(key)) as
    | { id: string }
    | undefined;
  if (byHash) return byHash;

  // The guard. Both halves are load-bearing; see the header.
  if (!key.startsWith(REAL)) return null;
  const byPlain = db
    .prepare(`SELECT * FROM agents WHERE api_key = ? AND api_key NOT LIKE '${RETIRED}%'`)
    .get(key) as { id: string } | undefined;

  if (byPlain) {
    const c = cols(byPlain.id, key);
    db.prepare(
      "UPDATE agents SET api_key = ?, api_key_hash = ?, api_key_display = ? WHERE id = ?",
    ).run(c.api_key, c.api_key_hash, c.api_key_display, byPlain.id);
    return byPlain;
  }
  return null;
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

const idOf = (a: { id: string } | null) => (a ? a.id : null);

// A: already migrated. B, C: legacy rows still holding a raw key.
const idA = "rha_aaaaaaaaaaaaaaaa";
const keyA = genKey(idA);
const cA = cols(idA, keyA);
db.prepare("INSERT INTO agents VALUES (?,?,?,?)").run(
  idA,
  cA.api_key,
  cA.api_key_hash,
  cA.api_key_display,
);

const idB = "rha_bbbbbbbbbbbbbbbb";
const keyB = genKey(idB);
db.prepare("INSERT INTO agents VALUES (?,?,?,?)").run(idB, keyB, null, null);

const idC = "rha_cccccccccccccccc";
const keyC = genKey(idC);
db.prepare("INSERT INTO agents VALUES (?,?,?,?)").run(idC, keyC, null, null);

// ── The bypass this file exists for ──────────────────────────────────────────
assert(
  idOf(getAgentFromKey(`${RETIRED}${idA}`)) === null,
  "placeholder of a MIGRATED agent is not a credential",
);
assert(
  idOf(getAgentFromKey(`${RETIRED}${idB}`)) === null,
  "placeholder shape against a LEGACY agent is not a credential",
);

// ── Normal operation still works ─────────────────────────────────────────────
assert(idOf(getAgentFromKey(keyA)) === idA, "migrated key authenticates by hash");
assert(idOf(getAgentFromKey(keyB)) === idB, "legacy key authenticates and self-heals");

const afterB = db
  .prepare("SELECT api_key, api_key_hash, api_key_display FROM agents WHERE id = ?")
  .get(idB) as { api_key: string; api_key_hash: string; api_key_display: string };

assert(afterB.api_key === `${RETIRED}${idB}`, "self-heal retires api_key in place");
assert(afterB.api_key_hash === hashApiKey(keyB), "self-heal writes the hash");
assert(
  !afterB.api_key_display.includes(keyB.slice(20, 32)),
  "display fragment does not contain the secret's random bytes",
);
assert(idOf(getAgentFromKey(keyB)) === idB, "same key still works after healing");
assert(
  idOf(getAgentFromKey(`${RETIRED}${idB}`)) === null,
  "healed row's own placeholder is still not a credential",
);
assert(
  (db.prepare("SELECT COUNT(*) c FROM agents WHERE api_key = ?").get(keyB) as { c: number }).c === 0,
  "raw secret no longer present in any api_key column",
);
assert(idOf(getAgentFromKey(keyC)) === idC, "an untouched legacy row still authenticates");
assert(idOf(getAgentFromKey(keyB)) === idB, "keys do not cross-resolve between agents");

// ── Junk and injection-shaped input ──────────────────────────────────────────
for (const junk of ["nonsense", REAL, "' OR 1=1 --", `${RETIRED}%`, "hashed:", "%", "_", ""]) {
  assert(idOf(getAgentFromKey(junk)) === null, `junk rejected: ${JSON.stringify(junk)}`);
}

// ── The placeholder must stay unique, since the column is UNIQUE ─────────────
const distinct = (
  db.prepare("SELECT COUNT(DISTINCT api_key) d FROM agents").get() as { d: number }
).d;
const total = (db.prepare("SELECT COUNT(*) n FROM agents").get() as { n: number }).n;
assert(distinct === total, "placeholders are unique per agent — no UNIQUE collision");

console.log(failed === 0 ? "\nAll auth checks passed." : `\n${failed} auth check(s) FAILED.`);
process.exit(failed ? 1 : 0);
