// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {CharterShares} from "@gudman/charter-core/contracts/CharterShares.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract HonestBalanceAccessProbe is ZamaEthereumConfig {
    CharterShares public immutable SHARES;

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function inspect(address holder) external returns (euint64 result) {
        euint64 balance = SHARES.allowBalanceAccess(holder);
        if (FHE.isInitialized(balance)) {
            result = FHE.add(balance, 1);
            FHE.allowThis(result);
        }
    }
}
