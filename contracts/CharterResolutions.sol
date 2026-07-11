// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "@gudman/charter-core/contracts/CharterShares.sol";

/// @title CharterResolutions — shareholder resolutions with hidden vote weights
/// @notice Shareholders vote on resolutions with power equal to their checkpointed
/// encrypted holdings at the resolution's snapshot. Both the direction of each vote
/// (encrypted ebool) and its weight (encrypted balance) stay confidential; only the
/// pass/fail outcome is disclosed after the deadline, with a KMS proof verified
/// on-chain.
///
/// Shareholders must self-delegate on the share token before the snapshot to activate
/// their voting checkpoints (standard Votes semantics).
contract CharterResolutions is ZamaEthereumConfig {
    struct Resolution {
        string description;
        uint48 snapshot;
        uint48 deadline;
        euint64 forVotes;
        euint64 againstVotes;
        ebool passedHandle;
        bool tallyRequested;
        bool resolved;
        bool passed;
    }

    CharterShares public immutable SHARES;

    Resolution[] private _resolutions;
    mapping(uint256 resolutionId => mapping(address voter => bool)) public hasVoted;

    event ResolutionProposed(uint256 indexed id, string description, uint48 snapshot, uint48 deadline);
    event VoteCast(uint256 indexed id, address voter);
    event TallyRequested(uint256 indexed id);
    event ResolutionSettled(uint256 indexed id, bool passed);

    error ResolutionsNotIssuer(address caller);
    error ResolutionsVotingClosed(uint256 id);
    error ResolutionsVotingNotStarted(uint256 id);
    error ResolutionsVotingNotEnded(uint256 id);
    error ResolutionsAlreadyVoted(uint256 id, address voter);
    error ResolutionsNoVotingPower(address voter);
    error ResolutionsNoTallyRequested(uint256 id);
    error ResolutionsAlreadyResolved(uint256 id);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), ResolutionsNotIssuer(msg.sender));
        _;
    }

    constructor(CharterShares shares) {
        SHARES = shares;
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

    /// @notice Makes the pass/fail outcome publicly decryptable after the deadline.
    function requestTally(uint256 id) external {
        Resolution storage r = _resolutions[id];
        require(SHARES.clock() > r.deadline, ResolutionsVotingNotEnded(id));
        ebool passedEnc = FHE.gt(r.forVotes, r.againstVotes);
        FHE.allowThis(passedEnc);
        FHE.makePubliclyDecryptable(passedEnc);
        r.passedHandle = passedEnc;
        r.tallyRequested = true;
        emit TallyRequested(id);
    }

    /// @notice Settles the resolution with the decrypted outcome and its KMS proof.
    /// Anyone may relay; forged cleartexts revert in {FHE.checkSignatures}.
    function settle(uint256 id, bool passedClear, bytes calldata decryptionProof) external {
        Resolution storage r = _resolutions[id];
        require(r.tallyRequested, ResolutionsNoTallyRequested(id));
        require(!r.resolved, ResolutionsAlreadyResolved(id));

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = ebool.unwrap(r.passedHandle);
        FHE.checkSignatures(handles, abi.encode(passedClear), decryptionProof);

        r.passed = passedClear;
        r.resolved = true;
        emit ResolutionSettled(id, passedClear);
    }
}
