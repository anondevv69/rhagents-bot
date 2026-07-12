import { NextResponse } from "next/server";

/** Disabled — viewer login uses guest browse or agent codes. */
export async function POST() {
  return NextResponse.json({ ok: false }, { status: 404 });
}
