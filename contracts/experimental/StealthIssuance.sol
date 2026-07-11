// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {CharterShares} from "@gudman/charter-core/contracts/CharterShares.sol";

interface IERC5564Announcer {
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}

/// @title StealthIssuance - experimental ERC-5564 share issuance adapter
/// @notice Mints encrypted shares to a precomputed scheme 1 stealth address and atomically announces it.
contract StealthIssuance is ZamaEthereumConfig {
    uint256 public constant SCHEME_ID = 1;

    CharterShares public immutable SHARES;
    IERC5564Announcer public immutable ANNOUNCER;

    error StealthNotIssuer(address caller);
    error StealthModuleNotActive(address module);
    error StealthInvalidTarget();
    error StealthInvalidAnnouncer();
    error StealthInvalidEphemeralPublicKey();

    modifier onlyIssuer() {
        require(SHARES.isAdmin(msg.sender) || SHARES.isAgent(msg.sender), StealthNotIssuer(msg.sender));
        _;
    }

    modifier onlyActiveModule() {
        require(SHARES.isModule(address(this)), StealthModuleNotActive(address(this)));
        _;
    }

    constructor(CharterShares shares, IERC5564Announcer announcer) {
        require(address(announcer) != address(0), StealthInvalidAnnouncer());
        SHARES = shares;
        ANNOUNCER = announcer;
    }

    function issue(
        address stealthAddress,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external onlyIssuer onlyActiveModule {
        require(stealthAddress != address(0), StealthInvalidTarget());

        bool validPublicKey;
        if (ephemeralPubKey.length == 33) {
            validPublicKey = ephemeralPubKey[0] == 0x02 || ephemeralPubKey[0] == 0x03;
        } else if (ephemeralPubKey.length == 65) {
            validPublicKey = ephemeralPubKey[0] == 0x04;
        }
        require(validPublicKey, StealthInvalidEphemeralPublicKey());

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(amount, address(SHARES));
        SHARES.confidentialMint(stealthAddress, amount);

        bytes memory metadata = abi.encodePacked(viewTag, this.issue.selector, address(SHARES));
        ANNOUNCER.announce(SCHEME_ID, stealthAddress, ephemeralPubKey, metadata);
    }
}
