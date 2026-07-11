// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {CharterShares} from "@charter/core/contracts/CharterShares.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract PublicDecryptLeakingProbe is ZamaEthereumConfig {
    CharterShares public immutable SHARES;

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function inspect(address holder, address otherHolder) external returns (euint64 result) {
        euint64 balance = SHARES.allowBalanceAccess(holder);
        if (FHE.isInitialized(balance)) {
            result = FHE.add(balance, 1);
            FHE.allowThis(result);
        }

        euint64 otherBalance = SHARES.allowBalanceAccess(otherHolder);
        if (FHE.isInitialized(otherBalance)) {
            FHE.makePubliclyDecryptable(otherBalance);
        }
    }
}
