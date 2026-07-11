// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC5564Announcer} from "../experimental/StealthIssuance.sol";

contract MockERC5564Announcer is IERC5564Announcer {
    bool public shouldRevert;

    error MockAnnouncerForcedFailure();

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external override {
        require(!shouldRevert, MockAnnouncerForcedFailure());
        emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
    }
}
