/**
 * Browser EIP-1193 helpers for MetaMask / Rabby wallet connect + personal_sign.
 * Prefer MetaMask when multiple extensions inject window.ethereum.
 */

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

const WALLET_REQUEST_MS = 90_000;
const FETCH_MS = 30_000;

export function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  // Explicit cast — Privy's SDK also declares a global Window.ethereum type.
  const injected = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!injected) return null;
  const list: EthereumProvider[] = injected.providers?.length ? injected.providers : [injected];
  return list.find((p) => p.isMetaMask) ?? list[0] ?? null;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function ethRequest(
  eth: EthereumProvider,
  args: { method: string; params?: unknown[] },
  timeoutMessage: string,
): Promise<unknown> {
  return withTimeout(eth.request(args), WALLET_REQUEST_MS, timeoutMessage);
}

export function fetchTimeout(ms = FETCH_MS): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Best-effort: add/switch to Robinhood Chain (4663). Does not throw on failure. */
export async function ensureRobinhoodChain(eth: EthereumProvider): Promise<void> {
  const chainIdHex = "0x1237"; // 4663
  try {
    await ethRequest(
      eth,
      { method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] },
      "Timed out switching network — check your wallet popup.",
    );
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? Number((err as { code: unknown }).code) : 0;
    // 4902 = unrecognized chain — try add
    if (code !== 4902 && !/Unrecognized chain|4902/i.test(String(err))) return;
    try {
      await ethRequest(
        eth,
        {
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "Robinhood Chain",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
              blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
            },
          ],
        },
        "Timed out adding Robinhood Chain — check your wallet popup.",
      );
    } catch {
      /* holdings check is server-side; signing works on any chain */
    }
  }
}

export function walletErrorMessage(err: unknown, fallback = "Wallet connect failed"): string {
  if (err instanceof Error) {
    if (err.name === "AbortError" || /aborted|timeout/i.test(err.message)) {
      return err.message.includes("wallet") || err.message.includes("Timed out")
        ? err.message
        : "Request timed out — unlock MetaMask and check for a pending popup, then try again.";
    }
    if (/user rejected|denied|cancel/i.test(err.message)) {
      return "Cancelled in wallet — unlock MetaMask and approve the connect/sign prompts.";
    }
    return err.message;
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message);
    if (/user rejected|denied|cancel/i.test(msg)) {
      return "Cancelled in wallet — unlock MetaMask and approve the connect/sign prompts.";
    }
    return msg || fallback;
  }
  return fallback;
}
