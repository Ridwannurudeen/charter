// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title MockConfidentialUSD — demo confidential stablecoin for Charter distributions
/// @notice Open-mint ERC7984 token standing in for confidential USD on testnet.
contract MockConfidentialUSD is ZamaEthereumConfig, ERC7984 {
    uint64 public constant FAUCET_AMOUNT = 10_000e6; // 10,000 mcUSD

    constructor() ERC7984("Mock Confidential USD", "mcUSD", "") {}

    /// @notice Mints 10,000 mcUSD to the caller.
    function faucet() external {
        _mint(msg.sender, FHE.asEuint64(FAUCET_AMOUNT));
    }

    /// @notice Mints an arbitrary amount to `to`. Unrestricted — testnet mock only.
    function mint(address to, uint64 amount) external {
        _mint(to, FHE.asEuint64(amount));
    }
}
