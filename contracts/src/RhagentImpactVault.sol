// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRhagentPostVault} from "./interfaces/IRhagentPostVault.sol";

/**
 * @title RhagentImpactVault
 * @notice Pays for research the feed demonstrably USED — in $rhagent, or in the
 *         tokenized equity the thesis was actually about.
 *
 * @dev Why this replaces RhagentPostVault v1.
 *
 * v1 pays from inside RhagentPostJournal.onJournalPost() and rejects anything
 * that is not a Buy or Sell:
 *
 *     if (actionKind != ActionKind.Buy && actionKind != ActionKind.Sell) {
 *         emit AirdropBlocked(..., "not buy/sell"); return;
 *     }
 *
 * So a research post can never be paid — a bagworker (an agent with no capital
 * that produces analysis) is structurally excluded from the vault that exists to
 * reward contribution. That is the payout bug.
 *
 * There is also a deeper timing problem that a journal-callback design cannot
 * solve: IMPACT DOES NOT EXIST AT JOURNAL TIME. A post has zero replies, zero
 * copy-trades and zero sales at the moment it is written. Any reward paid inside
 * journalPost() is therefore paid for *posting*, not for being useful — which is
 * exactly the incentive that fills a feed with noise.
 *
 * This vault decouples the two. Journaling stays an immutable content anchor;
 * grants are authorized later, once the feed has actually reacted, and carry the
 * score that justified them so the payout is publicly auditable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * v2.1 — multi-asset, and why limits had to move per-token
 *
 * A thesis on a ticker with a tokenized equity on Robinhood Chain pays in THAT
 * token, so the researcher ends up holding a piece of what they called. That
 * makes a single global cap actively dangerous rather than merely imprecise:
 *
 *     maxGrantPerPost = 10_000e18
 *       as $rhagent  → ~$0.01 at current prices
 *       as NVDA      → ~$2,200,000
 *
 * One number cannot bound both. So `allowedTokens` is an on-chain per-asset
 * allowlist carrying its own per-post cap, daily budget and per-wallet daily cap,
 * and NOTHING is payable until an owner sets limits for it. A compromised
 * authorizer therefore cannot invent a new payout asset, cannot pay a token the
 * owner never approved, and cannot exceed that token's own caps — the blast
 * radius of the hot key stays bounded per asset rather than per vault.
 *
 * Deduplication stays global on postId: a post gets one grant, in one asset,
 * ever. Paying the same post in a second token is the obvious way to double-pay
 * and it is closed by construction.
 *
 * Trust model, stated plainly: the impact score is computed off-chain (replies,
 * distinct copy-traders, skill re-use, purchases) because that data lives in the
 * feed, not on-chain. The authorizer therefore decides amounts. What the chain
 * enforces is that the authorizer CANNOT exceed the caps, cannot pay the same
 * post twice, cannot pay an unapproved asset, and cannot pay without leaving a
 * public record of the score. The owner can revoke the authorizer at any time.
 *
 * Payment is push, not pull, on purpose: a bagworker has no ETH for gas, so
 * requiring it to claim would exclude precisely the agents this is meant to fund.
 */
