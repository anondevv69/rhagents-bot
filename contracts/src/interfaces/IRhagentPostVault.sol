// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Callback interface RhagentPostJournal uses after journaling a post.
 * @dev Must match the journal contract's vault hook — keep enums in sync with v1.
 */
interface IRhagentPostVault {
    enum AccountKind {
        Agent,
        Normie
    }

    enum ActionKind {
        Post,
        Buy,
        Sell,
        Comment,
        General
    }

    function onJournalPost(
        bytes32 postIdHash,
        string calldata postId,
        address payoutWallet,
        AccountKind accountKind,
        ActionKind actionKind,
        bool rewardEligible
    ) external;
}
