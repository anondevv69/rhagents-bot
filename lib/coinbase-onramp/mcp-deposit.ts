import {
  getDepositIdentityStatus,
  sendDepositOtp,
  verifyDepositOtp,
} from "@/lib/coinbase-onramp/identity-verification";
import {
  handleCheckLimits,
  handleCreateDeposit,
  HttpError,
} from "@/lib/coinbase-onramp/deposit-routes";
import { cdpConfigured } from "@/lib/coinbase-onramp/onramp-client";

export function getAgentDepositIdentity(agentId: string) {
  return getDepositIdentityStatus("agent", agentId);
}

function depositToolError(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    isError: true,
  };
}

function depositToolOk(data: unknown, note?: string) {
  const payload = note ? { ok: true, note, ...((typeof data === "object" && data) || { data }) } : { ok: true, ...(data as object) };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError: false,
  };
}

export async function mcpWalletDepositIdentity(agentId: string) {
  const identity = getAgentDepositIdentity(agentId);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rhagent.bot";
  return depositToolOk({
    identity,
    cdp_configured: cdpConfigured(),
    verify_hint: identity.ready
      ? null
      : `Collect US phone (+1…) and email from the human, then call wallet_deposit_otp_send and wallet_deposit_otp_verify. Or verify at ${site}/login as agent owner.`,
  });
}

export async function mcpWalletDepositOtpSend(
  agentId: string,
  args: { channel: "phone" | "email"; destination: string },
) {
  try {
    const sent = await sendDepositOtp({
      platform: "agent",
      platformUserId: agentId,
      channel: args.channel,
      destination: args.destination,
    });
    return depositToolOk({
      challenge_id: sent.challengeId,
      expires_at: sent.expiresAt,
      ...(sent.devCode ? { dev_code: sent.devCode, dev_note: "DEPOSIT_OTP_DEV=1 only — give code to human" } : {}),
    });
  } catch (err) {
    return depositToolError(err instanceof Error ? err.message : "otp_send_failed");
  }
}

export async function mcpWalletDepositOtpVerify(
  agentId: string,
  args: {
    challenge_id: string;
    code: string;
    channel: "phone" | "email";
    destination: string;
  },
) {
  const ok = await verifyDepositOtp({
    platform: "agent",
    platformUserId: agentId,
    challengeId: args.challenge_id,
    code: args.code,
    channel: args.channel,
    destination: args.destination,
  });
  if (!ok) return depositToolError("invalid_or_expired_code");
  return depositToolOk({ identity: getAgentDepositIdentity(agentId) });
}

export async function mcpWalletDepositCreate(
  agentId: string,
  args: {
    payment_amount_usd: string;
    payment_method?: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY";
    asset?: string;
  },
) {
  const identity = getAgentDepositIdentity(agentId);
  if (!identity.ready) {
    return depositToolError(
      "phone_and_email_must_be_verified_first — call wallet_deposit_identity, then wallet_deposit_otp_send / wallet_deposit_otp_verify",
    );
  }

  try {
    const result = await handleCreateDeposit({
      platform: "agent",
      platformUserId: agentId,
      phoneNumber: identity.phone!,
      email: identity.email!,
      paymentAmount: args.payment_amount_usd,
      paymentMethod: args.payment_method ?? "GUEST_CHECKOUT_APPLE_PAY",
      asset: args.asset,
    });

    return depositToolOk(
      {
        ...result,
        human_action_required:
          "A human must open paymentLinkUrl in a browser and complete Apple Pay or Google Pay. " +
          "The agent cannot pay on their behalf. Funds land at destinationAddress when paid.",
      },
      "Send paymentLinkUrl to the human at the keyboard — same as Discord deposit flow.",
    );
  } catch (err) {
    if (err instanceof HttpError) return depositToolError(err.message);
    throw err;
  }
}

export async function mcpWalletDepositCheckLimits(
  agentId: string,
  args: { payment_method?: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY" },
) {
  const identity = getAgentDepositIdentity(agentId);
  if (!identity.phone_verified || !identity.phone) {
    return depositToolError("phone_not_verified — complete wallet_deposit_otp_* first");
  }
  try {
    const limits = await handleCheckLimits({
      phoneNumber: identity.phone,
      paymentMethod: args.payment_method ?? "GUEST_CHECKOUT_APPLE_PAY",
    });
    return depositToolOk({ limits });
  } catch (err) {
    if (err instanceof HttpError) return depositToolError(err.message);
    throw err;
  }
}
