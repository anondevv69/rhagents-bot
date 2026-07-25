/**
 * Bankr Partner API client — single source of truth for all Bankr interactions.
 *
 * Every Bankr call in the platform goes through this module. The partner key
 * (bk_ptr_*) is server-only and never exposed to clients or bots.
 *
 * Docs: https://docs.bankr.bot/partnership/wallet-provisioning
 */

import type {
  BankrProvisionResponse,
  BankrFundPayload,
  BankrLlmCredits,
  BankrWalletInfo,
  Platform,
} from "./types.js";

const BANKR_API = "https://api.bankr.bot";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface BankrClientConfig {
  partnerKey: string;
  starterCreditUsd?: number;
  fundEth?: string;
  fundChain?: string;
}

export class BankrClient {
  private key: string;
  private starterCreditUsd: number;
  private fundEth: string | null;

  constructor(config: BankrClientConfig) {
    this.key = config.partnerKey;
    this.starterCreditUsd = config.starterCreditUsd ?? 0;
    this.fundEth = config.fundEth ?? null;
  }

  /** Authenticated fetch against Bankr Partner API. */
  private async partnerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BANKR_API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Partner-Key": this.key,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Bankr API error (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "error" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).error)
          : `Bankr API error (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  }

  /** Authenticated fetch using a wallet's own API key. */
  private async walletFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BANKR_API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Bankr wallet API error (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "error" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).error)
          : `Bankr wallet API error (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  }

  // ─── Wallet Provisioning ───

