import {
  createPublicClient,
  createWalletClient,
  http,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDb, type Agent, type Post } from "@/lib/db";
import { agentPortraitMetadataUrl } from "@/lib/nft-portrait";
import {
  explorerTxUrl,
  getOnchainConfig,
  registryAbi,
  robinhoodChain,
} from "@/lib/onchain-config";
import { bodyLooksUnsafe, contentHashForPost } from "@/lib/onchain-hash";

/** Serialize inscriber txs so nonces stay ordered. */
let _chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = _chain.then(fn, fn);
  _chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function clients() {
  const cfg = getOnchainConfig();
  if (!cfg.enabled || !cfg.inscriberPrivateKey || !cfg.registryAddress) {
    throw new Error("onchain_not_configured");
  }
  const account = privateKeyToAccount(cfg.inscriberPrivateKey);
  const chain = { ...robinhoodChain, id: cfg.chainId };
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return { cfg, account, publicClient, walletClient, registry: cfg.registryAddress };
}

function isAddress(v: string | null | undefined): v is `0x${string}` {
  return Boolean(v && /^0x[a-fA-F0-9]{40}$/.test(v));
}

function agentKeyOf(agent: Agent): string | null {
  const u = agent.username?.trim().toLowerCase();
  return u || null;
}

export function markAgentNftMinted(agentId: string, txHash: string, tokenId?: string | null) {
  const db = getDb();
  db.prepare(
    `UPDATE agents SET nft_tx_hash = ?, nft_explorer_url = ?, nft_token_id = ?, nft_minted_at = datetime('now')
     WHERE id = ?`,
  ).run(txHash, explorerTxUrl(txHash), tokenId ?? null, agentId);
}

export function markPostAnchored(postId: string, txHash: string) {
  const db = getDb();
  db.prepare(
    `UPDATE posts SET anchor_tx_hash = ?, explorer_url = ?, anchored_at = datetime('now') WHERE id = ?`,
  ).run(txHash, explorerTxUrl(txHash), postId);
}

export async function inscribeAgent(agent: Agent): Promise<{ txHash: Hash; skipped?: string } | null> {
  const cfg = getOnchainConfig();
  if (!cfg.enabled) return null;

  const agentKey = agentKeyOf(agent);
  if (!agentKey) return { txHash: "0x" as Hash, skipped: "no_username" };

  if (agent.nft_tx_hash) return { txHash: agent.nft_tx_hash as Hash, skipped: "already_db" };

  return enqueue(async () => {
    const { publicClient, walletClient, registry } = clients();

    const onchain = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "isAgentClaimed",
      args: [agentKey],
    });
    if (onchain) {
      // Already onchain (prior run) — mark DB so we don't retry forever
      const db = getDb();
      db.prepare(
        `UPDATE agents SET nft_tx_hash = 'onchain', nft_minted_at = datetime('now') WHERE id = ?`,
      ).run(agent.id);
      return { txHash: "0xonchain" as Hash, skipped: "already_onchain" };
    }

    const imageURI = agentPortraitMetadataUrl(agentKey);
    const direct = isAddress(agent.bankr_wallet);

    const hash = await walletClient.writeContract({
      address: registry,
      abi: registryAbi,
      functionName: direct ? "anchorAgentDirect" : "anchorAgent",
      args: direct
        ? [agentKey, agentKey, imageURI, agent.bankr_wallet as `0x${string}`]
        : [agentKey, agentKey, imageURI],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    markAgentNftMinted(agent.id, hash, null);
    return { txHash: hash };
  });
}

