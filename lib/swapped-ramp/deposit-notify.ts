/**
 * Trading-bot integration for Swapped Ramp webhooks.
 */
export type DepositCreditResponse =
  | { ok: true; credited: true; amountUsd?: number }
  | { ok: true; credited: false; reason?: string }
  | { ok: false; retry?: boolean; error?: string };

async function agentPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const base =
    process.env.TELEGRAM_AGENT_API_URL?.trim() ||
    "https://rhagent-telegram-agent-production.up.railway.app";
  const secret = process.env.TELEGRAM_BRIDGE_SECRET?.trim();
  if (!secret) {
    console.warn("[swapped-agent] TELEGRAM_BRIDGE_SECRET not set");
    return null;
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bridge-Secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    return (await res.json()) as T;
  } catch (err) {
    console.error("[swapped-agent] call failed", path, err);
    return null;
  }
}

export async function notifyDepositComplete(params: {
  platform: "telegram" | "discord";
  platformUserId: string;
  text: string;
}): Promise<boolean> {
  const data = await agentPost<{ ok?: boolean; delivered?: boolean }>(
    "/internal/deposit-notify",
    {
      platform: params.platform,
      platform_user_id: params.platformUserId,
      text: params.text,
    },
  );
  return Boolean(data?.ok && data.delivered);
}

export async function triggerDepositCredit(params: {
  platform: "telegram" | "discord";
  platformUserId: string;
  walletAddress: string;
  amountUsd: number;
  orderId: string;
  sandbox: boolean;
}): Promise<{ credited: boolean; retry: boolean; error?: string }> {
  const res = await fetch(
    `${(process.env.TELEGRAM_AGENT_API_URL?.trim() || "https://rhagent-telegram-agent-production.up.railway.app").replace(/\/$/, "")}/internal/deposit-credit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bridge-Secret": process.env.TELEGRAM_BRIDGE_SECRET?.trim() ?? "",
      },
      body: JSON.stringify({
        platform: params.platform,
        platform_user_id: params.platformUserId,
        wallet_address: params.walletAddress,
        amount_usd: params.amountUsd,
        order_id: params.orderId,
        sandbox: params.sandbox,
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );

  const data = (await res.json()) as DepositCreditResponse;

  if (res.status === 503 || (data && !data.ok && "retry" in data && data.retry)) {
    return { credited: false, retry: true, error: data && "error" in data ? data.error : "retry" };
  }

  if (!res.ok) {
    return {
      credited: false,
      retry: false,
      error: data && "error" in data ? data.error : `HTTP ${res.status}`,
    };
  }

  if (data && "credited" in data && data.credited) {
    return { credited: true, retry: false };
  }

  return {
    credited: false,
    retry: false,
    error: data && "reason" in data ? String(data.reason) : "not_credited",
  };
}
