import { NextRequest, NextResponse } from "next/server";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { handleUpgradeLimits, HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!bridgeSecretOk(req.headers.get("x-telegram-bridge-secret"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const dob = body.dateOfBirth ?? body.date_of_birth;
  if (!dob || typeof dob !== "object") {
    return NextResponse.json({ ok: false, error: "date_of_birth required" }, { status: 400 });
  }
  const d = dob as Record<string, string>;

  try {
    await handleUpgradeLimits({
      phoneNumber: String(body.phoneNumber ?? body.phone_number ?? ""),
      ssnLast4: String(body.ssnLast4 ?? body.ssn_last4 ?? ""),
      dateOfBirth: { day: d.day, month: d.month, year: d.year },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
