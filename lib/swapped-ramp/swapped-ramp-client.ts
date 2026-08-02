import crypto from "crypto";

/** Documented sandbox keys — https://docs.swapped.com/swapped-ramp/readme/sandbox-environment */
const SANDBOX_PUBLIC_KEY = "pk_sandbox_rT9bW3sN6mJ8F5hP2cRqLvZ7SaD4XoY9";
const SANDBOX_SECRET_KEY = "sk_sandbox_gV4eT2aK5bP6C7nR3fWmQxY8FdZ9HhE2";

const PRODUCTION_WIDGET = "https://widget.swapped.com";
const SANDBOX_WIDGET = "https://sandbox.swapped.com";

export function swappedSandboxEnabled(): boolean {
  const v = process.env.SWAPPED_SANDBOX?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function swappedKeys(): { publicKey: string; secretKey: string } {
  const sandbox = swappedSandboxEnabled();
  const publicKey =
    process.env.SWAPPED_PUBLIC_KEY?.trim() || (sandbox ? SANDBOX_PUBLIC_KEY : "");
  const secretKey =
    process.env.SWAPPED_SECRET_KEY?.trim() || (sandbox ? SANDBOX_SECRET_KEY : "");
  return { publicKey, secretKey };
}

export function swappedConfigured(): boolean {
  const { publicKey, secretKey } = swappedKeys();
  return Boolean(publicKey && secretKey);
}

export function parseFundAmountUsd(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type SwappedWidgetParams = {
  walletAddress: string;
  amountUsd: string;
  externalCustomerId?: string;
};

export function buildSwappedWidgetUrl(params: SwappedWidgetParams): string {
  const { publicKey, secretKey } = swappedKeys();
  if (!publicKey || !secretKey) {
    throw new Error("swapped_not_configured");
  }

  const sandbox = swappedSandboxEnabled();
  const base = sandbox ? SANDBOX_WIDGET : PRODUCTION_WIDGET;
  const amount = parseFundAmountUsd(params.amountUsd);
  if (amount == null) {
    throw new Error("invalid_amount");
  }

  // Sandbox: ETH testnet only, max €15 — https://docs.swapped.com/swapped-ramp/readme/sandbox-environment
  const currencyCode = sandbox
    ? "ETH"
    : (process.env.SWAPPED_CURRENCY_CODE?.trim() || "USDC_BASE");
  const baseCurrencyCode = sandbox ? "EUR" : "USD";
  const baseCurrencyAmount = sandbox
    ? Math.min(amount, 15).toFixed(2)
    : amount.toFixed(2);

  const qs = new URLSearchParams();
  qs.set("apiKey", publicKey);
  qs.set("currencyCode", currencyCode);
  qs.set("walletAddress", params.walletAddress);
  qs.set("baseCurrencyCode", baseCurrencyCode);
  qs.set("baseCurrencyAmount", baseCurrencyAmount);
  qs.set("method", "creditcard");
  qs.set("lockAmount", "True");
  if (params.externalCustomerId) {
    qs.set("externalCustomerId", params.externalCustomerId);
  }

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (siteUrl) {
    const base = siteUrl.replace(/\/$/, "");
    qs.set(
      "redirectUrl",
      `${base}/fund/${encodeURIComponent(params.walletAddress)}?paid=1`,
    );
    qs.set("responseUrl", `${base}/api/fund/swapped/webhook`);
  }

  const search = `?${qs.toString()}`;
  const signature = crypto.createHmac("sha256", secretKey).update(search).digest("base64");
  return `${base}${search}&signature=${encodeURIComponent(signature)}`;
}

export function swappedDisplayMeta(): {
  sandbox: boolean;
  currencyCode: string;
  fiatCode: string;
  maxAmount: number | null;
} {
  const sandbox = swappedSandboxEnabled();
  return {
    sandbox,
    currencyCode: sandbox ? "ETH" : process.env.SWAPPED_CURRENCY_CODE?.trim() || "USDC_BASE",
    fiatCode: sandbox ? "EUR" : "USD",
    maxAmount: sandbox ? 15 : null,
  };
}
