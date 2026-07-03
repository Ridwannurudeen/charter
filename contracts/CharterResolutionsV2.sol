// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "./CharterShares.sol";

/// @title CharterResolutionsV2 — shareholder resolutions with a participation quorum
/// @notice A drop-in replacement for the original CharterResolutions module, registered live
/// through {CharterShares.setModule} without redeploying the share token — demonstrating the
/// registry's composability. Same outcome-only privacy model (only the encrypted pass/fail result
/// is ever disclosed; exact tallies never leave ciphertext), plus a minimum-participation quorum
/// so a resolution can no longer pass on a single vote. Quorum is measured on the public voter
/// count, not on encrypted weight, so enforcing it leaks nothing that was previously private.
contract CharterResolutionsV2 is ZamaEthereumConfig {
    struct Resolution {
        string description;
        uint48 snapshot;
        uint48 deadline;
        euint64 forVotes;
        euint64 againstVotes;
        ebool passedHandle;
        uint32 voterCount;
        bool quorumReached;
        bool tallyRequested;
        bool resolved;
        bool passed;
    }

    CharterShares public immutable SHARES;
    /// @notice Minimum distinct voters required for a resolution to reach quorum and be settleable.
    uint32 public immutable MIN_VOTERS;

    Resolution[] private _resolutions;
    mapping(uint256 resolutionId => mapping(address voter => bool)) public hasVoted;

    event ResolutionProposed(uint256 indexed id, string description, uint48 snapshot, uint48 deadline);
    event VoteCast(uint256 indexed id, address voter);
    event TallyRequested(uint256 indexed id);
    event ResolutionSettled(uint256 indexed id, bool passed, bool quorumReached);

    error ResolutionsNotIssuer(address caller);
    error ResolutionsVotingClosed(uint256 id);
    error ResolutionsVotingNotStarted(uint256 id);
    error ResolutionsVotingNotEnded(uint256 id);
    error ResolutionsAlreadyVoted(uint256 id, address voter);
    error ResolutionsNoVotingPower(address voter);
    error ResolutionsNoTallyRequested(uint256 id);
    error ResolutionsAlreadyResolved(uint256 id);
    error ResolutionsQuorumNotReached(uint256 id);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), ResolutionsNotIssuer(msg.sender));
        _;
    }

    constructor(CharterShares shares, uint32 minVoters) {
        SHARES = shares;
        MIN_VOTERS = minVoters;
    }

    function resolutionCount() external view returns (uint256) {
        return _resolutions.length;
    }

    function getResolution(uint256 id) external view returns (Resolution memory) {
        return _resolutions[id];
    }

    /// @notice Proposes a resolution. Voting power snapshots at the current clock;
    /// voting opens next block and closes after `votingPeriod` blocks.
    function propose(string calldata description, uint48 votingPeriod) external onlyIssuer returns (uint256 id) {
        uint48 snapshot = SHARES.clock();

        id = _resolutions.length;
        _resolutions.push();
        Resolution storage r = _resolutions[id];
        r.description = description;
        r.snapshot = snapshot;
        r.deadline = snapshot + votingPeriod;

        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        r.forVotes = zero;
        r.againstVotes = zero;

        emit ResolutionProposed(id, description, snapshot, r.deadline);
    }

    /// @notice Casts an encrypted for/against vote weighted by the voter's snapshot
    /// holdings. Neither the direction nor the weight is revealed.
    function castVote(uint256 id, externalEbool encryptedSupport, bytes calldata inputProof) external {
        Resolution storage r = _resolutions[id];
        uint48 currentClock = SHARES.clock();
        require(currentClock > r.snapshot, ResolutionsVotingNotStarted(id));
        require(currentClock <= r.deadline, ResolutionsVotingClosed(id));
        require(!hasVoted[id][msg.sender], ResolutionsAlreadyVoted(id, msg.sender));
        hasVoted[id][msg.sender] = true;
        r.voterCount += 1;

        euint64 weight = SHARES.getPastVotes(msg.sender, r.snapshot);
        require(FHE.isInitialized(weight), ResolutionsNoVotingPower(msg.sender));
        SHARES.getHandleAllowance(euint64.unwrap(weight), address(this), false);

        ebool support = FHE.fromExternal(encryptedSupport, inputProof);
        euint64 zero = FHE.asEuint64(0);

        r.forVotes = FHE.add(r.forVotes, FHE.select(support, weight, zero));
        r.againstVotes = FHE.add(r.againstVotes, FHE.select(support, zero, weight));
        FHE.allowThis(r.forVotes);
        FHE.allowThis(r.againstVotes);

        emit VoteCast(id, msg.sender);
    }

    /// @notice After the deadline, either makes the pass/fail outcome publicly decryptable (if the
    /// quorum was met) or resolves the resolution as failed for lack of quorum without disclosing
    /// anything.
    function requestTally(uint256 id) external {
        Resolution storage r = _resolutions[id];
        require(SHARES.clock() > r.deadline, ResolutionsVotingNotEnded(id));
        require(!r.resolved, ResolutionsAlreadyResolved(id));
        r.tallyRequested = true;

        if (r.voterCount >= MIN_VOTERS) {
            r.quorumReached = true;
            ebool passedEnc = FHE.gt(r.forVotes, r.againstVotes);
            FHE.allowThis(passedEnc);
            FHE.makePubliclyDecryptable(passedEnc);
            r.passedHandle = passedEnc;
        } else {
            // Quorum not reached: the resolution fails, and no tally is disclosed.
            r.resolved = true;
            r.passed = false;
        }
        emit TallyRequested(id);
    }

    /// @notice Settles a quorate resolution with the decrypted outcome and its KMS proof.
    /// Anyone may relay; forged cleartexts revert in {FHE.checkSignatures}.
    function settle(uint256 id, bool passedClear, bytes calldata decryptionProof) external {
        Resolution storage r = _resolutions[id];
        require(r.tallyRequested, ResolutionsNoTallyRequested(id));
        require(r.quorumReached, ResolutionsQuorumNotReached(id));
        require(!r.resolved, ResolutionsAlreadyResolved(id));

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = ebool.unwrap(r.passedHandle);
        FHE.checkSignatures(handles, abi.encode(passedClear), decryptionProof);

        r.passed = passedClear;
        r.resolved = true;
        emit ResolutionSettled(id, passedClear, true);
    }
}