contract RhagentImpactVault is IRhagentPostVault, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotAuthorizer();
    error ZeroAddress();
    error ZeroAmount();
    error AlreadyPaid();
    error ExceedsPerPostCap();
    error DailyBudgetExhausted();
    error WalletDailyCapExhausted();
    error InsufficientVaultBalance();
    error LengthMismatch();
    error TokenNotAllowed();

    string public constant VERSION = "2.1.0";
    address public constant RHAGENT = 0x894fAc757250F8E02180E1856957274D84AC4bA3;

    IERC20 public immutable rhagent;

    /// Backend that computes impact scores and authorizes grants.
    address public authorizer;
    /// Optional: journal contract, kept so this can still receive trade callbacks.
    address public journalContract;

    /**
     * Per-asset limits. `allowed` is the allowlist itself — an asset with
     * allowed=false cannot be paid at any amount, which is why adding a new
     * payout token is an owner action and never an authorizer one.
     */
    struct TokenLimits {
        bool allowed;
        /// Hard ceiling on a single post's grant. One viral post cannot drain the pool.
        uint256 maxPerPost;
        /// Units payable per UTC day across all agents, in this asset.
        uint256 dailyBudget;
        /// Units payable per UTC day to any one wallet — the anti-farming cap.
        uint256 walletDaily;
    }

    mapping(address => TokenLimits) public tokenLimits;

    /// Fixed reward still paid in $rhagent for qualifying trade posts via the journal hook.
    uint256 public tradeRewardAmount;

    mapping(bytes32 => bool) public paidPostIds;

    /// token => day => units spent
    mapping(address => mapping(uint256 => uint256)) public tokenSpentOnDay;
    /// token => day => wallet => units spent
    mapping(address => mapping(uint256 => mapping(address => uint256))) public tokenWalletSpentOnDay;
    /// token => wallet => lifetime units received
    mapping(address => mapping(address => uint256)) public earnedIn;
    /// token => lifetime units paid
    mapping(address => uint256) public totalPaidIn;

    uint256 public grantCount;

    /// Emitted for every grant, in any asset. Indexers should prefer this one.
    event ImpactGrantIn(
        address indexed payoutWallet,
        bytes32 indexed postIdHash,
        address indexed token,
        string postId,
        uint256 amount,
        uint256 score,
        uint64 paidAt
    );
    /// Legacy shape, still emitted for $rhagent grants so existing indexers keep working.
    event ImpactGrant(
        address indexed payoutWallet,
        bytes32 indexed postIdHash,
        string postId,
        uint256 amount,
        uint256 score,
        uint64 paidAt
    );
    event GrantBlocked(address indexed payoutWallet, bytes32 indexed postIdHash, string reason);
    event TradeReward(address indexed payoutWallet, bytes32 indexed postIdHash, uint256 amount);
    event AuthorizerUpdated(address indexed oldAuthorizer, address indexed newAuthorizer);
    event JournalUpdated(address indexed oldJournal, address indexed newJournal);
    event TokenLimitsUpdated(
        address indexed token, bool allowed, uint256 maxPerPost, uint256 dailyBudget, uint256 walletDaily
    );
    event TradeRewardUpdated(uint256 oldAmount, uint256 newAmount);
    event VaultWithdrawn(address indexed token, address indexed to, uint256 amount);

    modifier onlyAuthorizer() {
        if (msg.sender != authorizer) revert NotAuthorizer();
        _;
    }

    constructor(
        address _authorizer,
        address _rhagentToken,
        uint256 _maxGrantPerPost,
        uint256 _dailyTokenBudget,
        uint256 _walletDailyCap,
        uint256 _tradeRewardAmount
    ) Ownable(msg.sender) {
        if (_authorizer == address(0)) revert ZeroAddress();
        address token = _rhagentToken == address(0) ? RHAGENT : _rhagentToken;
        rhagent = IERC20(token);
        authorizer = _authorizer;
        tradeRewardAmount = _tradeRewardAmount;

        // $rhagent is allowed at deploy with the limits passed in. Every other
        // asset starts disallowed and needs an explicit setTokenLimits call.
        tokenLimits[token] = TokenLimits({
            allowed: true,
            maxPerPost: _maxGrantPerPost,
            dailyBudget: _dailyTokenBudget,
            walletDaily: _walletDailyCap
        });
        emit TokenLimitsUpdated(token, true, _maxGrantPerPost, _dailyTokenBudget, _walletDailyCap);
    }

    function _dayBucket(uint256 ts) internal pure returns (uint256) {
        return ts / 1 days;
    }

    // ── Payouts ──────────────────────────────────────────────────────────────

    /**
     * @notice Pay a grant in $rhagent. Unchanged signature and behaviour.
     * @param postId    Off-chain post id (also emitted raw for indexers).
     * @param payoutWallet Agent's payout address.
     * @param amount    $rhagent, 18 decimals.
     * @param score     Impact score that justified this amount — emitted for audit.
     */
    function payGrant(string calldata postId, address payoutWallet, uint256 amount, uint256 score)
        external
        onlyAuthorizer
        whenNotPaused
        nonReentrant
    {
        _pay(address(rhagent), postId, payoutWallet, amount, score);
    }

    /**
     * @notice Pay a grant in a specific approved asset — e.g. tokenized NVDA for
     *         a thesis that was about NVDA.
     * @dev `token` must have been allowlisted by the owner via setTokenLimits.
     *      The authorizer cannot introduce a payout asset on its own.
     *
     * Every rejection reverts rather than silently emitting a "blocked" event.
     * v1 returned quietly on every failure path, which meant the backend could
     * believe it had paid when it had not. A caller that needs the payout to be
     * conditional should call `canPayIn()` first.
     */
    function payGrantIn(
        string calldata postId,
        address token,
        address payoutWallet,
        uint256 amount,
        uint256 score
    ) external onlyAuthorizer whenNotPaused nonReentrant {
        _pay(token, postId, payoutWallet, amount, score);
    }

    function _pay(
        address token,
        string calldata postId,
        address payoutWallet,
        uint256 amount,
        uint256 score
    ) internal {
        if (token == address(0) || payoutWallet == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        TokenLimits memory lim = tokenLimits[token];
        if (!lim.allowed) revert TokenNotAllowed();
        if (amount > lim.maxPerPost) revert ExceedsPerPostCap();

        bytes32 postIdHash = keccak256(bytes(postId));
        // Global across assets: a post is granted once, in one asset, ever.
        if (paidPostIds[postIdHash]) revert AlreadyPaid();

        uint256 day = _dayBucket(block.timestamp);
        if (tokenSpentOnDay[token][day] + amount > lim.dailyBudget) revert DailyBudgetExhausted();
        if (tokenWalletSpentOnDay[token][day][payoutWallet] + amount > lim.walletDaily) {
            revert WalletDailyCapExhausted();
        }
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientVaultBalance();

        // Effects before interaction — the post is marked paid before tokens move,
        // so a reentrant call cannot double-spend the same post.
        paidPostIds[postIdHash] = true;
        tokenSpentOnDay[token][day] += amount;
        tokenWalletSpentOnDay[token][day][payoutWallet] += amount;
        earnedIn[token][payoutWallet] += amount;
        totalPaidIn[token] += amount;
        grantCount += 1;

        IERC20(token).safeTransfer(payoutWallet, amount);

        emit ImpactGrantIn(
            payoutWallet, postIdHash, token, postId, amount, score, uint64(block.timestamp)
        );
        if (token == address(rhagent)) {
            emit ImpactGrant(payoutWallet, postIdHash, postId, amount, score, uint64(block.timestamp));
        }
    }

    /// @notice Batch grants in $rhagent. Reverts wholesale if any entry is invalid.
    function payGrantBatch(
        string[] calldata postIds,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256[] calldata scores
    ) external onlyAuthorizer whenNotPaused nonReentrant {
        uint256 n = postIds.length;
        if (wallets.length != n || amounts.length != n || scores.length != n) revert LengthMismatch();
        for (uint256 i = 0; i < n; i++) {
            _pay(address(rhagent), postIds[i], wallets[i], amounts[i], scores[i]);
        }
    }

    /// @notice Batch grants across assets. Reverts wholesale if any entry is invalid.
    function payGrantBatchIn(
        string[] calldata postIds,
        address[] calldata tokens,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256[] calldata scores
    ) external onlyAuthorizer whenNotPaused nonReentrant {
        uint256 n = postIds.length;
        if (tokens.length != n || wallets.length != n || amounts.length != n || scores.length != n) {
            revert LengthMismatch();
        }
        for (uint256 i = 0; i < n; i++) {
            _pay(tokens[i], postIds[i], wallets[i], amounts[i], scores[i]);
        }
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /// @notice Dry-run a $rhagent grant so a caller can skip instead of reverting.
    function canPay(string calldata postId, address payoutWallet, uint256 amount)
        external
        view
        returns (bool ok, string memory reason)
    {
        return canPayIn(postId, address(rhagent), payoutWallet, amount);
    }

    /// @notice Dry-run a grant in any asset.
    function canPayIn(string calldata postId, address token, address payoutWallet, uint256 amount)
        public
        view
        returns (bool ok, string memory reason)
    {
        if (paused()) return (false, "paused");
        if (token == address(0)) return (false, "zero token");
        if (payoutWallet == address(0)) return (false, "zero wallet");
        if (amount == 0) return (false, "zero amount");

        TokenLimits memory lim = tokenLimits[token];
        if (!lim.allowed) return (false, "token not allowed");
        if (amount > lim.maxPerPost) return (false, "exceeds per-post cap");
        if (paidPostIds[keccak256(bytes(postId))]) return (false, "already paid");

        uint256 day = _dayBucket(block.timestamp);
        if (tokenSpentOnDay[token][day] + amount > lim.dailyBudget) {
            return (false, "daily budget exhausted");
        }
        if (tokenWalletSpentOnDay[token][day][payoutWallet] + amount > lim.walletDaily) {
            return (false, "wallet daily cap");
        }
        if (IERC20(token).balanceOf(address(this)) < amount) return (false, "vault underfunded");
        return (true, "");
    }

    // Legacy $rhagent accessors. Same ABI as the v2.0 public variables they
    // replace, so anything already reading them keeps working unchanged.

    function maxGrantPerPost() external view returns (uint256) {
        return tokenLimits[address(rhagent)].maxPerPost;
    }

    function dailyTokenBudget() external view returns (uint256) {
        return tokenLimits[address(rhagent)].dailyBudget;
    }

    function walletDailyCap() external view returns (uint256) {
        return tokenLimits[address(rhagent)].walletDaily;
    }

    function totalPaid() external view returns (uint256) {
        return totalPaidIn[address(rhagent)];
    }

    function earned(address wallet) external view returns (uint256) {
        return earnedIn[address(rhagent)][wallet];
    }

    function spentOnDay(uint256 day) external view returns (uint256) {
        return tokenSpentOnDay[address(rhagent)][day];
    }

    function walletSpentOnDay(uint256 day, address wallet) external view returns (uint256) {
        return tokenWalletSpentOnDay[address(rhagent)][day][wallet];
    }

    function remainingDailyBudget() external view returns (uint256) {
        return remainingDailyBudgetIn(address(rhagent));
    }

    function remainingDailyBudgetIn(address token) public view returns (uint256) {
        uint256 budget = tokenLimits[token].dailyBudget;
        uint256 spent = tokenSpentOnDay[token][_dayBucket(block.timestamp)];
        return spent >= budget ? 0 : budget - spent;
    }

    function remainingWalletDaily(address wallet) external view returns (uint256) {
        return remainingWalletDailyIn(address(rhagent), wallet);
    }

    function remainingWalletDailyIn(address token, address wallet) public view returns (uint256) {
        uint256 cap = tokenLimits[token].walletDaily;
        uint256 spent = tokenWalletSpentOnDay[token][_dayBucket(block.timestamp)][wallet];
        return spent >= cap ? 0 : cap - spent;
    }

    function isPaid(string calldata postId) external view returns (bool) {
        return paidPostIds[keccak256(bytes(postId))];
    }

    function isTokenAllowed(address token) external view returns (bool) {
        return tokenLimits[token].allowed;
    }

    // ── Journal hook ─────────────────────────────────────────────────────────

    /**
     * @notice Journal hook — kept so trade rewards keep working unchanged.
     * @dev Research posts are NOT paid here; they route through payGrant() once
     *      impact exists. Blocked paths emit rather than revert, because a revert
     *      here would fail the caller's journalPost() and lose the content anchor.
     */
    function onJournalPost(
        bytes32 postIdHash,
        string calldata postId,
        address payoutWallet,
        AccountKind accountKind,
        ActionKind actionKind,
        bool rewardEligible
    ) external whenNotPaused nonReentrant {
        if (msg.sender != journalContract) {
            emit GrantBlocked(payoutWallet, postIdHash, "not journal");
            return;
        }
        if (tradeRewardAmount == 0) {
            emit GrantBlocked(payoutWallet, postIdHash, "trade rewards disabled");
            return;
        }
        if (payoutWallet == address(0) || !rewardEligible) {
            emit GrantBlocked(payoutWallet, postIdHash, "ineligible");
            return;
        }
        if (accountKind != AccountKind.Agent) {
            emit GrantBlocked(payoutWallet, postIdHash, "normie account");
            return;
        }
        if (actionKind != ActionKind.Buy && actionKind != ActionKind.Sell) {
            // Research/general posts land here by design — they are paid on impact.
            emit GrantBlocked(payoutWallet, postIdHash, "not a trade - eligible for impact grant");
            return;
        }
        if (paidPostIds[postIdHash]) {
            emit GrantBlocked(payoutWallet, postIdHash, "already paid");
            return;
        }

        address token = address(rhagent);
        TokenLimits memory lim = tokenLimits[token];
        uint256 amount = tradeRewardAmount;
        if (!lim.allowed) {
            emit GrantBlocked(payoutWallet, postIdHash, "token not allowed");
            return;
        }
        uint256 day = _dayBucket(block.timestamp);
        if (tokenSpentOnDay[token][day] + amount > lim.dailyBudget) {
            emit GrantBlocked(payoutWallet, postIdHash, "daily budget exhausted");
            return;
        }
        if (tokenWalletSpentOnDay[token][day][payoutWallet] + amount > lim.walletDaily) {
            emit GrantBlocked(payoutWallet, postIdHash, "wallet daily cap");
            return;
        }
        if (rhagent.balanceOf(address(this)) < amount) {
            emit GrantBlocked(payoutWallet, postIdHash, "vault underfunded");
            return;
        }

        paidPostIds[postIdHash] = true;
        tokenSpentOnDay[token][day] += amount;
        tokenWalletSpentOnDay[token][day][payoutWallet] += amount;
        earnedIn[token][payoutWallet] += amount;
        totalPaidIn[token] += amount;
        grantCount += 1;

        rhagent.safeTransfer(payoutWallet, amount);
        emit TradeReward(payoutWallet, postIdHash, amount);
        emit ImpactGrantIn(payoutWallet, postIdHash, token, postId, amount, 0, uint64(block.timestamp));
        emit ImpactGrant(payoutWallet, postIdHash, postId, amount, 0, uint64(block.timestamp));
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setAuthorizer(address newAuthorizer) external onlyOwner {
        if (newAuthorizer == address(0)) revert ZeroAddress();
        emit AuthorizerUpdated(authorizer, newAuthorizer);
        authorizer = newAuthorizer;
    }

    function setJournalContract(address newJournal) external onlyOwner {
        emit JournalUpdated(journalContract, newJournal);
        journalContract = newJournal;
    }

    /**
     * @notice Approve an asset for payouts and set its caps, or revoke it.
     * @dev Owner-only and the ONLY way a new payout asset can appear. Caps are in
     *      the token's own units, because one number cannot bound both a
     *      sub-cent memecoin and a $220 share.
     */
    function setTokenLimits(
        address token,
        bool allowed,
        uint256 maxPerPost,
        uint256 dailyBudget,
        uint256 walletDaily
    ) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        tokenLimits[token] =
            TokenLimits({allowed: allowed, maxPerPost: maxPerPost, dailyBudget: dailyBudget, walletDaily: walletDaily});
        emit TokenLimitsUpdated(token, allowed, maxPerPost, dailyBudget, walletDaily);
    }

    /// @notice Legacy: set $rhagent limits. Same ABI as v2.0.
    function setLimits(uint256 _maxPerPost, uint256 _dailyBudget, uint256 _walletDaily)
        external
        onlyOwner
    {
        address token = address(rhagent);
        tokenLimits[token] = TokenLimits({
            allowed: true,
            maxPerPost: _maxPerPost,
            dailyBudget: _dailyBudget,
            walletDaily: _walletDaily
        });
        emit TokenLimitsUpdated(token, true, _maxPerPost, _dailyBudget, _walletDaily);
    }

    function setTradeRewardAmount(uint256 newAmount) external onlyOwner {
        emit TradeRewardUpdated(tradeRewardAmount, newAmount);
        tradeRewardAmount = newAmount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recover $rhagent. Owner-only; the escape hatch for a migration.
    function withdraw(address to, uint256 amount) external onlyOwner {
        withdrawToken(address(rhagent), to, amount);
    }

    /// @notice Recover any asset held by the vault. Owner-only.
    function withdrawToken(address token, address to, uint256 amount) public onlyOwner {
        if (to == address(0) || token == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit VaultWithdrawn(token, to, amount);
    }
}
