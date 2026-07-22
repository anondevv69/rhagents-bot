import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export function getOnchainConfig() {
  const rpcUrl = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  const chainId = Number(process.env.RHAGENT_CHAIN_ID || robinhoodChain.id);
  const registry = (process.env.RHAGENT_REGISTRY_ADDRESS || "").trim() as `0x${string}` | "";
  const nft = (process.env.RHAGENT_NFT_ADDRESS || "").trim() as `0x${string}` | "";
  const journal = (process.env.RHAGENT_JOURNAL_ADDRESS || "").trim() as `0x${string}` | "";
  const vault = (process.env.RHAGENT_VAULT_ADDRESS || "").trim() as `0x${string}` | "";
  // Strip accidental quotes / whitespace from Railway paste
  let pk = (process.env.RHAGENT_INSCRIBER_PRIVATE_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (pk && !pk.startsWith("0x") && !pk.startsWith("0X")) pk = `0x${pk}`;

  const registryOk = /^0x[a-fA-F0-9]{40}$/.test(registry);
  const journalOk = /^0x[a-fA-F0-9]{40}$/.test(journal);
  const vaultOk = /^0x[a-fA-F0-9]{40}$/.test(vault);
  // 32-byte key as 0x + 64 hex
  const pkOk = /^0x[a-fA-F0-9]{64}$/.test(pk);
  const enabled = registryOk && pkOk;

  let disabledReason: string | null = null;
  if (!enabled) {
    if (!registryOk && !pkOk) disabledReason = "missing_registry_and_inscriber_key";
    else if (!registryOk) disabledReason = "missing_or_invalid_RHAGENT_REGISTRY_ADDRESS";
    else if (!pk) disabledReason = "missing_RHAGENT_INSCRIBER_PRIVATE_KEY";
    else disabledReason = "invalid_RHAGENT_INSCRIBER_PRIVATE_KEY_format"; // wrong length / not hex
  }

  return {
    enabled,
    disabledReason,
    rpcUrl,
    chainId,
    registryAddress: registryOk ? registry : undefined,
    nftAddress: /^0x[a-fA-F0-9]{40}$/.test(nft) ? nft : undefined,
    /** Optional companion that emits body + via in event logs (readable on Blockscout). */
    journalAddress: journalOk ? journal : undefined,
    /** RhagentPostVault — auto-rewards on journal v1.3+. */
    vaultAddress: vaultOk ? vault : undefined,
    inscriberPrivateKey: pkOk ? (pk as `0x${string}`) : undefined,
    explorerBase: "https://robinhoodchain.blockscout.com",
  };
}

export function explorerTxUrl(txHash: string): string {
  return `https://robinhoodchain.blockscout.com/tx/${txHash}`;
}

/** Minimal Registry ABI for mint + post anchors. */
export const registryAbi = [
  {
    type: "function",
    name: "anchorAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentKey", type: "string" },
      { name: "username", type: "string" },
      { name: "imageURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "anchorAgentDirect",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentKey", type: "string" },
      { name: "username", type: "string" },
      { name: "imageURI", type: "string" },
      { name: "ownerWallet", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "anchorPost",
    stateMutability: "nonpayable",
    inputs: [
      { name: "postId", type: "string" },
      { name: "username", type: "string" },
      { name: "postType", type: "string" },
      { name: "parentId", type: "string" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isAgentClaimed",
    stateMutability: "view",
    inputs: [{ name: "agentKey", type: "string" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isPostAnchored",
    stateMutability: "view",
    inputs: [{ name: "postId", type: "string" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/** Companion journal v1.3 — username + body + via + action + reward metadata. */
export const journalAbi = [
  {
    type: "function",
    name: "journalPost",
    stateMutability: "nonpayable",
    inputs: [
      { name: "postId", type: "string" },
      { name: "username", type: "string" },
      { name: "body", type: "string" },
      { name: "via", type: "string" },
      { name: "action", type: "string" },
      { name: "contentHash", type: "bytes32" },
      { name: "accountKind", type: "uint8" },
      { name: "payoutWallet", type: "address" },
      { name: "rewardEligible", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isJournaled",
    stateMutability: "view",
    inputs: [{ name: "postId", type: "string" }],
    outputs: [{ type: "bool" }],
  },
] as const;
