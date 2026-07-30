import {
  handleCheckLimits,
  handleCreateDeposit,
  handleUpgradeLimits,
  HttpError,
} from "@/lib/coinbase-onramp/deposit-routes";
import {
  getDepositIdentityStatus,
  sendDepositOtp,
} from "@/lib/coinbase-onramp/identity-verification";
import { verifyDepositOtp } from "@/lib/coinbase-onramp/identity-verification";
import type { DepositPlatform } from "@/lib/coinbase-onramp/wallet-lookup";

type BridgeBody = Record<string, unknown>;

function platformFromBody(body: BridgeBody): DepositPlatform {
  return body.platform === "discord" ? "discord" : "telegram";
}

function platformUserId(body: BridgeBody, platform: DepositPlatform): string {
  if (platform === "discord") {
    return typeof body.discord_id === "string" ? body.discord_id.trim() : "";
  }
  return typeof body.telegram_id === "string" ? body.telegram_id.trim() : "";
}

function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return { status: err.status, body: { ok: false, error: err.message } };
  }
  const msg = err instanceof Error ? err.message : "internal_error";
  const status =
    msg === "phone_not_verified" || msg === "email_not_verified"
      ? 400
      : msg === "otp_provider_not_configured" || msg === "twilio_not_configured"
        ? 503
        : 500;
  return { status, body: { ok: false, error: msg } };
}

export async function bridgeDepositIdentity(body: BridgeBody) {
  const platform = platformFromBody(body);
  const uid = platformUserId(body, platform);
  if (!uid) {
    return { status: 400, body: { ok: false, error: "platform user id required" } };
  }
  return {
    status: 200,
    body: { ok: true, identity: getDepositIdentityStatus(platform, uid) },
  };
}

export async function bridgeDepositOtpSend(body: BridgeBody) {
  const platform = platformFromBody(body);
  const uid = platformUserId(body, platform);
  const channel = body.channel === "email" ? "email" : "phone";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!uid || !destination) {
    return { status: 400, body: { ok: false, error: "destination required" } };
  }
  try {
    const sent = await sendDepositOtp({ platform, platformUserId: uid, channel, destination });
    return {
      status: 200,
      body: {
        ok: true,
        challenge_id: sent.challengeId,
        expires_at: sent.expiresAt,
        ...(sent.devCode ? { dev_code: sent.devCode } : {}),
      },
    };
  } catch (err) {
    return jsonError(err);
  }
}

export async function bridgeDepositOtpVerify(body: BridgeBody) {
  const platform = platformFromBody(body);
  const uid = platformUserId(body, platform);
  const channel = body.channel === "email" ? "email" : "phone";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!uid || !destination || !challengeId || !code) {
    return { status: 400, body: { ok: false, error: "challenge_id, code, destination required" } };
  }

  const ok = await verifyDepositOtp({
    challengeId,
    code,
    platform,
    platformUserId: uid,
    channel,
    destination,
  });
  if (!ok) {
    return { status: 400, body: { ok: false, error: "invalid_or_expired_code" } };
  }
  return {
    status: 200,
    body: { ok: true, identity: getDepositIdentityStatus(platform, uid) },
  };
}

export async function bridgeDepositCreate(body: BridgeBody) {
  const platform = platformFromBody(body);
  const uid = platformUserId(body, platform);
  const paymentAmount =
    typeof body.payment_amount === "string"
      ? body.payment_amount.trim()
      : typeof body.paymentAmount === "string"
        ? body.paymentAmount.trim()
        : "";
  const paymentMethod =
    body.payment_method === "GUEST_CHECKOUT_GOOGLE_PAY"
      ? "GUEST_CHECKOUT_GOOGLE_PAY"
      : "GUEST_CHECKOUT_APPLE_PAY";

  if (!uid || !paymentAmount) {
    return { status: 400, body: { ok: false, error: "payment_amount required" } };
  }

  try {
    const result = await handleCreateDeposit({
      platform,
      platformUserId: uid,
      paymentAmount,
      paymentMethod,
    });
    return { status: 200, body: { ok: true, ...result } };
  } catch (err) {
    return jsonError(err);
  }
}

export async function bridgeDepositLimits(body: BridgeBody) {
  const platform = platformFromBody(body);
  const uid = platformUserId(body, platform);
  const identity = uid ? getDepositIdentityStatus(platform, uid) : null;
  const phoneNumber =
    typeof body.phone_number === "string"
      ? body.phone_number.trim()
      : identity?.phone ?? "";
  const paymentMethod =
    body.payment_method === "GUEST_CHECKOUT_GOOGLE_PAY"
      ? "GUEST_CHECKOUT_GOOGLE_PAY"
      : "GUEST_CHECKOUT_APPLE_PAY";

  try {
    const limits = await handleCheckLimits({ phoneNumber, paymentMethod });
    return { status: 200, body: { ok: true, limits } };
  } catch (err) {
    return jsonError(err);
  }
}

export async function bridgeDepositLimitsUpgrade(body: BridgeBody) {
  const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
  const ssnLast4 = typeof body.ssn_last4 === "string" ? body.ssn_last4.trim() : "";
  const dob = body.date_of_birth as { day?: string; month?: string; year?: string } | undefined;
  if (!phoneNumber || !ssnLast4 || !dob?.day || !dob?.month || !dob?.year) {
    return {
      status: 400,
      body: { ok: false, error: "phone_number, ssn_last4, date_of_birth required" },
    };
  }
  try {
    const result = await handleUpgradeLimits({
      phoneNumber,
      ssnLast4,
      dateOfBirth: { day: dob.day, month: dob.month, year: dob.year },
    });
    return { status: 200, body: result };
  } catch (err) {
    return jsonError(err);
  }
}
