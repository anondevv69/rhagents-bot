import {
  createOnrampOrder,
  getOnrampLimits,
  submitLimitUpgrade,
  CdpApiError,
  cdpConfigured,
} from "@/lib/coinbase-onramp/onramp-client";
import { assertDepositIdentityReady } from "@/lib/coinbase-onramp/identity-store";
import { resolveWalletAddress, type DepositPlatform } from "@/lib/coinbase-onramp/wallet-lookup";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface CreateDepositRequest {
  platform: DepositPlatform;
  platformUserId: string;
  phoneNumber?: string;
  email?: string;
  paymentAmount: string;
  asset?: string;
  paymentMethod: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY";
  domain?: string;
}

export interface CreateDepositResponse {
  orderId: string;
  paymentLinkUrl: string;
  destinationAddress: string;
  mini_app_path: string;
  fund_pay_path?: string;
}

export async function handleCreateDeposit(
  body: CreateDepositRequest,
): Promise<CreateDepositResponse> {
  if (!cdpConfigured()) {
    throw new HttpError(503, "Coinbase onramp not configured — set CDP_API_KEY_ID and CDP_API_KEY_SECRET");
  }

  let phoneNumber = body.phoneNumber?.trim();
  let email = body.email?.trim();
  if (!phoneNumber || !email) {
    try {
      const id = assertDepositIdentityReady(body.platform, body.platformUserId);
      phoneNumber = phoneNumber ?? id.phoneNumber;
      email = email ?? id.email;
    } catch {
      throw new HttpError(
        400,
        "phoneNumber and email must be verified before deposit — run /verify in the trading bot first",
      );
    }
  }

  if (!body.paymentAmount || Number(body.paymentAmount) <= 0) {
    throw new HttpError(400, "paymentAmount must be a positive USD amount");
  }

  const wallet = await resolveWalletAddress({
    platform: body.platform,
    platformUserId: body.platformUserId,
  });

  const sandboxPrefix = process.env.COINBASE_ONRAMP_SANDBOX === "1" ? "sandbox-" : "";

  try {
    const order = await createOnrampOrder({
      partnerUserRef: `${sandboxPrefix}${body.platform}:${body.platformUserId}`,
      phoneNumber: phoneNumber!,
      email: email!,
      destinationAddress: wallet.address,
      network: wallet.network,
      asset: body.asset ?? process.env.COINBASE_ONRAMP_ASSET?.trim() ?? "USDC",
      paymentAmount: body.paymentAmount,
      paymentMethod: body.paymentMethod,
      domain: body.domain,
    });

    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rhagent.bot";
    const miniBase =
      process.env.TELEGRAM_MINIAPP_BASE?.trim() || `${site}/telegram/deposit`;
    const fundPayBase = `${site}/fund/${wallet.address}/pay`;

    return {
      orderId: order.orderId,
      paymentLinkUrl: order.paymentLinkUrl,
      destinationAddress: wallet.address,
      mini_app_path: `${miniBase}?orderId=${encodeURIComponent(order.orderId)}&paymentLinkUrl=${encodeURIComponent(order.paymentLinkUrl)}`,
      fund_pay_path: `${fundPayBase}?orderId=${encodeURIComponent(order.orderId)}&paymentLinkUrl=${encodeURIComponent(order.paymentLinkUrl)}`,
    };
  } catch (err) {
    if (err instanceof CdpApiError) {
      throw new HttpError(err.status >= 500 ? 502 : 400, err.message);
    }
    throw err;
  }
}

export async function handleCheckLimits(body: {
  phoneNumber: string;
  paymentMethod: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY";
}) {
  if (!cdpConfigured()) {
    throw new HttpError(503, "Coinbase onramp not configured");
  }
  if (!body.phoneNumber?.trim()) {
    throw new HttpError(400, "phoneNumber is required");
  }
  return getOnrampLimits(body.phoneNumber.trim(), body.paymentMethod);
}

export async function handleUpgradeLimits(body: {
  phoneNumber: string;
  ssnLast4: string;
  dateOfBirth: { day: string; month: string; year: string };
}): Promise<{ ok: true }> {
  if (!cdpConfigured()) {
    throw new HttpError(503, "Coinbase onramp not configured");
  }
  if (!/^\d{4}$/.test(body.ssnLast4)) {
    throw new HttpError(400, "ssnLast4 must be exactly 4 numeric digits");
  }
  await submitLimitUpgrade(body);
  return { ok: true };
}
