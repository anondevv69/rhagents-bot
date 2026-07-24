/**
 * Bankr Partner wallet provisioning — auto-create wallets for agents across channels.
 * Docs: https://docs.bankr.bot/partnership/wallet-provisioning
 *
 * Partner key (BANKR_PARTNER_KEY) is server-only. Wallet API keys (bk_usr_*) are returned
 * once at provision time — callers must store encrypted (telegram vault), never log them.
 */

import { resolveWalletMe } from "./bankr";
import { getDb, type Agent } from "./db";
import { linkBankrChainWallet } from "./link-chain-wallet";
import { scheduleInscribeAgent } from "./inscriber";
import { DEFAULT_BANKR_SKILL_INSTALLS } from "./bankr-default-skills";
import {
  buildPartnerFundPayload,
  buildStarterCreditFundPayload,
  defaultWalletApiKeyBody,
  type PartnerFundPayload,
} from "./bankr-partner-config";

const BANKR_API = "https://api.bankr.bot";

export type ProvisionChannel = "rhagents" | "telegram" | "discord" | "bankr" | "web";

export interface ProvisionResult {
  ok: true;
  evm_address: string;
  wallet_id: string | null;
  provisioned: boolean;
  existing: boolean;
  /** Only returned to trusted server callers (bridge) on first provision. */
  api_key?: string;
}

export interface ProvisionError {
  ok: false;
  error: string;
  status: number;
}

export function isWalletApiKey(key: string): boolean {
  return key.startsWith("bk_usr_");
}

export function isPartnerApiKey(key: string): boolean {
  return key.startsWith("bk_ptr_");
}

function partnerKey(): string | null {
  const k = process.env.BANKR_PARTNER_KEY?.trim();
  return k && isPartnerApiKey(k) ? k : null;
}

function idempotencyKey(channel: ProvisionChannel, externalId: string): string {
  return `${channel}:${externalId}`.slice(0, 128);
}

