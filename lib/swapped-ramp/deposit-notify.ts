/**
 * Notify trading-bot users when a Swapped Ramp deposit completes.
 * Uses rhagent-telegram-agent /internal/deposit-notify (same bridge secret).
 */
export async function notifyDepositComplete(params: {
  platform: "telegram" | "discord";
  platformUserId: string;
  text: string;
}): Promise<boolean> {
  const base =
    process.env.TELEGRAM_AGENT_API_URL?.trim() ||
    "https://rhagent-telegram-agent-production.up.railway.app";
  const secret = process.env.TELEGRAM_BRIDGE_SECRET?.trim();
  if (!secret) {
    console.warn("[swapped-notify] TELEGRAM_BRIDGE_SECRET not set — skip DM");
    return false;
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/internal/deposit-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bridge-Secret": secret,
      },
      body: JSON.stringify({
        platform: params.platform,
        platform_user_id: params.platformUserId,
        text: params.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[swapped-notify] agent HTTP", res.status);
      return false;
    }
    const data = (await res.json()) as { ok?: boolean; delivered?: boolean };
    return Boolean(data.ok && data.delivered);
  } catch (err) {
    console.error("[swapped-notify] agent call failed", err);
    return false;
  }
}