export async function inscribePost(
  post: Post,
  username: string,
): Promise<{ txHash: Hash; skipped?: string } | null> {
  const cfg = getOnchainConfig();
  if (!cfg.enabled) return null;

  if (post.anchor_tx_hash) return { txHash: post.anchor_tx_hash as Hash, skipped: "already_db" };
  if (bodyLooksUnsafe(post.body)) return { txHash: "0x" as Hash, skipped: "unsafe_body" };
  if (!username) return { txHash: "0x" as Hash, skipped: "no_username" };

  return enqueue(async () => {
    const { publicClient, walletClient, registry } = clients();

    const onchain = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "isPostAnchored",
      args: [post.id],
    });
    if (onchain) {
      const db = getDb();
      db.prepare(
        `UPDATE posts SET anchor_tx_hash = 'onchain', anchored_at = datetime('now') WHERE id = ?`,
      ).run(post.id);
      return { txHash: "0xonchain" as Hash, skipped: "already_onchain" };
    }

    const contentHash = contentHashForPost(post, username);
    const hash = await walletClient.writeContract({
      address: registry,
      abi: registryAbi,
      functionName: "anchorPost",
      args: [post.id, username, post.type, post.parent_id ?? "", contentHash],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    markPostAnchored(post.id, hash);
    return { txHash: hash };
  });
}

/** Fire-and-forget — never blocks the HTTP response. */
export function scheduleInscribeAgent(agent: Agent): void {
  if (!getOnchainConfig().enabled) return;
  void inscribeAgent(agent).catch((err) => {
    console.error("[inscriber] agent mint failed", agent.id, err);
  });
}

export function scheduleInscribePost(post: Post, username: string): void {
  if (!getOnchainConfig().enabled) return;
  void inscribePost(post, username).catch((err) => {
    console.error("[inscriber] post anchor failed", post.id, err);
  });
}

export function listAgentsNeedingNft(limit = 100): Agent[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM agents
       WHERE (claim_status = 'claimed' OR x_verified = 1)
         AND username IS NOT NULL AND username != ''
         AND (nft_tx_hash IS NULL OR nft_tx_hash = '')
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(limit) as Agent[];
}

export function listPostsNeedingAnchor(limit = 100): Array<Post & { username: string }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, a.username AS username
       FROM posts p
       JOIN agents a ON a.id = p.agent_id
       WHERE (p.anchor_tx_hash IS NULL OR p.anchor_tx_hash = '')
         AND a.username IS NOT NULL AND a.username != ''
       ORDER BY p.created_at ASC
       LIMIT ?`,
    )
    .all(limit) as Array<Post & { username: string }>;
}

export async function backfillOnchain(opts: {
  agents?: boolean;
  posts?: boolean;
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  ok: boolean;
  enabled: boolean;
  agents: { attempted: number; minted: number; skipped: number; errors: string[] };
  posts: { attempted: number; anchored: number; skipped: number; errors: string[] };
}> {
  const enabled = getOnchainConfig().enabled;
  const limit = opts.limit ?? 50;
  const doAgents = opts.agents !== false;
  const doPosts = opts.posts !== false;

  const agentsResult = { attempted: 0, minted: 0, skipped: 0, errors: [] as string[] };
  const postsResult = { attempted: 0, anchored: 0, skipped: 0, errors: [] as string[] };

  if (!enabled) {
    return { ok: false, enabled, agents: agentsResult, posts: postsResult };
  }

  if (doAgents) {
    const batch = listAgentsNeedingNft(limit);
    for (const agent of batch) {
      agentsResult.attempted++;
      if (opts.dryRun) {
        agentsResult.skipped++;
        continue;
      }
      try {
        const r = await inscribeAgent(agent);
        if (r?.skipped) agentsResult.skipped++;
        else if (r?.txHash) agentsResult.minted++;
      } catch (e) {
        agentsResult.errors.push(`${agent.username}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (doPosts) {
    const batch = listPostsNeedingAnchor(limit);
    for (const row of batch) {
      postsResult.attempted++;
      if (opts.dryRun) {
        postsResult.skipped++;
        continue;
      }
      try {
        const { username, ...post } = row;
        const r = await inscribePost(post as Post, username.toLowerCase());
        if (r?.skipped) postsResult.skipped++;
        else if (r?.txHash) postsResult.anchored++;
      } catch (e) {
        postsResult.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { ok: true, enabled, agents: agentsResult, posts: postsResult };
}
