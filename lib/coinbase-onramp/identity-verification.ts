import {
  createOtpChallenge,
  getDepositIdentity,
  phoneVerifiedRecently,
  emailVerified,
  verifyOtpChallenge,
} from "@/lib/coinbase-onramp/identity-store";
import type { DepositPlatform } from "@/lib/coinbase-onramp/wallet-lookup";

const E164 = /^\+1\d{10}$/;

function basicEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function sendTwilioVerify(to: string, channel: "sms" | "email"): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const service = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!sid || !token || !service) {
    throw new Error("twilio_not_configured");
  }

  const body = new URLSearchParams({
    To: to,
    Channel: channel,
  });

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`twilio_send_failed: ${text.slice(0, 120)}`);
  }
}

/** Send OTP — Twilio Verify when configured, otherwise dev-mode code in response. */
export async function sendDepositOtp(params: {
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
}): Promise<{ challengeId: string; expiresAt: number; devCode?: string }> {
  const dest = params.destination.trim();
  if (params.channel === "phone") {
    if (!E164.test(dest)) {
      throw new Error("phone_must_be_e164_us");
    }
  } else if (!basicEmail(dest)) {
    throw new Error("invalid_email");
  }

  const { challengeId, code, expiresAt } = createOtpChallenge(
    params.platform,
    params.platformUserId,
    params.channel,
    params.channel === "email" ? dest.toLowerCase() : dest,
  );

  const twilioReady =
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (twilioReady) {
    await sendTwilioVerify(dest, params.channel === "phone" ? "sms" : "email");
    return { challengeId, expiresAt };
  }

  if (process.env.DEPOSIT_OTP_DEV === "1") {
    console.info(`[deposit-otp-dev] ${params.channel} ${dest}: ${code}`);
    return { challengeId, expiresAt, devCode: code };
  }

  throw new Error("otp_provider_not_configured");
}

async function checkTwilioVerify(to: string, code: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const service = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!sid || !token || !service) return false;

  const body = new URLSearchParams({ To: to, Code: code });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { status?: string };
  return data.status === "approved";
}

export async function verifyDepositOtp(params: {
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
  challengeId: string;
  code: string;
}): Promise<boolean> {
  const dest = params.channel === "email" ? params.destination.trim().toLowerCase() : params.destination.trim();
  const twilioReady =
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (twilioReady) {
    const ok = await checkTwilioVerify(dest, params.code.trim());
    if (!ok) return false;
    return verifyOtpChallenge(
      params.challengeId,
      "__twilio__",
      params.platform,
      params.platformUserId,
      params.channel,
      dest,
    );
  }

  return verifyOtpChallenge(
    params.challengeId,
    params.code.trim(),
    params.platform,
    params.platformUserId,
    params.channel,
    dest,
  );
}

export function getDepositIdentityStatus(platform: DepositPlatform, platformUserId: string) {
  const row = getDepositIdentity(platform, platformUserId);
  return {
    phone: row?.phone_e164 ?? null,
    email: row?.email ?? null,
    phone_verified: phoneVerifiedRecently(row),
    email_verified: emailVerified(row),
    ready: phoneVerifiedRecently(row) && emailVerified(row),
  };
}
