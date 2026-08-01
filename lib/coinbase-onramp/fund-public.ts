import {
  handleCreateDeposit,
  HttpError,
} from "@/lib/coinbase-onramp/deposit-routes";
import {
  getDepositIdentityStatus,
  sendDepositOtp,
  verifyDepositOtp,
} from "@/lib/coinbase-onramp/identity-verification";
import {
  findAgentByWalletAddress,
  normalizeWalletAddress,
} from "@/lib/coinbase-onramp/wallet-lookup";

const WALLET_PLATFORM = "wallet" as const;

export function fundWalletKey(address: string): string {
  return normalizeWalletAddress(address);
}

export function fundIdentity(address: string) {
  const key = fundWalletKey(address);
  return getDepositIdentityStatus(WALLET_PLATFORM, key);
}

export async function fundOtpSend(
  address: string,
  channel: "phone" | "email",
  destination: string,
) {
  const key = fundWalletKey(address);
  return sendDepositOtp({
    platform: WALLET_PLATFORM,
    platformUserId: key,
    channel,
    destination,
  });
}

export async function fundOtpVerify(
  address: string,
  opts: {
    channel: "phone" | "email";
    destination: string;
    challengeId: string;
    code: string;
  },
) {
  const key = fundWalletKey(address);
  const ok = await verifyDepositOtp({
    challengeId: opts.challengeId,
    code: opts.code,
    platform: WALLET_PLATFORM,
    platformUserId: key,
    channel: opts.channel,
    destination: opts.destination,
  });
  if (!ok) throw new HttpError(400, "invalid_or_expired_code");
  return fundIdentity(address);
}

export async function fundCreateDeposit(address: string, paymentAmount: string) {
  const key = fundWalletKey(address);
  const agent = findAgentByWalletAddress(key);
  const result = await handleCreateDeposit({
    platform: WALLET_PLATFORM,
    platformUserId: key,
    paymentAmount,
    paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
    domain: process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") || "rhagent.bot",
  });
  return { ...result, registered_agent: Boolean(agent) };
}
