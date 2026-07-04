// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title AccreditationRegistry — an on-chain allowlist of accredited/KYC'd wallets
/// @notice A regulated equity offering issues to a default-deny list of verified investors, not an
/// open public. This registry is the on-chain primitive for that: an admin (the issuer's compliance
/// function, or a delegated KYC provider) marks specific wallets as accredited; nothing else. It
/// does not perform real identity verification itself — that happens off-chain, as it does for
/// every real securities offering — but it gives an issuance module a concrete, auditable gate to
/// check before minting, replacing the "mint to anyone, block bad actors after the fact" pattern
/// with "mint only to wallets explicitly cleared in advance."
contract AccreditationRegistry {
    address public admin;
    mapping(address account => bool) public accredited;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event AccreditationSet(address indexed account, bool status);

    error RegistryNotAdmin(address caller);
    error RegistryZeroAddress();

    modifier onlyAdmin() {
        require(msg.sender == admin, RegistryNotAdmin(msg.sender));
        _;
    }

    constructor(address admin_) {
        require(admin_ != address(0), RegistryZeroAddress());
        admin = admin_;
        emit AdminTransferred(address(0), admin_);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), RegistryZeroAddress());
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function setAccredited(address account, bool status) external onlyAdmin {
        accredited[account] = status;
        emit AccreditationSet(account, status);
    }

    function setAccreditedBatch(address[] calldata accounts, bool status) external onlyAdmin {
        for (uint256 i = 0; i < accounts.length; i++) {
            accredited[accounts[i]] = status;
            emit AccreditationSet(accounts[i], status);
        }
    }

    function isAccredited(address account) external view returns (bool) {
        return accredited[account];
    }
}