  /**
   * Idempotent wallet creation. Returns apiKey only on first creation (201).
   * On replay (200), the key is never re-exposed — caller must repair.
   */
  async provisionWallet(
    platform: Platform,
    externalId: string,
    platformUserId?: string,
  ): Promise<BankrProvisionResponse> {
    const idempotencyKey = `${platform}:${externalId}`.slice(0, 128);
    const apiKeyBody = {
      name: `rhagent-${platform}`.slice(0, 64),
      permissions: {
        agentApiEnabled: true,
        llmGatewayEnabled: true,
        tokenLaunchApiEnabled: false,
        readOnly: false,
      },
    };

    const fundPayload = this.buildFundPayload();
    const body: Record<string, unknown> = {
      idempotencyKey,
      wallet: { solana: false },
      apiKey: apiKeyBody,
    };
    if (fundPayload) body.fund = fundPayload;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${BANKR_API}/partner/wallets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Partner-Key": this.key,
          },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) {
          if (res.status >= 500 && attempt < 2) {
            await this.sleep(400 * (attempt + 1));
            continue;
          }
          return { ok: false, error: data.error || `provision_failed (${res.status})` };
        }

        const isNew = res.status === 201;
        let apiKey = data.apiKey;

        // If 201 but no key in response, mint one explicitly
        if (!apiKey && data.id && isNew) {
          const keyRes = await this.partnerFetch<{ apiKey: string }>(
            `/partner/wallets/${encodeURIComponent(data.id)}/api-keys`,
            { method: "POST", body: JSON.stringify(apiKeyBody) },
          );
          apiKey = keyRes.apiKey;
        }

        // Fund starter credit (Base USDC) on first creation only
        if (isNew && data.id) {
          if (fundPayload) {
            await this.fundWallet(data.id, fundPayload).catch(() => undefined);
          }
          const creditPayload = this.buildStarterCreditPayload();
          if (creditPayload) {
            await this.fundWallet(data.id, creditPayload).catch(() => undefined);
          }
        }

        if (!data.evmAddress || !data.id) {
          return { ok: false, error: "provision_failed: missing address" };
        }

        // On replay (200), apiKey is absent — caller must call repairWalletKey
        if (!apiKey && !isNew) {
          const repaired = await this.repairWalletKey(data.id, platform);
          if (!repaired) {
            return { ok: false, error: "Wallet exists but could not issue a usable key" };
          }
          apiKey = repaired;
        }

        if (!apiKey) {
          return { ok: false, error: "No API key returned from provision" };
        }

        return {
          ok: true,
          evmAddress: data.evmAddress.toLowerCase(),
          walletId: data.id,
          apiKey,
          isNew,
        };
      } catch (err) {
        if (attempt < 2) {
          await this.sleep(400 * (attempt + 1));
          continue;
        }
        return { ok: false, error: err instanceof Error ? err.message : "provision_failed" };
      }
    }
    return { ok: false, error: "provision_failed after retries" };
  }

  /**
   * Mint a fresh API key for a wallet that exists but has no locally-stored key.
   * Bankr never re-exposes a key's secret after creation, so the only fix is a new key.
   */
  async repairWalletKey(walletId: string, platform: Platform): Promise<string | null> {
    try {
      const keyRes = await this.partnerFetch<{ apiKey: string }>(
        `/partner/wallets/${encodeURIComponent(walletId)}/api-keys`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `rhagent-${platform}-repair`.slice(0, 64),
            permissions: {
              agentApiEnabled: true,
              llmGatewayEnabled: true,
              tokenLaunchApiEnabled: false,
              readOnly: false,
            },
          }),
        },
      );
      return keyRes.apiKey || null;
    } catch {
      return null;
    }
  }

  /** Resolve an existing bk_usr_* key to its wallet address. */
  async resolveExistingWallet(apiKey: string): Promise<{ evmAddress: string } | null> {
    try {
      const me = await this.walletFetch<{ evmAddress?: string; address?: string }>(apiKey, "/user/me");
      const addr = me.evmAddress || me.address;
      return addr ? { evmAddress: addr.toLowerCase() } : null;
    } catch {
      return null;
    }
  }

  // ─── Funding ───

  async fundWallet(walletId: string, payload: BankrFundPayload): Promise<void> {
    await this.partnerFetch(`/partner/wallets/${encodeURIComponent(walletId)}/fund`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  private buildFundPayload(): BankrFundPayload | null {
    if (!this.fundEth) return null;
    return { tokens: [{ tokenAddress: "native", amount: this.fundEth }], chain: "robinhood" };
  }

  private buildStarterCreditPayload(): BankrFundPayload | null {
    if (!this.starterCreditUsd || this.starterCreditUsd <= 0) return null;
    return {
      tokens: [{ tokenAddress: BASE_USDC, amount: String(this.starterCreditUsd) }],
      chain: "base",
    };
  }

  // ─── LLM Credits ───

  async getLlmCredits(apiKey: string): Promise<BankrLlmCredits | null> {
    try {
      return await this.walletFetch<BankrLlmCredits>(apiKey, "/llm/credits");
    } catch {
      return null;
    }
  }

  async buyLlmCredits(
    apiKey: string,
    amount: number,
    token: string = "USDC",
  ): Promise<{ ok: boolean; error: string }> {
    try {
      await this.walletFetch(apiKey, "/llm/credits/buy", {
        method: "POST",
        body: JSON.stringify({ amount, token }),
      });
      return { ok: true, error: "" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "buy_failed" };
    }
  }

  /**
   * Convert starter USDC → LLM credits with retry backoff (on-chain settlement lag).
   * Only call on first provision, never on link-existing or replay.
   */
  async convertStarterCredits(
    apiKey: string,
    amount: number,
  ): Promise<{ ok: boolean; error?: string }> {
    if (amount <= 0) return { ok: true };

    const delays = [3_000, 6_000, 12_000, 20_000];
    let lastError = "unknown";
    for (const delayMs of delays) {
      await this.sleep(delayMs);
      const result = await this.buyLlmCredits(apiKey, amount, "USDC");
      if (result.ok) return { ok: true };
      lastError = result.error;
      // Balance not settled yet — keep trying
      if (/insufficient|balance|not enough/i.test(result.error)) continue;
      // Any other error — stop
      break;
    }
    return { ok: false, error: lastError };
  }

  // ─── Wallet Info ───

  async getWalletInfo(apiKey: string): Promise<BankrWalletInfo | null> {
    try {
      const me = await this.walletFetch<{
        evmAddress?: string;
        address?: string;
        messagesRemaining?: number;
        clubActive?: boolean;
        maxModeEnabled?: boolean;
      }>(apiKey, "/user/me");
      return {
        evmAddress: (me.evmAddress || me.address || "").toLowerCase(),
        messagesRemaining: me.messagesRemaining,
        clubActive: me.clubActive,
        maxModeEnabled: me.maxModeEnabled,
      };
    } catch {
      return null;
    }
  }

  // ─── Agent API (chat, memory, env, files, skills) ───

  async agentPrompt(
    apiKey: string,
    prompt: string,
  ): Promise<{ ok: boolean; response?: string; error?: string }> {
    try {
      const res = await this.walletFetch<{ response?: string; message?: string }>(
        apiKey,
        "/agent/prompt",
        { method: "POST", body: JSON.stringify({ prompt }) },
      );
      return { ok: true, response: res.response || res.message };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "agent_prompt_failed" };
    }
  }

  async setEnvVars(apiKey: string, vars: Record<string, string>): Promise<void> {
    await this.walletFetch(apiKey, "/agent/env", {
      method: "POST",
      body: JSON.stringify({ vars }),
    });
  }

  async getEnvVars(apiKey: string): Promise<Record<string, string>> {
    const res = await this.walletFetch<{ vars?: Record<string, string> }>(apiKey, "/agent/env");
    return res.vars ?? {};
  }

  // ─── Partner wallet lookup ───

  async getPartnerWallet(identifier: string): Promise<{ id: string; evmAddress: string } | null> {
    try {
      return await this.partnerFetch<{ id: string; evmAddress: string }>(
        `/partner/wallets/${encodeURIComponent(identifier)}`,
      );
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
