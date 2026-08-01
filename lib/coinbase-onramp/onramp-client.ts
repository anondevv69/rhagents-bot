/**
 * Coinbase CDP Headless Onramp client.
 * Docs: https://docs.cdp.coinbase.com/onramp/headless-onramp/overview
 */

import { SignJWT, importPKCS8 } from "jose";

const CDP_BASE_URL = "https://api.cdp.coinbase.com/platform";

interface CdpAuthConfig {
  apiKeyId: string;
  apiKeySecret: string;
}

function getAuthConfig(): CdpAuthConfig {
  const apiKeyId = process.env.CDP_API_KEY_ID?.trim();
  const apiKeySecret = process.env.CDP_API_KEY_SECRET?.trim();
  if (!apiKeyId || !apiKeySecret) {
    throw new Error("CDP_API_KEY_ID and CDP_API_KEY_SECRET must be set");
  }
  return { apiKeyId, apiKeySecret };
}

async function buildCdpJwt(method: string, path: string): Promise<string> {
  const { apiKeyId, apiKeySecret } = getAuthConfig();
  const pem = apiKeySecret.includes("\\n") ? apiKeySecret.replace(/\\n/g, "\n") : apiKeySecret;
  const privateKey = await importPKCS8(pem, "ES256");
  const uri = `${method} api.cdp.coinbase.com${path}`;
  const now = Math.floor(Date.now() / 1000);
  const nonce = cryptoRandomHex(16);

  return new SignJWT({
    sub: apiKeyId,
    iss: "cdp",
    aud: ["cdp_service"],
    uris: [uri],
  })
    .setProtectedHeader({ alg: "ES256", kid: apiKeyId, typ: "JWT", nonce })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(privateKey);
}

function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("hex");
}

async function cdpRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const jwt = await buildCdpJwt(method, path);
  const res = await fetch(`${CDP_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CdpApiError(res.status, text);
  }
  if (res.status === 202) return {} as T;
  return (await res.json()) as T;
}

export class CdpApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`CDP API error ${status}: ${body}`);
  }
}

export interface CreateOnrampOrderParams {
  partnerUserRef: string;
  phoneNumber: string;
  email: string;
  destinationAddress: string;
  network: string;
  asset: string;
  paymentAmount: string;
  paymentMethod: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY";
  domain?: string;
  /** Coinbase-managed verification IDs (preferred over phoneNumberVerifiedAt). */
  smsVerificationId?: string;
  emailVerificationId?: string;
  phoneNumberVerifiedAt?: string;
  agreementAcceptedAt?: string;
}

export interface InitiateOnrampVerificationResponse {
  verificationId: string;
  otpExpiresAt: string;
}

export interface SubmitOnrampVerificationResponse {
  verificationId: string;
  verificationExpiresAt: string;
}

export async function initiateOnrampVerification(params: {
  channel: "sms" | "email";
  destination: string;
}): Promise<InitiateOnrampVerificationResponse> {
  return cdpRequest<InitiateOnrampVerificationResponse>("POST", "/v2/onramp/verifications", {
    channel: params.channel,
    destination: params.destination,
  });
}

export async function submitOnrampVerification(
  verificationId: string,
  otpCode: string,
): Promise<SubmitOnrampVerificationResponse> {
  return cdpRequest<SubmitOnrampVerificationResponse>(
    "POST",
    `/v2/onramp/verifications/${encodeURIComponent(verificationId)}/submit`,
    { otpCode },
  );
}

export interface CreateOnrampOrderResponse {
  orderId: string;
  paymentLinkUrl: string;
  [key: string]: unknown;
}

export async function createOnrampOrder(
  params: CreateOnrampOrderParams,
): Promise<CreateOnrampOrderResponse> {
  const body: Record<string, string> = {
    partnerUserRef: params.partnerUserRef,
    phoneNumber: params.phoneNumber,
    email: params.email,
    destinationAddress: params.destinationAddress,
    network: params.network,
    asset: params.asset,
    paymentAmount: params.paymentAmount,
    paymentMethod: params.paymentMethod,
    agreementAcceptedAt: params.agreementAcceptedAt ?? new Date().toISOString(),
  };
  if (params.domain) body.domain = params.domain;
  if (params.smsVerificationId) body.smsVerificationId = params.smsVerificationId;
  if (params.emailVerificationId) body.emailVerificationId = params.emailVerificationId;
  if (params.phoneNumberVerifiedAt && !params.smsVerificationId) {
    body.phoneNumberVerifiedAt = params.phoneNumberVerifiedAt;
  }
  return cdpRequest<CreateOnrampOrderResponse>("POST", "/v2/onramp/orders", body);
}

export interface OnrampLimit {
  limitType: "weekly_spending" | "lifetime_transactions";
  limit: string;
  remaining: string;
  currency?: string;
}

export interface LimitUpgradeOption {
  status: "unrequested" | "resubmit" | "pending" | "active" | "inactive";
  fields?: Array<"ssnLast4" | "dateOfBirth">;
  limitUpgrades?: Array<{ limitType: string; maxUpgrade: string }>;
}

export interface OnrampLimitsResponse {
  limits: OnrampLimit[];
  limitUpgradeOptions?: [LimitUpgradeOption];
}

export async function getOnrampLimits(
  phoneNumber: string,
  paymentMethodType: "GUEST_CHECKOUT_APPLE_PAY" | "GUEST_CHECKOUT_GOOGLE_PAY",
): Promise<OnrampLimitsResponse> {
  return cdpRequest<OnrampLimitsResponse>("POST", "/v2/onramp/limits", {
    paymentMethodType,
    userIdType: "phone_number",
    userId: phoneNumber,
  });
}

export interface SubmitLimitUpgradeParams {
  phoneNumber: string;
  ssnLast4: string;
  dateOfBirth: { day: string; month: string; year: string };
}

export async function submitLimitUpgrade(params: SubmitLimitUpgradeParams): Promise<void> {
  await cdpRequest<void>("POST", "/v2/onramp/limits/upgrade", {
    userIdType: "phone_number",
    userId: params.phoneNumber,
    fields: {
      ssnLast4: params.ssnLast4,
      dateOfBirth: params.dateOfBirth,
    },
  });
}

export function cdpConfigured(): boolean {
  return Boolean(process.env.CDP_API_KEY_ID?.trim() && process.env.CDP_API_KEY_SECRET?.trim());
}
