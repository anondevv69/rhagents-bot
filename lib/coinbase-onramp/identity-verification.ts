import {
  CdpApiError,
  cdpConfigured,
  initiateOnrampVerification,
  submitOnrampVerification,
} from "@/lib/coinbase-onramp/onramp-client";
import {
  createOtpChallenge,
  createPendingCoinbaseVerification,
  getDepositIdentityStatus,
  getPendingCoinbaseVerification,
  saveCoinbaseVerification,
  verifyOtpChallenge,
} from "@/lib/coinbase-onramp/identity-store";
import type { DepositPlatform } from "@/lib/coinbase-onramp/wallet-lookup";

const E164 = /^\+1\d{10}$/;

function basicEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Accepts "4155551234", "14155551234", "+14155551234", "(415) 555-1234", etc. */
function normalizeUsPhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    const candidate = `+${digits}`;
    return E164.test(candidate) ? candidate : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function normalizeDestination(channel: "phone" | "email", dest: string): string {
  if (channel === "email") return dest.trim().toLowerCase();
  return normalizeUsPhone(dest) ?? dest.trim();
}

/** 401/403 on the Verification API means Coinbase hasn't allowlisted this app yet — separate from Onramp order approval. */
const SANDBOX_HINT =
  "Use Coinbase sandbox test values to try the full flow: phone +10005550100, email anything@sandbox.test, code 000000.";

function friendlyCdpError(err: CdpApiError): Error {
  if (err.status === 401 || err.status === 403) {
    return new Error(
      `coinbase_verification_not_allowlisted: Coinbase hasn't approved this app for live phone/email verification yet. ${SANDBOX_HINT}`,
    );
  }
  return new Error(`coinbase_otp_send_failed: ${err.message.slice(0, 160)}`);
}

function otpExpiresMs(iso: string): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? Date.now() + 10 * 60 * 1000 : at;
}

/** Send OTP via Coinbase Verification API (or dev fallback). */
export async function sendDepositOtp(params: {
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
}): Promise<{ challengeId: string; expiresAt: number; devCode?: string }> {
  const dest = normalizeDestination(params.channel, params.destination);
  if (params.channel === "phone") {
    if (!E164.test(dest)) {
      throw new Error("phone_must_be_e164_us");
    }
  } else if (!basicEmail(dest)) {
    throw new Error("invalid_email");
  }

  if (cdpConfigured()) {
    try {
      const initiated = await initiateOnrampVerification({
        channel: params.channel === "phone" ? "sms" : "email",
        destination: dest,
      });
      createPendingCoinbaseVerification({
        verificationId: initiated.verificationId,
        platform: params.platform,
        platformUserId: params.platformUserId,
        channel: params.channel,
        destination: dest,
        expiresAtIso: initiated.otpExpiresAt,
      });
      return {
        challengeId: initiated.verificationId,
        expiresAt: otpExpiresMs(initiated.otpExpiresAt),
      };
    } catch (err) {
      if (err instanceof CdpApiError) {
        throw friendlyCdpError(err);
      }
      throw err;
    }
  }

  if (process.env.DEPOSIT_OTP_DEV === "1") {
    const { challengeId, code, expiresAt } = createOtpChallenge(
      params.platform,
      params.platformUserId,
      params.channel,
      dest,
    );
    console.info(`[deposit-otp-dev] ${params.channel} ${dest}: ${code}`);
    return { challengeId, expiresAt, devCode: code };
  }

  throw new Error("otp_provider_not_configured");
}

export async function verifyDepositOtp(params: {
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
  challengeId: string;
  code: string;
}): Promise<boolean> {
  const dest = normalizeDestination(params.channel, params.destination);
  const verificationId = params.challengeId.trim();
  const code = params.code.trim();

  if (cdpConfigured() && verificationId.startsWith("onramp_verification_")) {
    const pending = getPendingCoinbaseVerification(
      verificationId,
      params.platform,
      params.platformUserId,
      params.channel,
      dest,
    );
    if (!pending) return false;

    try {
      const confirmed = await submitOnrampVerification(verificationId, code);
      saveCoinbaseVerification({
        platform: params.platform,
        platformUserId: params.platformUserId,
        channel: params.channel,
        destination: dest,
        verificationId: confirmed.verificationId,
        verificationExpiresAt: confirmed.verificationExpiresAt,
      });
      return true;
    } catch (err) {
      if (err instanceof CdpApiError) {
        if (err.status === 401 || err.status === 403) {
          throw friendlyCdpError(err);
        }
        return false;
      }
      throw err;
    }
  }

  return verifyOtpChallenge(
    verificationId,
    code,
    params.platform,
    params.platformUserId,
    params.channel,
    dest,
  );
}

export { getDepositIdentityStatus } from "@/lib/coinbase-onramp/identity-store";
