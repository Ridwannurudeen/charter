// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "./CharterShares.sol";

/// @title DemoShareFaucet - one-time testnet share grants for self-serve demos
contract DemoShareFaucet is ZamaEthereumConfig {
    CharterShares public immutable SHARES;
    uint64 public constant GRANT = 1000;

    mapping(address account => bool) public claimed;

    error AlreadyClaimed(address account);

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function claim() external {
        require(!claimed[msg.sender], AlreadyClaimed(msg.sender));
        claimed[msg.sender] = true;

        euint64 amount = FHE.asEuint64(GRANT);
        FHE.allowThis(amount);
        FHE.allowTransient(amount, address(SHARES));
        SHARES.confidentialMint(msg.sender, amount);
    }
}
