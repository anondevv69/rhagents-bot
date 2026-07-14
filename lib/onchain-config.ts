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
  const registry = process.env.RHAGENT_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const nft = process.env.RHAGENT_NFT_ADDRESS as `0x${string}` | undefined;
  let pk = process.env.RHAGENT_INSCRIBER_PRIVATE_KEY?.trim();
  if (pk && !pk.startsWith("0x")) pk = `0x${pk}`;

  const enabled = Boolean(registry && pk && pk.length >= 66);
  return {
    enabled,
    rpcUrl,
    chainId,
    registryAddress: registry,
    nftAddress: nft,
    inscriberPrivateKey: pk as `0x${string}` | undefined,
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
