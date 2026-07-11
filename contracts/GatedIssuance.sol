// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {AccreditationRegistry} from "./AccreditationRegistry.sol";
import {CharterShares} from "@charter/core/contracts/CharterShares.sol";

/// @title GatedIssuance — mints new shares only to accredited wallets
/// @notice The compliant counterpart to the open `DemoShareFaucet`: a regulated issuer would never
/// mint equity to an arbitrary wallet. This module is registered as its own agent (identical
/// registration pattern to every other Charter module — no redeploy of the share ledger) and
/// enforces `AccreditationRegistry.isAccredited(to)` before every mint. It demonstrates the actual
/// on-chain gate a real issuance would need; it does not itself perform identity verification,
/// which — as with every real securities offering — happens off-chain before an admin accredits a
/// wallet.
contract GatedIssuance is ZamaEthereumConfig {
    CharterShares public immutable SHARES;
    AccreditationRegistry public immutable REGISTRY;

    event Issued(address indexed to);

    error IssuanceNotIssuer(address caller);
    error IssuanceNotAccredited(address to);
    error IssuanceInvalidRecipient(address recipient);
    error IssuanceBadRegistry(address registry);
    error IssuanceModuleNotActive(address module);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), IssuanceNotIssuer(msg.sender));
        _;
    }

    modifier onlyActiveModule() {
        require(SHARES.isModule(address(this)), IssuanceModuleNotActive(address(this)));
        _;
    }

    constructor(CharterShares shares, AccreditationRegistry registry) {
        require(address(registry) != address(0), IssuanceBadRegistry(address(registry)));
        SHARES = shares;
        REGISTRY = registry;
    }

    /// @notice Mints an encrypted share amount to `to`, reverting unless `to` is accredited.
    function issue(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external onlyIssuer onlyActiveModule {
        require(to != address(0), IssuanceInvalidRecipient(to));
        require(REGISTRY.isAccredited(to), IssuanceNotAccredited(to));
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(amount, address(SHARES));
        SHARES.confidentialMint(to, amount);
        emit Issued(to);
    }
}
