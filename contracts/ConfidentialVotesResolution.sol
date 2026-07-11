// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IConfidentialVotes {
    function clock() external view returns (uint48);

    function delegates(address account) external view returns (address);

    function getPastVotes(address account, uint256 timepoint) external view returns (euint64);

    function getHandleAllowance(bytes32 handle, address account, bool persistent) external;
}

/// @title ConfidentialVotesResolution - outcome-only voting for a confidential votes token
/// @notice A narrow, token-agnostic form of CharterResolutionsV3 for checkpointed confidential
/// voting units. Proposal text, proposer, voters, timing, voter count, quorum status, and the final
/// pass/fail result are public. Vote direction, individual weight, and aggregate totals remain
/// encrypted; only the pass/fail handle is made publicly decryptable.
contract ConfidentialVotesResolution is ZamaEthereumConfig {
    struct Resolution {
        address proposer;
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

    IConfidentialVotes public immutable VOTES;
    uint32 public immutable MIN_VOTERS;

    Resolution[] private _resolutions;
    mapping(uint256 resolutionId => mapping(address voter => bool)) public hasVoted;

    event ResolutionProposed(uint256 indexed id, address indexed proposer, string description, uint48 deadline);
    event VoteCast(uint256 indexed id, address voter);
    event TallyRequested(uint256 indexed id);
    event ResolutionSettled(uint256 indexed id, bool passed, bool quorumReached);

    error VotesResolutionBadConfiguration();
    error VotesResolutionCannotPropose(address caller);
    error VotesResolutionVotingPeriodTooShort();
    error VotesResolutionVotingNotStarted(uint256 id);
    error VotesResolutionVotingClosed(uint256 id);
    error VotesResolutionAlreadyVoted(uint256 id, address voter);
    error VotesResolutionNoVotingPower(address voter);
    error VotesResolutionVotingNotEnded(uint256 id);
    error VotesResolutionTallyAlreadyRequested(uint256 id);
    error VotesResolutionNoTallyRequested(uint256 id);
    error VotesResolutionQuorumNotReached(uint256 id);
    error VotesResolutionAlreadyResolved(uint256 id);

    constructor(IConfidentialVotes votes, uint32 minVoters) {
        require(address(votes) != address(0) && minVoters > 0, VotesResolutionBadConfiguration());
        VOTES = votes;
        MIN_VOTERS = minVoters;
    }

    /// @notice True when `account` has activated self-delegated voting power.
    function canPropose(address account) public view returns (bool) {
        uint48 currentClock = VOTES.clock();
        if (currentClock == 0 || VOTES.delegates(account) != account) {
            return false;
        }
        return FHE.isInitialized(VOTES.getPastVotes(account, currentClock - 1));
    }

    function resolutionCount() external view returns (uint256) {
        return _resolutions.length;
    }

    function getResolution(uint256 id) external view returns (Resolution memory) {
        return _resolutions[id];
    }

    /// @notice Opens a resolution whose voting power snapshots at the current token clock.
    function propose(string calldata description, uint48 votingPeriod) external returns (uint256 id) {
        require(canPropose(msg.sender), VotesResolutionCannotPropose(msg.sender));
        require(votingPeriod > 0, VotesResolutionVotingPeriodTooShort());

        uint48 snapshot = VOTES.clock();
        id = _resolutions.length;
        _resolutions.push();
        Resolution storage resolution = _resolutions[id];
        resolution.proposer = msg.sender;
        resolution.description = description;
        resolution.snapshot = snapshot;
        resolution.deadline = snapshot + votingPeriod;

        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        resolution.forVotes = zero;
        resolution.againstVotes = zero;

        emit ResolutionProposed(id, msg.sender, description, resolution.deadline);
    }

    /// @notice Adds an encrypted for/against vote weighted by the caller's snapshot units.
    function castVote(uint256 id, externalEbool encryptedSupport, bytes calldata inputProof) external {
        Resolution storage resolution = _resolutions[id];
        uint48 currentClock = VOTES.clock();
        require(currentClock > resolution.snapshot, VotesResolutionVotingNotStarted(id));
        require(currentClock <= resolution.deadline, VotesResolutionVotingClosed(id));
        require(!hasVoted[id][msg.sender], VotesResolutionAlreadyVoted(id, msg.sender));
        hasVoted[id][msg.sender] = true;
        resolution.voterCount += 1;

        euint64 weight = VOTES.getPastVotes(msg.sender, resolution.snapshot);
        require(FHE.isInitialized(weight), VotesResolutionNoVotingPower(msg.sender));
        VOTES.getHandleAllowance(euint64.unwrap(weight), address(this), false);

        ebool support = FHE.fromExternal(encryptedSupport, inputProof);
        euint64 zero = FHE.asEuint64(0);
        resolution.forVotes = FHE.add(resolution.forVotes, FHE.select(support, weight, zero));
        resolution.againstVotes = FHE.add(resolution.againstVotes, FHE.select(support, zero, weight));
        FHE.allowThis(resolution.forVotes);
        FHE.allowThis(resolution.againstVotes);

        emit VoteCast(id, msg.sender);
    }

    /// @notice After voting, requests public decryption of only the pass/fail result when quorum
    /// was reached. A non-quorate resolution resolves false without decrypting any tally.
    function requestTally(uint256 id) external {
        Resolution storage resolution = _resolutions[id];
        require(VOTES.clock() > resolution.deadline, VotesResolutionVotingNotEnded(id));
        require(!resolution.tallyRequested, VotesResolutionTallyAlreadyRequested(id));
        resolution.tallyRequested = true;

        if (resolution.voterCount >= MIN_VOTERS) {
            resolution.quorumReached = true;
            ebool passedHandle = FHE.gt(resolution.forVotes, resolution.againstVotes);
            FHE.allowThis(passedHandle);
            FHE.makePubliclyDecryptable(passedHandle);
            resolution.passedHandle = passedHandle;
        } else {
            resolution.resolved = true;
            resolution.passed = false;
        }

        emit TallyRequested(id);
    }

    /// @notice Verifies and stores the publicly decrypted outcome. Anyone may relay the proof.
    function settle(uint256 id, bool passedClear, bytes calldata decryptionProof) external {
        Resolution storage resolution = _resolutions[id];
        require(resolution.tallyRequested, VotesResolutionNoTallyRequested(id));
        require(resolution.quorumReached, VotesResolutionQuorumNotReached(id));
        require(!resolution.resolved, VotesResolutionAlreadyResolved(id));

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = ebool.unwrap(resolution.passedHandle);
        FHE.checkSignatures(handles, abi.encode(passedClear), decryptionProof);

        resolution.passed = passedClear;
        resolution.resolved = true;
        emit ResolutionSettled(id, passedClear, true);
    }
}
