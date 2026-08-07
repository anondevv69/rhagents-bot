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
 * @notice Pays $rhagent for research the feed demonstrably USED.
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
 * Trust model, stated plainly: the impact score is computed off-chain (replies,
 * distinct copy-traders, skill re-use, purchases) because that data lives in the
 * feed, not on-chain. The authorizer therefore decides amounts. What the chain
 * enforces is that the authorizer CANNOT exceed the caps, cannot pay the same
 * post twice, and cannot pay without leaving a public record of the score. The
 * owner can revoke the authorizer at any time.
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

    string public constant VERSION = "2.0.0";
    address public constant RHAGENT = 0x894fAc757250F8E02180E1856957274D84AC4bA3;

    IERC20 public immutable rhagent;

    /// Backend that computes impact scores and authorizes grants.
    address public authorizer;
    /// Optional: journal contract, kept so this can still receive trade callbacks.
    address public journalContract;

    /// Hard ceiling on a single post's grant. One viral post cannot drain the pool.
    uint256 public maxGrantPerPost;
    /// Tokens (not count) payable per UTC day across all agents.
    uint256 public dailyTokenBudget;
    /// Tokens payable per UTC day to any one wallet — the anti-farming cap.
    uint256 public walletDailyCap;

    /// Fixed reward still paid for qualifying trade posts via the journal hook.
    uint256 public tradeRewardAmount;

    mapping(bytes32 => bool) public paidPostIds;
    mapping(address => uint256) public earned;
    mapping(uint256 => uint256) public spentOnDay;
    mapping(uint256 => mapping(address => uint256)) public walletSpentOnDay;
    uint256 public totalPaid;
    uint256 public grantCount;

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
    event LimitsUpdated(uint256 maxPerPost, uint256 dailyBudget, uint256 walletDaily);
    event TradeRewardUpdated(uint256 oldAmount, uint256 newAmount);
    event VaultWithdrawn(address indexed to, uint256 amount);

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
        rhagent = IERC20(_rhagentToken == address(0) ? RHAGENT : _rhagentToken);
        authorizer = _authorizer;
        maxGrantPerPost = _maxGrantPerPost;
        dailyTokenBudget = _dailyTokenBudget;
        walletDailyCap = _walletDailyCap;
        tradeRewardAmount = _tradeRewardAmount;
    }

    function _dayBucket(uint256 ts) internal pure returns (uint256) {
        return ts / 1 days;
    }

    /**
     * @notice Pay a grant for a post the feed used.
     * @param postId    Off-chain post id (also emitted raw for indexers).
     * @param payoutWallet Agent's payout address.
     * @param amount    $rhagent, 18 decimals.
     * @param score     Impact score that justified this amount — emitted for audit.
     *
     * @dev Every rejection reverts rather than silently emitting a "blocked"
     * event. v1 returned quietly on every failure path, which meant the backend
     * could believe it had paid when it had not. A caller that needs the payout
     * to be conditional should call `canPay()` first.
     */
    function payGrant(
        string calldata postId,
        address payoutWallet,
        uint256 amount,
        uint256 score
    ) external onlyAuthorizer whenNotPaused nonReentrant {
        if (payoutWallet == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > maxGrantPerPost) revert ExceedsPerPostCap();

        bytes32 postIdHash = keccak256(bytes(postId));
        if (paidPostIds[postIdHash]) revert AlreadyPaid();

        uint256 day = _dayBucket(block.timestamp);
        if (spentOnDay[day] + amount > dailyTokenBudget) revert DailyBudgetExhausted();
        if (walletSpentOnDay[day][payoutWallet] + amount > walletDailyCap) {
            revert WalletDailyCapExhausted();
        }
        if (rhagent.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();

        // Effects before interaction — the post is marked paid before tokens move,
        // so a reentrant call cannot double-spend the same post.
        paidPostIds[postIdHash] = true;
        spentOnDay[day] += amount;
        walletSpentOnDay[day][payoutWallet] += amount;
        earned[payoutWallet] += amount;
        totalPaid += amount;
        grantCount += 1;

        rhagent.safeTransfer(payoutWallet, amount);

        emit ImpactGrant(payoutWallet, postIdHash, postId, amount, score, uint64(block.timestamp));
    }

    /// @notice Batch grants. Reverts wholesale if any entry is invalid.
    function payGrantBatch(
        string[] calldata postIds,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256[] calldata scores
    ) external onlyAuthorizer whenNotPaused nonReentrant {
        uint256 n = postIds.length;
        if (wallets.length != n || amounts.length != n || scores.length != n) revert LengthMismatch();

        uint256 day = _dayBucket(block.timestamp);
        for (uint256 i = 0; i < n; i++) {
            address wallet = wallets[i];
            uint256 amount = amounts[i];
            if (wallet == address(0)) revert ZeroAddress();
            if (amount == 0) revert ZeroAmount();
            if (amount > maxGrantPerPost) revert ExceedsPerPostCap();

            bytes32 postIdHash = keccak256(bytes(postIds[i]));
            if (paidPostIds[postIdHash]) revert AlreadyPaid();
            if (spentOnDay[day] + amount > dailyTokenBudget) revert DailyBudgetExhausted();
            if (walletSpentOnDay[day][wallet] + amount > walletDailyCap) {
                revert WalletDailyCapExhausted();
            }
            if (rhagent.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();

            paidPostIds[postIdHash] = true;
            spentOnDay[day] += amount;
            walletSpentOnDay[day][wallet] += amount;
            earned[wallet] += amount;
            totalPaid += amount;
            grantCount += 1;

            rhagent.safeTransfer(wallet, amount);
            emit ImpactGrant(wallet, postIdHash, postIds[i], amount, scores[i], uint64(block.timestamp));
        }
    }

    /// @notice Dry-run a grant so a caller can skip instead of reverting a batch.
    function canPay(string calldata postId, address payoutWallet, uint256 amount)
        external
        view
        returns (bool ok, string memory reason)
    {
        if (paused()) return (false, "paused");
        if (payoutWallet == address(0)) return (false, "zero wallet");
        if (amount == 0) return (false, "zero amount");
        if (amount > maxGrantPerPost) return (false, "exceeds per-post cap");
        if (paidPostIds[keccak256(bytes(postId))]) return (false, "already paid");
        uint256 day = _dayBucket(block.timestamp);
        if (spentOnDay[day] + amount > dailyTokenBudget) return (false, "daily budget exhausted");
        if (walletSpentOnDay[day][payoutWallet] + amount > walletDailyCap) {
            return (false, "wallet daily cap");
        }
        if (rhagent.balanceOf(address(this)) < amount) return (false, "vault underfunded");
        return (true, "");
    }

    function remainingDailyBudget() external view returns (uint256) {
        uint256 spent = spentOnDay[_dayBucket(block.timestamp)];
        return spent >= dailyTokenBudget ? 0 : dailyTokenBudget - spent;
    }

    function remainingWalletDaily(address wallet) external view returns (uint256) {
        uint256 spent = walletSpentOnDay[_dayBucket(block.timestamp)][wallet];
        return spent >= walletDailyCap ? 0 : walletDailyCap - spent;
    }

    function isPaid(string calldata postId) external view returns (bool) {
        return paidPostIds[keccak256(bytes(postId))];
    }

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

        uint256 amount = tradeRewardAmount;
        uint256 day = _dayBucket(block.timestamp);
        if (spentOnDay[day] + amount > dailyTokenBudget) {
            emit GrantBlocked(payoutWallet, postIdHash, "daily budget exhausted");
            return;
        }
        if (walletSpentOnDay[day][payoutWallet] + amount > walletDailyCap) {
            emit GrantBlocked(payoutWallet, postIdHash, "wallet daily cap");
            return;
        }
        if (rhagent.balanceOf(address(this)) < amount) {
            emit GrantBlocked(payoutWallet, postIdHash, "vault underfunded");
            return;
        }

        paidPostIds[postIdHash] = true;
        spentOnDay[day] += amount;
        walletSpentOnDay[day][payoutWallet] += amount;
        earned[payoutWallet] += amount;
        totalPaid += amount;
        grantCount += 1;

        rhagent.safeTransfer(payoutWallet, amount);
        emit TradeReward(payoutWallet, postIdHash, amount);
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

    function setLimits(uint256 _maxPerPost, uint256 _dailyBudget, uint256 _walletDaily)
        external
        onlyOwner
    {
        maxGrantPerPost = _maxPerPost;
        dailyTokenBudget = _dailyBudget;
        walletDailyCap = _walletDaily;
        emit LimitsUpdated(_maxPerPost, _dailyBudget, _walletDaily);
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

    /// @notice Recover funds. Owner-only; the escape hatch for a migration.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        rhagent.safeTransfer(to, amount);
        emit VaultWithdrawn(to, amount);
    }
}
