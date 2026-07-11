import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ ok: true, agents: [], symbols: [] });
  }
  const results = searchAll(q.trim());
  return NextResponse.json({ ok: true, ...results });
}
