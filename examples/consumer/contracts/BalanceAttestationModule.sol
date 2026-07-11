// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {CharterShares} from "@charter/core/contracts/CharterShares.sol";
import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Example module that privately records whether a holder has a nonzero share balance.
contract BalanceAttestationModule is ZamaEthereumConfig {
    CharterShares public immutable SHARES;
    mapping(address holder => ebool attestation) private _attestations;

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function attest(address holder) external {
        euint64 balance = SHARES.allowBalanceAccess(holder);
        ebool attestation = FHE.isInitialized(balance) ? FHE.gt(balance, 0) : FHE.asEbool(false);

        FHE.allowThis(attestation);
        FHE.allow(attestation, holder);
        _attestations[holder] = attestation;
    }

    function myAttestation() external view returns (ebool) {
        return _attestations[msg.sender];
    }
}
