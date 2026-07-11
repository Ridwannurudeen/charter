// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "@charter/core/contracts/CharterShares.sol";

/// @title ForceTransferGuardian — M-of-N, timelocked, publicly-reasoned enforcement gate
/// @notice `ERC7984Rwa.forceConfidentialTransferFrom` is a single-key power: any one agent can
/// silently seize any holder's shares for any reason, with no on-chain process. That is a real
/// trust assumption, not a compliance mechanism, no matter what it is called. This contract is the
/// production-recommended enforcement path: instead of granting `AGENT_ROLE` to a raw operator key
/// for enforcement actions, grant it to this contract. A forced transfer must then be proposed with
/// a public reason, confirmed by a quorum of named guardians, and wait out a timelock before anyone
/// can execute it — an auditable due-process trail, not a silent seizure. This models genuine
/// checks-and-balances; it is not a claim that a real court order was verified on-chain, which no
/// smart contract can do.
contract ForceTransferGuardian is ZamaEthereumConfig {
    struct Proposal {
        address from;
        address to;
        euint64 amount;
        string reason;
        uint48 readyAt;
        uint32 confirmations;
        bool executed;
    }

    CharterShares public immutable SHARES;
    uint32 public immutable THRESHOLD;
    uint48 public immutable TIMELOCK;

    mapping(address guardian => bool) public isGuardian;
    Proposal[] private _proposals;
    mapping(uint256 proposalId => mapping(address guardian => bool)) public confirmedBy;

    event ProposalCreated(uint256 indexed id, address indexed from, address indexed to, string reason);
    event ProposalConfirmed(uint256 indexed id, address indexed guardian, uint32 confirmations);
    event ProposalExecuted(uint256 indexed id);

    error GuardianNotGuardian(address caller);
    error GuardianAlreadyConfirmed(uint256 id, address guardian);
    error GuardianAlreadyExecuted(uint256 id);
    error GuardianProposalNotFound(uint256 id);
    error GuardianQuorumNotReached(uint256 id);
    error GuardianTimelockNotElapsed(uint256 id);
    error GuardianBadParams();
    error GuardianInvalidGuardian(address guardian);

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], GuardianNotGuardian(msg.sender));
        _;
    }

    constructor(CharterShares shares, address[] memory guardians, uint32 threshold, uint48 timelockDelay) {
        require(guardians.length > 0 && threshold > 0, GuardianBadParams());
        SHARES = shares;
        THRESHOLD = threshold;
        TIMELOCK = timelockDelay;
        uint256 uniqueGuardians;
        for (uint256 i = 0; i < guardians.length; i++) {
            address guardian = guardians[i];
            require(guardian != address(0), GuardianInvalidGuardian(guardian));
            require(!isGuardian[guardian], GuardianInvalidGuardian(guardian));
            isGuardian[guardian] = true;
            uniqueGuardians += 1;
        }
        require(uint256(threshold) <= uniqueGuardians, GuardianBadParams());
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    /// @notice Proposes a forced transfer with a public reason. Auto-confirms from the proposer.
    function propose(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        string calldata reason
    ) external onlyGuardian returns (uint256 id) {
        require(from != address(0), GuardianBadParams());
        require(to != address(0), GuardianBadParams());
        require(from != to, GuardianBadParams());
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);

        id = _proposals.length;
        _proposals.push(
            Proposal({from: from, to: to, amount: amount, reason: reason, readyAt: 0, confirmations: 0, executed: false})
        );
        emit ProposalCreated(id, from, to, reason);
        _confirm(id);
    }

    /// @notice Confirms a pending proposal. Once quorum is reached, starts the timelock clock.
    function confirm(uint256 id) external onlyGuardian {
        require(id < _proposals.length, GuardianProposalNotFound(id));
        require(!_proposals[id].executed, GuardianAlreadyExecuted(id));
        _confirm(id);
    }

    function _confirm(uint256 id) private {
        require(id < _proposals.length, GuardianProposalNotFound(id));
        require(!confirmedBy[id][msg.sender], GuardianAlreadyConfirmed(id, msg.sender));
        confirmedBy[id][msg.sender] = true;

        Proposal storage p = _proposals[id];
        p.confirmations += 1;
        if (p.confirmations == THRESHOLD) {
            p.readyAt = uint48(SHARES.clock()) + TIMELOCK;
        }
        emit ProposalConfirmed(id, msg.sender, p.confirmations);
    }

    /// @notice Executes a proposal once quorum has been reached and the timelock has elapsed.
    /// Callable by anyone — the guardians' job is confirmation, not execution.
    function execute(uint256 id) external {
        require(id < _proposals.length, GuardianProposalNotFound(id));
        Proposal storage p = _proposals[id];
        require(!p.executed, GuardianAlreadyExecuted(id));
        require(p.confirmations >= THRESHOLD, GuardianQuorumNotReached(id));
        require(SHARES.clock() >= p.readyAt, GuardianTimelockNotElapsed(id));
        p.executed = true;

        FHE.allowTransient(p.amount, address(SHARES));
        SHARES.forceConfidentialTransferFrom(p.from, p.to, p.amount);
        emit ProposalExecuted(id);
    }
}
