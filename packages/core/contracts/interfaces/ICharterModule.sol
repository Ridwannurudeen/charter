// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @notice Minimum identity surface required for a Charter module.
interface ICharterModule {
    function SHARES() external view returns (address);
}

/// @notice Optional recovery surface for modules that escrow confidential tokens.
interface ICharterModuleFundsRecoverable {
    function sweep(IERC7984 token, address to) external;
}
