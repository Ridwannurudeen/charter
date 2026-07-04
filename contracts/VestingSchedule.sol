// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "./CharterShares.sol";

/// @title VestingSchedule — confidential cliff-and-linear vesting for grants of shares
/// @notice The lifecycle mechanic every real cap table is built around: shares granted to an
/// employee or advisor vest over time rather than existing outright. The issuer escrows an
/// encrypted grant amount into this contract; the beneficiary can claim their vested portion at
/// any time. Nothing vests before the cliff. After the cliff, the vested amount grows linearly to
/// the full grant by the end of the vesting window. Elapsed time is public (a block number reveals
/// nothing sensitive); the grant size, released amount, and every claim stay encrypted.
///
/// The issuer must approve this contract as an operator on the share token before creating a grant
/// (`SHARES.setOperator(address(vestingSchedule), until)`), since the grant is escrowed here via a
/// confidential transfer from the issuer's own balance.
contract VestingSchedule is ZamaEthereumConfig {
    struct Grant {
        address beneficiary;
        euint64 total;
        euint64 released;
        uint48 start;
        uint48 cliff;
        uint48 vestingEnd;
        bool revoked;
    }

    CharterShares public immutable SHARES;

    Grant[] private _grants;

    event GrantCreated(uint256 indexed id, address indexed beneficiary, uint48 cliff, uint48 vestingEnd);
    event Claimed(uint256 indexed id, address indexed beneficiary);
    event Revoked(uint256 indexed id);

    error VestingNotIssuer(address caller);
    error VestingNotBeneficiary(address caller);
    error VestingBadSchedule();
    error VestingAlreadyRevoked(uint256 id);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), VestingNotIssuer(msg.sender));
        _;
    }

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function grantCount() external view returns (uint256) {
        return _grants.length;
    }

    function getGrant(uint256 id) external view returns (Grant memory) {
        return _grants[id];
    }

    /// @notice Creates a vesting grant and escrows the encrypted total from the issuer's balance.
    /// `cliffDelay` and `vestingDuration` are in blocks, measured from the current clock.
    function createGrant(
        address beneficiary,
        externalEuint64 encryptedTotal,
        bytes calldata inputProof,
        uint48 cliffDelay,
        uint48 vestingDuration
    ) external onlyIssuer returns (uint256 id) {
        require(vestingDuration > 0 && cliffDelay <= vestingDuration, VestingBadSchedule());

        euint64 total = FHE.fromExternal(encryptedTotal, inputProof);
        FHE.allowTransient(total, address(SHARES));
        SHARES.confidentialTransferFrom(msg.sender, address(this), total);

        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        FHE.allowThis(total);
        FHE.allow(total, beneficiary);

        uint48 nowClock = uint48(SHARES.clock());
        id = _grants.length;
        _grants.push(
            Grant({
                beneficiary: beneficiary,
                total: total,
                released: zero,
                start: nowClock,
                cliff: nowClock + cliffDelay,
                vestingEnd: nowClock + vestingDuration,
                revoked: false
            })
        );
        emit GrantCreated(id, beneficiary, _grants[id].cliff, _grants[id].vestingEnd);
    }

    /// @notice Returns the vested fraction as of now, expressed as (elapsed, duration) — both
    /// public block counts. No share amount is revealed by this view. Nothing vests before the
    /// cliff; at the cliff the proportional share for the elapsed time vests immediately (the
    /// standard "cliff catch-up"), then vesting continues linearly to the full grant.
    function vestingProgress(uint256 id) public view returns (uint48 elapsed, uint48 duration) {
        Grant storage g = _grants[id];
        uint48 nowClock = uint48(SHARES.clock());
        duration = g.vestingEnd - g.start;
        if (nowClock < g.cliff) {
            elapsed = 0;
        } else if (nowClock >= g.vestingEnd) {
            elapsed = duration;
        } else {
            elapsed = nowClock - g.start;
        }
    }

    /// @notice Claims the currently-releasable portion of a grant. Callable by the beneficiary at
    /// any time; releases nothing before the cliff and the full remainder once fully vested.
    function claim(uint256 id) external {
        Grant storage g = _grants[id];
        require(msg.sender == g.beneficiary, VestingNotBeneficiary(msg.sender));
        require(!g.revoked, VestingAlreadyRevoked(id));

        (uint48 elapsed, uint48 duration) = vestingProgress(id);
        euint64 vested = elapsed == duration ? g.total : FHE.div(FHE.mul(g.total, elapsed), duration);
        euint64 releasable = FHE.sub(vested, g.released);

        g.released = FHE.add(g.released, releasable);
        FHE.allowThis(g.released);
        FHE.allow(g.released, g.beneficiary);

        FHE.allowTransient(releasable, address(SHARES));
        SHARES.confidentialTransfer(g.beneficiary, releasable);
        emit Claimed(id, g.beneficiary);
    }

    /// @notice Revokes a grant (e.g. on termination), settling it immediately: the beneficiary's
    /// vested-but-unclaimed portion is paid out now, and the unvested remainder returns to the
    /// issuer. The grant is fully settled — no further claims are possible after revocation.
    function revoke(uint256 id) external onlyIssuer {
        Grant storage g = _grants[id];
        require(!g.revoked, VestingAlreadyRevoked(id));
        g.revoked = true;

        (uint48 elapsed, uint48 duration) = vestingProgress(id);
        euint64 vested = elapsed == duration ? g.total : FHE.div(FHE.mul(g.total, elapsed), duration);
        euint64 releasable = FHE.sub(vested, g.released);
        euint64 unvested = FHE.sub(g.total, vested);

        FHE.allowTransient(releasable, address(SHARES));
        SHARES.confidentialTransfer(g.beneficiary, releasable);
        FHE.allowTransient(unvested, address(SHARES));
        SHARES.confidentialTransfer(msg.sender, unvested);
        emit Revoked(id);
    }
}