async function partnerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = partnerKey();
  if (!key) throw new Error("BANKR_PARTNER_KEY not configured");

  const res = await fetch(`${BANKR_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Partner-Key": key,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Bankr partner API error (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : `Bankr partner API error (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

interface CreateWalletResponse {
  id: string;
  evmAddress: string;
  solAddress?: string;
  idempotencyKey?: string;
  apiKey?: string;
  fund?: unknown;
}

async function generateWalletApiKey(
  walletId: string,
  channel: ProvisionChannel,
): Promise<string | undefined> {
  const keyRes = await partnerFetch<{ apiKey: string }>(
    `/partner/wallets/${encodeURIComponent(walletId)}/api-keys`,
    {
      method: "POST",
      body: JSON.stringify(defaultWalletApiKeyBody(channel)),
    },
  );
  return keyRes.apiKey;
}

interface PartnerApiKeyMeta {
  keyId: string;
  llmGatewayEnabled?: boolean;
  agentApiEnabled?: boolean;
  isActive?: boolean;
}

interface PartnerWalletDetail {
  id: string;
  evmAddress?: string;
}

/** GET /partner/wallets/:identifier — id, EVM address, or Solana address. */
export async function getPartnerWallet(identifier: string): Promise<PartnerWalletDetail | null> {
  try {
    return await partnerFetch<PartnerWalletDetail>(
      `/partner/wallets/${encodeURIComponent(identifier)}`,
    );
  } catch {
    return null;
  }
}

async function listPartnerWalletApiKeys(walletId: string): Promise<PartnerApiKeyMeta[]> {
  const list = await partnerFetch<{ apiKeys: PartnerApiKeyMeta[] }>(
    `/partner/wallets/${encodeURIComponent(walletId)}/api-keys`,
  );
  return list.apiKeys ?? [];
}

function activeLlmKey(keys: PartnerApiKeyMeta[]): boolean {
  return keys.some((k) => k.isActive !== false && k.llmGatewayEnabled === true);
}

/** Enable LLM Gateway (+ ensure Agent API) on all active keys for a provisioned wallet. */
export async function enableLlmGatewayOnWallet(
  identifier: string,
  channel: ProvisionChannel = "telegram",
): Promise<{ updated: number; walletId: string; apiKey?: string }> {
  const wallet = await getPartnerWallet(identifier);
  if (!wallet?.id) {
    throw new Error("wallet_not_found");
  }
  const walletId = wallet.id;

  let updated = 0;
  let keys = await listPartnerWalletApiKeys(walletId);
  for (const k of keys) {
    if (k.isActive === false) continue;
    if (k.llmGatewayEnabled) continue;
    await partnerFetch(
      `/partner/wallets/${encodeURIComponent(walletId)}/api-keys/${encodeURIComponent(k.keyId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          permissions: {
            llmGatewayEnabled: true,
            agentApiEnabled: true,
            readOnly: false,
          },
        }),
      },
    );
    updated++;
  }

  keys = await listPartnerWalletApiKeys(walletId);
  if (!activeLlmKey(keys)) {
    const keyRes = await partnerFetch<{ apiKey: string }>(
      `/partner/wallets/${encodeURIComponent(walletId)}/api-keys`,
      {
        method: "POST",
        body: JSON.stringify(defaultWalletApiKeyBody(channel)),
      },
    );
    if (!keyRes.apiKey) {
      throw new Error("llm_gateway_enable_failed");
    }
    return { updated, walletId, apiKey: keyRes.apiKey };
  }

  return { updated, walletId };
}

/** POST /partner/wallets/:identifier/fund — Robinhood Chain only. */
export async function fundProvisionedWallet(
  identifier: string,
  fund?: PartnerFundPayload | null,
): Promise<void> {
  const payload = fund ?? buildPartnerFundPayload();
  if (!payload) return;

  await partnerFetch(`/partner/wallets/${encodeURIComponent(identifier)}/fund`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Create or fetch a provisioned wallet (idempotent). */
export async function provisionBankrWallet(
  channel: ProvisionChannel,
  externalId: string,
  opts: { fund?: boolean } = {},
): Promise<ProvisionResult | ProvisionError> {
  const pk = partnerKey();
  if (!pk) {
    return { ok: false, error: "bankr_partner_not_configured", status: 503 };
  }

  const fundPayload = opts.fund !== false ? buildPartnerFundPayload() : null;

  const body: Record<string, unknown> = {
    idempotencyKey: idempotencyKey(channel, externalId),
    wallet: { solana: false },
    apiKey: defaultWalletApiKeyBody(channel),
  };

  if (fundPayload) {
    body.fund = fundPayload;
  }

  try {
    let lastErr: ProvisionError | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${BANKR_API}/partner/wallets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partner-Key": pk,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: CreateWalletResponse & { error?: string };
      try {
        data = text ? (JSON.parse(text) as CreateWalletResponse & { error?: string }) : ({} as CreateWalletResponse);
      } catch {
        lastErr = {
          ok: false,
          error: `Bankr partner API error (${res.status}): ${text.slice(0, 200)}`,
          status: res.status >= 500 ? 502 : res.status,
        };
        if (res.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return lastErr;
      }
      if (!res.ok) {
        lastErr = {
          ok: false,
          error: data.error || "provision_failed",
          status: res.status,
        };
        if (res.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return lastErr;
      }

      let apiKey = data.apiKey;
      if (!apiKey && data.id) {
        apiKey = await generateWalletApiKey(data.id, channel);
      }

      // Idempotent replays skip create-time fund — fund on Robinhood Chain if env requests it.
      if (fundPayload && data.id && data.fund == null) {
        await fundProvisionedWallet(data.id, fundPayload).catch((err) => {
          console.warn("[bankr-provision] post-provision fund failed", err);
        });
      }

      // Starter LLM credit seed — Base USDC, separate balance from the Robinhood Chain fund
      // above. Best-effort: a failure here should never block wallet provisioning.
      const creditPayload = buildStarterCreditFundPayload();
      if (creditPayload && data.id) {
        await fundProvisionedWallet(data.id, creditPayload).catch((err) => {
          console.warn("[bankr-provision] starter credit fund failed", err);
        });
      }

      if (!data.evmAddress || !data.id) {
        return { ok: false, error: "provision_failed", status: 502 };
      }

      return {
        ok: true,
        evm_address: data.evmAddress.toLowerCase(),
        wallet_id: data.id,
        provisioned: true,
        existing: false,
        api_key: apiKey,
      };
    }
    return lastErr ?? { ok: false, error: "provision_failed", status: 502 };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "provision_failed",
      status: 502,
    };
  }
}

/** Link an existing Bankr terminal user's wallet (bk_usr_* key). */
export async function resolveExistingBankrWallet(
  bankrApiKey: string,
): Promise<ProvisionResult | ProvisionError> {
  const key = bankrApiKey.trim();
  if (!key) {
    return { ok: false, error: "bankr_api_key required", status: 400 };
  }

  const evm = await resolveWalletMe(key);
  if (!evm) {
    return { ok: false, error: "invalid_bankr_api_key", status: 401 };
  }

  return {
    ok: true,
    evm_address: evm.toLowerCase(),
    wallet_id: null,
    provisioned: false,
    existing: true,
    api_key: isWalletApiKey(key) ? key : undefined,
  };
}

/**
 * Resolve existing wallet OR auto-provision.
 * - userApiKey present → existing Bankr terminal user (no new wallet)
 * - otherwise → partner provision with idempotencyKey
 */
export async function resolveOrProvisionBankrWallet(
  channel: ProvisionChannel,
  externalId: string,
  userApiKey?: string | null,
): Promise<ProvisionResult | ProvisionError> {
  if (userApiKey?.trim()) {
    return resolveExistingBankrWallet(userApiKey.trim());
  }
  return provisionAndSetupWallet(channel, externalId);
}

/** Write bankr_wallet + optional wallet_id on an agent; auto chain-verify when hold passes. */
export async function attachBankrWalletToAgent(
  agentId: string,
  evmAddress: string,
  walletId: string | null,
  provisioned: boolean,
): Promise<Agent | null> {
  const wallet = evmAddress.toLowerCase();
  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent | undefined;
  if (!agent) return null;

  const taken = db
    .prepare(`SELECT id FROM agents WHERE LOWER(bankr_wallet) = ? AND id != ?`)
    .get(wallet, agentId);
  if (taken) return agent;

  db.prepare(
    `UPDATE agents SET bankr_wallet = ?, bankr_wallet_id = ?, bankr_provisioned = ? WHERE id = ?`,
  ).run(wallet, walletId, provisioned ? 1 : 0, agentId);

  let updated = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
  if (!updated.has_chain) {
    const chain = await linkBankrChainWallet(agentId, wallet as `0x${string}`);
    if (chain.ok) {
      updated = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
    }
  }
  scheduleInscribeAgent(updated);
  return updated;
}

/** Auto-provision + attach after agent registration if no wallet yet. */
export async function autoProvisionAgentWallet(agentId: string): Promise<{
  attached: boolean;
  evm_address?: string;
  provisioned?: boolean;
  error?: string;
}> {
  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent | undefined;
  if (!agent) return { attached: false, error: "agent_not_found" };
  if (agent.bankr_wallet) {
    return { attached: false, evm_address: agent.bankr_wallet, provisioned: !!agent.bankr_provisioned };
  }

  const result = await provisionAndSetupWallet("rhagents", agentId);
  if (!result.ok) {
    return { attached: false, error: result.error };
  }

  await attachBankrWalletToAgent(agentId, result.evm_address, result.wallet_id, result.provisioned);
  return {
    attached: true,
    evm_address: result.evm_address,
    provisioned: result.provisioned,
  };
}

/** Save RH credentials to Bankr wallet env (server-side, trusted callers only). */
export async function setBankrWalletEnv(
  walletApiKey: string,
  vars: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${BANKR_API}/agent/env`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": walletApiKey,
    },
    body: JSON.stringify({ vars }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bankr env save failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Install default RH skills on a provisioned wallet (best-effort, async on Bankr side).
 * Skipped for existing terminal users who linked bk_usr_* — they may already have skills.
 */
export async function installDefaultBankrSkills(walletApiKey: string): Promise<void> {
  for (const prompt of DEFAULT_BANKR_SKILL_INSTALLS) {
    try {
      await fetch(`${BANKR_API}/agent/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": walletApiKey,
        },
        body: JSON.stringify({ prompt }),
      });
    } catch {
      /* best effort — provision succeeds even if skill queue fails */
    }
  }
}

/** Provision + attach + install default skills. */
export async function provisionAndSetupWallet(
  channel: ProvisionChannel,
  externalId: string,
): Promise<ProvisionResult | ProvisionError> {
  const result = await provisionBankrWallet(channel, externalId);
  if (result.ok && result.api_key && result.provisioned) {
    await installDefaultBankrSkills(result.api_key).catch(() => undefined);
  }
  return result;
}
