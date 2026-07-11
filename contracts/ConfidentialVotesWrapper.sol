// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984Votes} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984Votes.sol";

/// @title ConfidentialVotesWrapper - checkpointed voting units for an ERC-7984 token
/// @notice Escrows one confidential token and mints matching, non-transferable ERC7984Votes units.
/// Deposit and withdrawal accounts and transaction timing are public, while amounts and voting
/// weights remain encrypted. Holders must approve this contract as an operator on the underlying
/// token before depositing.
/// @dev This is a standalone token wrapper, not a Charter module. The owner may authorize vote
/// modules to obtain transient access to handles held by this contract. Authorized modules are a
/// confidentiality trust decision because the inherited handle allowance API is not handle-scoped.
contract ConfidentialVotesWrapper is ZamaEthereumConfig, ERC7984Votes, Ownable, ReentrancyGuard {
    IERC7984 public immutable UNDERLYING;

    mapping(address module => bool) public isVoteModule;

    event Deposited(address indexed account, euint64 encryptedAmount);
    event Withdrawn(address indexed account, euint64 encryptedAmount);
    event VoteModuleSet(address indexed module, bool enabled);

    error VotesWrapperInvalidUnderlying();
    error VotesWrapperInvalidModule(address module);
    error VotesWrapperNonTransferable();

    constructor(
        IERC7984 underlying,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC7984(name_, symbol_, "") EIP712(name_, "1") Ownable(initialOwner) {
        require(address(underlying) != address(0), VotesWrapperInvalidUnderlying());
        UNDERLYING = underlying;
    }

    /// @notice Pulls an encrypted amount from the caller and mints the amount actually received.
    /// @dev The caller must have approved this wrapper as an operator on the underlying token.
    function deposit(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (euint64 deposited) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(requested, address(UNDERLYING));
        deposited = UNDERLYING.confidentialTransferFrom(msg.sender, address(this), requested);
        deposited = _mint(msg.sender, deposited);
        emit Deposited(msg.sender, deposited);
    }

    /// @notice Burns an encrypted amount of the caller's voting units and returns the same amount
    /// of underlying tokens from escrow.
    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (euint64 withdrawn) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        withdrawn = _burn(msg.sender, requested);
        FHE.allowTransient(withdrawn, address(UNDERLYING));
        withdrawn = UNDERLYING.confidentialTransfer(msg.sender, withdrawn);
        emit Withdrawn(msg.sender, withdrawn);
    }

    /// @notice Enables or disables a contract that consumes encrypted vote checkpoints.
    function setVoteModule(address module, bool enabled) external onlyOwner {
        require(module != address(0) && (!enabled || module.code.length != 0), VotesWrapperInvalidModule(module));
        isVoteModule[module] = enabled;
        emit VoteModuleSet(module, enabled);
    }

    /// @notice Mirrors the underlying token's display precision.
    function decimals() public view override returns (uint8) {
        return UNDERLYING.decimals();
    }

    function _validateHandleAllowance(bytes32) internal view override returns (bool) {
        return isVoteModule[msg.sender];
    }

    function _update(address from, address to, euint64 amount) internal override returns (euint64) {
        require(from == address(0) || to == address(0), VotesWrapperNonTransferable());
        return super._update(from, to, amount);
    }
}
