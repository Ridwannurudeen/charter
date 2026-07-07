// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {CharterShares} from "./CharterShares.sol";

/// @title ConfidentialTenderOffer — a confidential share buyback module
/// @notice A registered CharterShares module that runs a sealed tender offer (share buyback): the
/// issuer offers to repurchase up to a public `maxShares` at a public `pricePerShare`, and holders
/// tender an **encrypted** quantity of shares. How many shares each holder offers to sell stays
/// private; only the aggregate tendered amount is disclosed after the deadline, with an on-chain KMS
/// proof. If the offer is oversubscribed, each holder's accepted quantity is scaled pro-rata on
/// ciphertext (accepted = tendered * maxShares / totalTendered); otherwise every tender is filled.
/// Accepted shares move from the holder to the issuer's treasury and the holder is paid in a
/// confidential payment token, all over encrypted amounts.
///
/// The holder consents by (1) approving this contract as an operator on the share token so the
/// buyback can pull the accepted shares, and (2) submitting an encrypted tender before the deadline.
contract ConfidentialTenderOffer is ZamaEthereumConfig, ReentrancyGuard {
    struct Offer {
        address treasury; // where repurchased shares go (the opener)
        address paymentToken; // confidential cash paid to sellers
        uint64 pricePerShare; // public price in payment-token units
        uint64 maxShares; // public cap the issuer will repurchase
        uint48 deadline; // block number after which tenders close
        euint64 totalTendered; // encrypted sum of all accepted-capped tenders
        bool totalRequested;
        bool totalSettled;
        uint64 totalTenderedClear; // disclosed aggregate, after settleTotal
    }

    CharterShares public immutable SHARES;

    Offer[] private _offers;
    mapping(uint256 offerId => mapping(address holder => euint64)) private _tender;
    mapping(uint256 offerId => mapping(address holder => bool)) public tendered;
    mapping(uint256 offerId => mapping(address holder => bool)) public claimed;

    uint256 public constant MAX_CLAIM_BATCH = 12;

    event OfferOpened(uint256 indexed id, address indexed token, uint64 pricePerShare, uint64 maxShares, uint48 deadline);
    event Tendered(uint256 indexed id, address holder);
    event TotalRequested(uint256 indexed id);
    event TotalSettled(uint256 indexed id, uint64 totalTendered, bool oversubscribed);
    event Claimed(uint256 indexed id, address[] holders);

    error TenderNotIssuer(address caller);
    error TenderBatchTooLarge(uint256 count);
    error TenderBadParams();
    error TenderInvalidToken(address token);
    error TenderClosed(uint256 id);
    error TenderNotClosed(uint256 id);
    error TenderAlready(uint256 id, address holder);
    error TenderNoTotalRequested(uint256 id);
    error TenderNotSettled(uint256 id);

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), TenderNotIssuer(msg.sender));
        _;
    }

    modifier onlyIssuerOrLedger() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender) || msg.sender == address(SHARES), TenderNotIssuer(msg.sender));
        _;
    }

    constructor(CharterShares shares) {
        SHARES = shares;
    }

    function offerCount() external view returns (uint256) {
        return _offers.length;
    }

    function getOffer(uint256 id) external view returns (Offer memory) {
        return _offers[id];
    }

    /// @notice Returns the caller's own encrypted tender handle for an offer (decryptable by them).
    function myTender(uint256 id) external view returns (euint64) {
        return _tender[id][msg.sender];
    }

    /// @notice Opens a buyback. Escrows `pricePerShare * maxShares` of `paymentToken` from the
    /// issuer's treasury (the caller must have approved this contract as an operator on it first).
    function openOffer(
        IERC7984 paymentToken,
        uint64 pricePerShare,
        uint64 maxShares,
        uint48 votingPeriod
    ) external onlyIssuer returns (uint256 id) {
        require(address(paymentToken) != address(0), TenderInvalidToken(address(paymentToken)));
        // Escrow (max payout) must fit euint64; this also bounds every per-holder payment.
        require(
            pricePerShare > 0 &&
                maxShares > 0 &&
                votingPeriod > 0 &&
                uint256(pricePerShare) * maxShares <= type(uint64).max,
            TenderBadParams()
        );

        euint64 escrow = FHE.asEuint64(pricePerShare * maxShares);
        FHE.allowTransient(escrow, address(paymentToken));
        paymentToken.confidentialTransferFrom(msg.sender, address(this), escrow);

        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);

        id = _offers.length;
        _offers.push(
            Offer({
                treasury: msg.sender,
                paymentToken: address(paymentToken),
                pricePerShare: pricePerShare,
                maxShares: maxShares,
                deadline: uint48(SHARES.clock()) + votingPeriod,
                totalTendered: zero,
                totalRequested: false,
                totalSettled: false,
                totalTenderedClear: 0
            })
        );
        emit OfferOpened(id, address(paymentToken), pricePerShare, maxShares, _offers[id].deadline);
    }

    /// @notice Tenders an encrypted quantity of shares into an open offer. The tender is capped at
    /// the holder's current balance, so a holder can never sell more than they hold.
    function tender(uint256 id, externalEuint64 encryptedQuantity, bytes calldata inputProof) external {
        Offer storage o = _offers[id];
        require(SHARES.clock() <= o.deadline, TenderClosed(id));
        require(!tendered[id][msg.sender], TenderAlready(id, msg.sender));
        tendered[id][msg.sender] = true;

        euint64 requested = FHE.fromExternal(encryptedQuantity, inputProof);
        euint64 balance = SHARES.allowBalanceAccess(msg.sender);
        euint64 qty = FHE.isInitialized(balance) ? FHE.min(requested, balance) : FHE.asEuint64(0);

        FHE.allowThis(qty);
        FHE.allow(qty, msg.sender);
        _tender[id][msg.sender] = qty;

        o.totalTendered = FHE.add(o.totalTendered, qty);
        FHE.allowThis(o.totalTendered);

        emit Tendered(id, msg.sender);
    }

    /// @notice After the deadline, makes the aggregate tendered amount publicly decryptable.
    function requestTotal(uint256 id) external {
        Offer storage o = _offers[id];
        require(SHARES.clock() > o.deadline, TenderNotClosed(id));
        FHE.makePubliclyDecryptable(o.totalTendered);
        o.totalRequested = true;
        emit TotalRequested(id);
    }

    /// @notice Settles the disclosed aggregate with its KMS proof. Anyone may relay.
    function settleTotal(uint256 id, uint64 clearTotal, bytes calldata decryptionProof) external {
        Offer storage o = _offers[id];
        require(o.totalRequested, TenderNoTotalRequested(id));

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(o.totalTendered);
        FHE.checkSignatures(handles, abi.encode(clearTotal), decryptionProof);

        o.totalTenderedClear = clearTotal;
        o.totalSettled = true;
        emit TotalSettled(id, clearTotal, clearTotal > o.maxShares);
    }

    /// @notice Fills a batch of holders: pulls their accepted shares to the treasury and pays them
    /// in the confidential payment token. Oversubscribed offers are scaled pro-rata on ciphertext.
    /// Each holder must have approved this contract as an operator on the share token.
    function claim(uint256 id, address[] calldata holders) external onlyIssuer nonReentrant {
        Offer storage o = _offers[id];
        require(o.totalSettled, TenderNotSettled(id));
        require(holders.length <= MAX_CLAIM_BATCH, TenderBatchTooLarge(holders.length));
        bool oversubscribed = o.totalTenderedClear > o.maxShares;

        IERC7984 payToken = IERC7984(o.paymentToken);
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            require(!claimed[id][holder], TenderAlready(id, holder));
            claimed[id][holder] = true;

            euint64 qty = _tender[id][holder];
            if (!FHE.isInitialized(qty)) continue;

            euint64 accepted = oversubscribed ? FHE.div(FHE.mul(qty, o.maxShares), o.totalTenderedClear) : qty;
            FHE.allowTransient(accepted, address(SHARES));
            euint64 transferred = SHARES.confidentialTransferFrom(holder, o.treasury, accepted);

            euint64 payment = FHE.mul(transferred, o.pricePerShare);
            FHE.allowTransient(payment, o.paymentToken);
            payToken.confidentialTransfer(holder, payment);
        }
        emit Claimed(id, holders);
    }

    /// @notice Returns unspent escrow (undersubscribed remainder) to a chosen address.
    function sweep(IERC7984 token, address to) external onlyIssuerOrLedger {
        euint64 balance = token.confidentialBalanceOf(address(this));
        if (FHE.isInitialized(balance)) {
            token.confidentialTransfer(to, balance);
        }
    }
}
