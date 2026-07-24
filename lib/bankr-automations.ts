/**
 * Bankr automations — DCA / limit / stop / TWAP orders on a provisioned wallet.
 *
 * Bankr has no separate "create scheduled job" REST endpoint. Recurring and price-triggered
 * on-chain automations are created the same way any other agent action is: a natural-language
 * prompt to POST /agent/prompt (https://docs.bankr.bot/agent-api/prompt-endpoint), which Bankr's
 * own agent parses, stores, and executes going forward. Cancellation works the same way
 * ("cancel my limit order" / "cancel all my automations").
 *
 * This file only composes well-formed prompts from structured input and submits/polls/cancels
 * them via the wallet's own Agent API key (bk_usr_...). rhagent.bot does not store or schedule
 * the automation itself — Bankr does, once the prompt is accepted. What rhagent.bot DOES own:
 * the form/UI that builds the prompt, and a local record (jobId/threadId + description) so the
 * automation shows up in rhagent's own unified events view without sending the user to bankr.bot.
 */

const BANKR_API = "https://api.bankr.bot";

export type AutomationKind = "dca" | "limit_buy" | "limit_sell" | "stop" | "twap";

export interface DcaAutomationInput {
  kind: "dca";
  amountUsd: number;
  fromToken: string;
  toToken: string;
  /** e.g. "day", "6 hours", "hour" */
  every: string;
  /** optional total duration, e.g. "7 days" */
  forDuration?: string;
  /** optional clock time, e.g. "9am" — only meaningful with every: "day" */
  atTime?: string;
}

export interface LimitAutomationInput {
  kind: "limit_buy" | "limit_sell";
  token: string;
  /** USD amount (buy) or token amount / "all" (sell) */
  amount: string;
  /** e.g. "drops 10%", "rises 20%", "reaches $50,000" */
  triggerCondition: string;
}

export interface StopAutomationInput {
  kind: "stop";
  token: string;
  amount: string;
  dropPercent: number;
}

export interface TwapAutomationInput {
  kind: "twap";
  amount: string;
  token: string;
  overDuration: string;
}

export type AutomationInput =
  | DcaAutomationInput
  | LimitAutomationInput
  | StopAutomationInput
  | TwapAutomationInput;

/** Compose the natural-language prompt Bankr's agent expects for a given automation. */
export function buildAutomationPrompt(input: AutomationInput): string {
  switch (input.kind) {
    case "dca": {
      const cadence = input.atTime ? `every ${input.every} at ${input.atTime}` : `every ${input.every}`;
      const duration = input.forDuration ? ` for ${input.forDuration}` : "";
      return `DCA $${input.amountUsd} ${input.fromToken} into ${input.toToken} ${cadence}${duration}`;
    }
    case "limit_buy":
      return `buy ${input.amount} of ${input.token} if it ${input.triggerCondition}`;
    case "limit_sell":
      return `sell ${input.amount} of ${input.token} when it ${input.triggerCondition}`;
    case "stop":
      return `sell ${input.amount} of ${input.token} if it drops ${input.dropPercent}%`;
    case "twap":
      return `sell ${input.amount} ${input.token} over the next ${input.overDuration}`;
  }
}

export interface SubmitAutomationResult {
  ok: true;
  jobId: string;
  threadId: string | null;
  prompt: string;
}

export interface AutomationError {
  ok: false;
  error: string;
  status: number;
}

/** Submit a prompt to the wallet's Bankr Agent API. Returns immediately (202) with a jobId. */
export async function submitBankrPrompt(
  walletApiKey: string,
  prompt: string,
): Promise<SubmitAutomationResult | AutomationError> {
  try {
    const res = await fetch(`${BANKR_API}/agent/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": walletApiKey,
      },
      body: JSON.stringify({ prompt }),
    });
    const text = await res.text();
    let data: { jobId?: string; threadId?: string; error?: string; message?: string };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, error: `Bankr agent API error (${res.status}): ${text.slice(0, 200)}`, status: res.status };
    }
    if (!res.ok || !data.jobId) {
      return {
        ok: false,
        error: data.error || data.message || "automation_submit_failed",
        status: res.status || 502,
      };
    }
    return { ok: true, jobId: data.jobId, threadId: data.threadId ?? null, prompt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "automation_submit_failed", status: 502 };
  }
}

/** Create a Bankr automation from structured input — composes the prompt and submits it. */
export async function createBankrAutomation(
  walletApiKey: string,
  input: AutomationInput,
): Promise<SubmitAutomationResult | AutomationError> {
  const prompt = buildAutomationPrompt(input);
  return submitBankrPrompt(walletApiKey, prompt);
}

/** Cancel a specific automation or all of them, by natural-language description. */
export async function cancelBankrAutomation(
  walletApiKey: string,
  description?: string,
): Promise<SubmitAutomationResult | AutomationError> {
  const prompt = description ? `cancel my ${description}` : "cancel all my automations";
  return submitBankrPrompt(walletApiKey, prompt);
}

export type BankrJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface BankrJobDetail {
  jobId: string;
  status: BankrJobStatus;
  prompt: string;
  response?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/** Poll a submitted job/automation-creation prompt for its result. */
export async function getBankrJob(
  walletApiKey: string,
  jobId: string,
): Promise<BankrJobDetail | AutomationError> {
  try {
    const res = await fetch(`${BANKR_API}/agent/job/${encodeURIComponent(jobId)}`, {
      headers: { "X-API-Key": walletApiKey },
    });
    const text = await res.text();
    let data: BankrJobDetail & { error?: string; message?: string };
    try {
      data = text ? JSON.parse(text) : ({} as BankrJobDetail);
    } catch {
      return { ok: false, error: `Bankr job API error (${res.status})`, status: res.status };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || data.message || "job_lookup_failed", status: res.status };
    }
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "job_lookup_failed", status: 502 };
  }
}
