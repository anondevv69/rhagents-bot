import crypto, { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { findAgentByWalletAddress } from "@/lib/coinbase-onramp/wallet-lookup";
import {
  swappedKeys,
  swappedSandboxEnabled,
} from "@/lib/swapped-ramp/swapped-ramp-client";
import {
  notifyDepositComplete,
  triggerDepositCredit,
} from "@/lib/swapped-ramp/deposit-notify";

export type SwappedOrderPayload = {
  order_id: string;
  order_status: string;
  order_crypto?: string;
  order_crypto_amount?: number | string;
  order_crypto_address?: string;
  external_customer_id?: string | null;
  transaction_id?: string;
  order_amount_usd?: number | string;
  order_amount_usd_plus_fees?: number | string;
  network?: string;
};

/** Credit once payment succeeds; order_broadcasted confirms on-chain delivery. */
const CREDIT_STATUSES = new Set(["order_completed", "order_broadcasted"]);

export function verifySwappedWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const { secretKey } = swappedKeys();
  if (!secretKey || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(signatureHeader.trim());
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function walletFromPayload(payload: SwappedOrderPayload): string | null {
  const raw =
    payload.order_crypto_address?.trim() ||
    payload.external_customer_id?.trim() ||
    "";
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw.toLowerCase();
}

function creditAmountUsd(payload: SwappedOrderPayload): number {
  const raw = payload.order_amount_usd ?? payload.order_amount_usd_plus_fees;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(n, 1000);
}

function buildFallbackNotifyMessage(payload: SwappedOrderPayload): string {
  const usd = creditAmountUsd(payload);
  return [
    `Deposit received (~$${usd.toFixed(2)} USDC).`,
    "Credits are converting automatically — if chat doesn't work in 2 min, run /buy_credits.",
  ].join("\n");
}

export type WebhookResult =
  | {
      ok: true;
      httpStatus: 200 | 409;
      alreadyCredited: boolean;
      credited: boolean;
      notified: boolean;
    }
  | { ok: false; error: string; httpStatus: 401 | 400 | 503 };

export async function handleSwappedWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResult> {
  if (!verifySwappedWebhookSignature(rawBody, signatureHeader)) {
    return { ok: false, error: "invalid_signature", httpStatus: 401 };
  }

  let payload: SwappedOrderPayload;
  try {
    payload = JSON.parse(rawBody) as SwappedOrderPayload;
  } catch {
    return { ok: false, error: "invalid_json", httpStatus: 400 };
  }

  const orderId = payload.order_id?.trim();
  const status = payload.order_status?.trim();
  if (!orderId || !status) {
    return { ok: false, error: "missing_order_fields", httpStatus: 400 };
  }

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT order_id, order_status, credited_at, credit_attempts FROM swapped_ramp_orders WHERE order_id = ?`,
    )
    .get(orderId) as
    | {
        order_id: string;
        order_status: string;
        credited_at: string | null;
        credit_attempts: number | null;
      }
    | undefined;

  if (existing?.credited_at) {
    return {
      ok: true,
      httpStatus: 409,
      alreadyCredited: true,
      credited: false,
      notified: false,
    };
  }

  const wallet = walletFromPayload(payload);
  const amountUsd = creditAmountUsd(payload);

  db.prepare(
    `INSERT INTO swapped_ramp_orders (
      order_id, wallet_address, order_status, order_crypto, order_crypto_amount,
      order_amount_usd, transaction_id, raw_json, credit_attempts, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    ON CONFLICT(order_id) DO UPDATE SET
      wallet_address = COALESCE(excluded.wallet_address, swapped_ramp_orders.wallet_address),
      order_status = excluded.order_status,
      order_crypto = COALESCE(excluded.order_crypto, swapped_ramp_orders.order_crypto),
      order_crypto_amount = COALESCE(excluded.order_crypto_amount, swapped_ramp_orders.order_crypto_amount),
      order_amount_usd = COALESCE(excluded.order_amount_usd, swapped_ramp_orders.order_amount_usd),
      transaction_id = COALESCE(excluded.transaction_id, swapped_ramp_orders.transaction_id),
      raw_json = excluded.raw_json,
      updated_at = datetime('now')`,
  ).run(
    orderId,
    wallet,
    status,
    payload.order_crypto ?? null,
    payload.order_crypto_amount != null ? String(payload.order_crypto_amount) : null,
    String(amountUsd),
    payload.transaction_id ?? null,
    rawBody,
  );

  if (!CREDIT_STATUSES.has(status)) {
    return {
      ok: true,
      httpStatus: 200,
      alreadyCredited: false,
      credited: false,
      notified: false,
    };
  }

  const sandbox = swappedSandboxEnabled();
  let credited = false;
  let notified = false;
  let creditError: string | null = null;
  let shouldRetry = false;

  if (wallet) {
    const agent = findAgentByWalletAddress(wallet);

    if (!sandbox && agent) {
      const attempts = (existing?.credit_attempts ?? 0) + 1;
      db.prepare(`UPDATE swapped_ramp_orders SET credit_attempts = ? WHERE order_id = ?`).run(
        attempts,
        orderId,
      );

      if (agent.owner_telegram_id) {
        const credit = await triggerDepositCredit({
          platform: "telegram",
          platformUserId: agent.owner_telegram_id,
          walletAddress: wallet,
          amountUsd,
          orderId,
          sandbox: false,
        });
        credited = credit.credited;
        shouldRetry = credit.retry;
        creditError = credit.error ?? null;
      } else if (agent.owner_discord_id) {
        const credit = await triggerDepositCredit({
          platform: "discord",
          platformUserId: agent.owner_discord_id,
          walletAddress: wallet,
          amountUsd,
          orderId,
          sandbox: false,
        });
        credited = credit.credited;
        shouldRetry = credit.retry;
        creditError = credit.error ?? null;
      }
    }

    if (credited) {
      db.prepare(
        `UPDATE swapped_ramp_orders SET credited_at = datetime('now'), credit_amount_usd = ?, credit_error = NULL WHERE order_id = ?`,
      ).run(String(amountUsd), orderId);
    } else if (creditError) {
      db.prepare(`UPDATE swapped_ramp_orders SET credit_error = ? WHERE order_id = ?`).run(
        creditError.slice(0, 500),
        orderId,
      );
    }

    if (!credited && agent) {
      const text = sandbox
        ? "Sandbox deposit complete (testnet ETH — no auto-credits). Use production keys for USDC on Base."
        : buildFallbackNotifyMessage(payload);
      if (agent.owner_telegram_id) {
        notified =
          (await notifyDepositComplete({
            platform: "telegram",
            platformUserId: agent.owner_telegram_id,
            text,
          })) || notified;
      }
      if (agent.owner_discord_id) {
        notified =
          (await notifyDepositComplete({
            platform: "discord",
            platformUserId: agent.owner_discord_id,
            text,
          })) || notified;
      }
    }
  }

  console.info("[swapped-webhook]", {
    order_id: orderId,
    status,
    wallet,
    credited,
    shouldRetry,
    sandbox,
  });

  if (shouldRetry && !credited) {
    return { ok: false, error: creditError ?? "credit_pending", httpStatus: 503 };
  }

  return {
    ok: true,
    httpStatus: 200,
    alreadyCredited: false,
    credited,
    notified,
  };
}
