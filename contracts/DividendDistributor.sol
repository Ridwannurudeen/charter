// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CharterShares} from "./CharterShares.sol";

/// @title DividendDistributor — pro-rata distributions over encrypted holdings
/// @notice The issuer declares a distribution with a public pool amount in any ERC7984
/// payment token. Each investor's payout is computed on-chain from their encrypted
/// share balance: payout = balance * pool / totalSharesOnRecord. The pool total is
/// public and verifiable; every individual payout stays encrypted, decryptable only
/// by its recipient (and any observer they appointed).
///
/// Record-date integrity: declarations require the share token to be paused, so
/// balances cannot move between the record date and payout batches.
contract DividendDistributor is ZamaEthereumConfig, ReentrancyGuard {
    struct Distribution {
        address token;
        uint64 pool;
        uint64 totalShares;
        uint48 declaredAt;
    }

    CharterShares public immutable SHARES;
    uint256 public constant MAX_PAY_BATCH = 12;

    Distribution[] private _distributions;
    mapping(uint256 distributionId => mapping(address investor => bool)) public paid;

    event DistributionDeclared(uint256 indexed id, address indexed token, uint64 pool, uint64 totalShares);
    event BatchPaid(uint256 indexed id, address[] investors);
    event Swept(address indexed token, address indexed to);

    error DistributorNotIssuer(address caller);
    error DistributorNoRecordSupply();
    error DistributorPoolOverflow();
    error DistributorBatchTooLarge(uint256 count);
    error DistributorSharesNotPaused();
    error DistributorStaleSupply();
    error DistributorAlreadyPaid(uint256 id, address investor);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), DistributorNotIssuer(msg.sender));
        _;
    }

    modifier onlyIssuerOrLedger() {
        require(
            SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender) || msg.sender == address(SHARES),
            DistributorNotIssuer(msg.sender)
        );
        _;
    }

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function distributionCount() external view returns (uint256) {
        return _distributions.length;
    }

    function getDistribution(uint256 id) external view returns (Distribution memory) {
        return _distributions[id];
    }

    /// @notice Declares a distribution and pulls `poolAmount` of `payToken` from the
    /// caller's treasury. The caller must have set this contract as an operator on
    /// `payToken` beforehand.
    function declare(IERC7984 payToken, uint64 poolAmount) external onlyIssuer returns (uint256 id) {
        require(SHARES.paused(), DistributorSharesNotPaused());
        uint64 totalShares = SHARES.totalSharesOnRecord();
        require(totalShares > 0, DistributorNoRecordSupply());
        require(!SHARES.supplyDisclosureStale(), DistributorStaleSupply());
        // balance * pool must fit in euint64 for every balance <= totalShares
        require(poolAmount > 0 && uint256(poolAmount) * totalShares <= type(uint64).max, DistributorPoolOverflow());

        euint64 pool = FHE.asEuint64(poolAmount);
        FHE.allowTransient(pool, address(payToken));
        payToken.confidentialTransferFrom(msg.sender, address(this), pool);

        id = _distributions.length;
        _distributions.push(
            Distribution({token: address(payToken), pool: poolAmount, totalShares: totalShares, declaredAt: uint48(block.timestamp)})
        );
        emit DistributionDeclared(id, address(payToken), poolAmount, totalShares);
    }

    /// @notice Pays a batch of investors their pro-rata cut of distribution `id`.
    /// Keep batches small (~15 investors) to stay within the per-transaction HCU budget.
    function payBatch(uint256 id, address[] calldata investors) external onlyIssuer nonReentrant {
        Distribution storage d = _distributions[id];
        require(SHARES.paused(), DistributorSharesNotPaused());
        require(investors.length <= MAX_PAY_BATCH, DistributorBatchTooLarge(investors.length));

        IERC7984 token = IERC7984(d.token);
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            require(!paid[id][investor], DistributorAlreadyPaid(id, investor));
            paid[id][investor] = true;

            euint64 balance = SHARES.allowBalanceAccess(investor);
            if (!FHE.isInitialized(balance)) continue; // never held shares — zero payout

            euint64 payout = FHE.div(FHE.mul(balance, d.pool), d.totalShares);
            FHE.allowTransient(payout, d.token);
            token.confidentialTransfer(investor, payout);
        }
        emit BatchPaid(id, investors);
    }

    /// @notice Returns this contract's remaining balance of `token` (rounding dust,
    /// unclaimed remainders) to `to`.
    function sweep(IERC7984 token, address to) external onlyIssuerOrLedger {
        euint64 balance = token.confidentialBalanceOf(address(this));
        if (FHE.isInitialized(balance)) {
            token.confidentialTransfer(to, balance);
        }
        emit Swept(address(token), to);
    }
}
