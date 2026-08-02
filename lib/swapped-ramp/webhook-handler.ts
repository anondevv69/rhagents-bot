import crypto, { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { findAgentByWalletAddress } from "@/lib/coinbase-onramp/wallet-lookup";
import { swappedKeys } from "@/lib/swapped-ramp/swapped-ramp-client";
import { notifyDepositComplete } from "@/lib/swapped-ramp/deposit-notify";

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

const SUCCESS_STATUSES = new Set(["order_completed", "order_broadcasted"]);

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

function formatUsd(v: number | string | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function buildNotifyMessage(payload: SwappedOrderPayload): string {
  const cryptoAmt = payload.order_crypto_amount ?? "?";
  const crypto = payload.order_crypto ?? "crypto";
  const usd = formatUsd(payload.order_amount_usd_plus_fees ?? payload.order_amount_usd);
  const tx = payload.transaction_id ? `\nTx: ${payload.transaction_id.slice(0, 18)}…` : "";
  const usdLine = usd ? ` (~$${usd})` : "";
  return [
    "Deposit received",
    `${cryptoAmt} ${crypto}${usdLine} is on the way to your wallet.`,
    "Run /buy_credits in chat once it settles (~1–2 min).",
    tx,
  ]
    .filter(Boolean)
    .join("\n");
}

export type WebhookResult =
  | { ok: true; duplicate: boolean; notified: boolean }
  | { ok: false; error: string };

export async function handleSwappedWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResult> {
  if (!verifySwappedWebhookSignature(rawBody, signatureHeader)) {
    return { ok: false, error: "invalid_signature" };
  }

  let payload: SwappedOrderPayload;
  try {
    payload = JSON.parse(rawBody) as SwappedOrderPayload;
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const orderId = payload.order_id?.trim();
  const status = payload.order_status?.trim();
  if (!orderId || !status) {
    return { ok: false, error: "missing_order_fields" };
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT order_id, order_status, notified_at FROM swapped_ramp_orders WHERE order_id = ?`)
    .get(orderId) as
    | { order_id: string; order_status: string; notified_at: string | null }
    | undefined;

  const wallet = walletFromPayload(payload);

  db.prepare(
    `INSERT INTO swapped_ramp_orders (
      order_id, wallet_address, order_status, order_crypto, order_crypto_amount,
      transaction_id, raw_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(order_id) DO UPDATE SET
      wallet_address = COALESCE(excluded.wallet_address, swapped_ramp_orders.wallet_address),
      order_status = excluded.order_status,
      order_crypto = COALESCE(excluded.order_crypto, swapped_ramp_orders.order_crypto),
      order_crypto_amount = COALESCE(excluded.order_crypto_amount, swapped_ramp_orders.order_crypto_amount),
      transaction_id = COALESCE(excluded.transaction_id, swapped_ramp_orders.transaction_id),
      raw_json = excluded.raw_json,
      updated_at = datetime('now')`,
  ).run(
    orderId,
    wallet,
    status,
    payload.order_crypto ?? null,
    payload.order_crypto_amount != null ? String(payload.order_crypto_amount) : null,
    payload.transaction_id ?? null,
    rawBody,
  );

  const alreadyNotified = Boolean(existing?.notified_at);
  const isSuccess = SUCCESS_STATUSES.has(status);
  if (!isSuccess || alreadyNotified) {
    return { ok: true, duplicate: Boolean(existing), notified: false };
  }

  let notified = false;
  if (wallet) {
    const agent = findAgentByWalletAddress(wallet);
    const text = buildNotifyMessage(payload);
    if (agent?.owner_telegram_id) {
      notified =
        (await notifyDepositComplete({
          platform: "telegram",
          platformUserId: agent.owner_telegram_id,
          text,
        })) || notified;
    }
    if (agent?.owner_discord_id) {
      notified =
        (await notifyDepositComplete({
          platform: "discord",
          platformUserId: agent.owner_discord_id,
          text,
        })) || notified;
    }
  }

  if (notified) {
    db.prepare(
      `UPDATE swapped_ramp_orders SET notified_at = datetime('now') WHERE order_id = ?`,
    ).run(orderId);
  }

  console.info("[swapped-webhook]", {
    order_id: orderId,
    status,
    wallet,
    notified,
  });

  return { ok: true, duplicate: Boolean(existing), notified };
}
