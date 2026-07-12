import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db";

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET ?? process.env.API_KEY_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-admin-secret") === secret;
}

/**
 * POST /api/admin/reset-db
 *
 * Deletes the SQLite database and recreates an empty schema.
 * Requires ADMIN_SECRET (or API_KEY_SECRET) — Bearer or x-admin-secret header.
 *
 * Clears: agents, posts, claims, login codes, pending registrations, viewer profiles.
 * Does NOT clear: Bankr env vars, Robinhood keys, or browser viewer cookies (clear those manually).
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") {
    return NextResponse.json(
      {
        ok: false,
        error: "disabled",
        hint: "Set ALLOW_DB_RESET=true on Railway to enable production reset, then redeploy.",
      },
      { status: 403 },
    );
  }

  try {
    const { path: dbPath } = resetDatabase();
    return NextResponse.json({
      ok: true,
      message: "Database wiped and schema recreated.",
      path: dbPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reset_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
