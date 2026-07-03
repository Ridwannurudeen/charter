// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984Rwa} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984Rwa.sol";
import {ERC7984Votes} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984Votes.sol";
import {
    ERC7984ObserverAccess
} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ObserverAccess.sol";

/// @title CharterShares — a confidential share registry for a private company
/// @notice Company shares as an ERC7984 confidential token. Individual holdings are
/// encrypted on-chain; only the holder (and an observer they appoint, e.g. an auditor)
/// can decrypt them. Compliance controls (agent mint/burn, transfer restrictions,
/// freezing, forced transfers, pause) come from ERC7984Rwa. Checkpointed encrypted
/// voting power (ERC7984Votes) backs shareholder resolutions.
///
/// The total number of issued shares can be disclosed publicly through the Zama
/// decryption oracle with an on-chain KMS proof ("verifiable total, hidden individual
/// holdings"). The disclosed total is the record supply used by distribution modules
/// for pro-rata payout math on encrypted balances.
contract CharterShares is ZamaEthereumConfig, ERC7984Rwa, ERC7984ObserverAccess, ERC7984Votes {
    /// @notice Registered protocol modules (distributor, resolutions) allowed to
    /// receive scoped access to encrypted handles held by this contract.
    mapping(address module => bool) public isModule;

    /// @notice Total issued shares as last disclosed through the decryption oracle.
    uint64 public totalSharesOnRecord;
    /// @notice Clock value (block number) at which the record supply was finalized.
    uint48 public recordTimepoint;

    euint64 private _pendingSupplyHandle;
    uint48 private _lastSupplyChangeTimepoint;

    event ModuleSet(address indexed module, bool enabled);
    event SupplyDisclosureRequested(euint64 supplyHandle);
    event SupplyDisclosed(uint64 totalShares, uint48 recordTimepoint);

    error CharterNotModule(address caller);
    error CharterNoSupply();
    error CharterNoPendingDisclosure();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory contractURI_,
        address admin
    ) ERC7984(name_, symbol_, contractURI_) ERC7984Rwa(admin) EIP712(name_, "1") {}

    /// @notice Shares are whole units — no decimals.
    function decimals() public pure override(IERC7984, ERC7984) returns (uint8) {
        return 0;
    }

    /// @notice Registers or removes a protocol module (distributor, resolutions).
    function setModule(address module, bool enabled) external onlyAdmin {
        isModule[module] = enabled;
        emit ModuleSet(module, enabled);
    }

    /// @notice Grants the calling module transient (same-transaction) ACL access to
    /// `account`'s encrypted balance and returns the balance handle. Used by the
    /// distributor to compute pro-rata payouts on encrypted holdings.
    function allowBalanceAccess(address account) external returns (euint64 balance) {
        require(isModule[msg.sender], CharterNotModule(msg.sender));
        balance = confidentialBalanceOf(account);
        if (FHE.isInitialized(balance)) {
            FHE.allowTransient(balance, msg.sender);
        }
    }

    /// @notice Starts public disclosure of the current total supply through the
    /// decryption oracle. The cleartext comes back via {finalizeSupplyDisclosure}
    /// with a KMS proof verified on-chain.
    function requestSupplyDisclosure() external onlyAgent {
        euint64 supply = confidentialTotalSupply();
        require(FHE.isInitialized(supply), CharterNoSupply());
        FHE.makePubliclyDecryptable(supply);
        _pendingSupplyHandle = supply;
        emit SupplyDisclosureRequested(supply);
    }

    /// @notice Finalizes a supply disclosure with the KMS decryption proof. Anyone may
    /// relay the proof; forged cleartexts revert in {FHE.checkSignatures}.
    function finalizeSupplyDisclosure(uint64 clearSupply, bytes calldata decryptionProof) external {
        euint64 pending = _pendingSupplyHandle;
        require(FHE.isInitialized(pending), CharterNoPendingDisclosure());

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(pending);
        FHE.checkSignatures(handles, abi.encode(clearSupply), decryptionProof);

        totalSharesOnRecord = clearSupply;
        recordTimepoint = clock();
        _pendingSupplyHandle = euint64.wrap(0);
        emit SupplyDisclosed(clearSupply, recordTimepoint);
    }

    /// @notice Returns true when shares were minted or burned after the last supply disclosure.
    function supplyDisclosureStale() public view returns (bool) {
        return _lastSupplyChangeTimepoint > recordTimepoint;
    }

    /// @dev Registered modules may request access to handles this contract holds ACL
    /// for (e.g. voting-power checkpoints read by the resolutions module).
    function _validateHandleAllowance(bytes32) internal view override returns (bool) {
        return isModule[msg.sender];
    }

    function confidentialTotalSupply()
        public
        view
        override(IERC7984, ERC7984, ERC7984Votes)
        returns (euint64)
    {
        return super.confidentialTotalSupply();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC7984, ERC7984Rwa) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address from,
        address to,
        euint64 amount
    ) internal override(ERC7984Rwa, ERC7984ObserverAccess, ERC7984Votes) returns (euint64) {
        if (from == address(0) || to == address(0)) {
            _lastSupplyChangeTimepoint = clock();
        }
        return super._update(from, to, amount);
    }
}
