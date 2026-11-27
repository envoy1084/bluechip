// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Ownable} from "solady/auth/Ownable.sol";

import {PaperFeed} from "./PaperFeed.sol";

/// @title PaperFeedWriter
/// @notice Writes paper's feeds for their owner (bluechip's operator): every feed whose price moved, in one
/// transaction.
contract PaperFeedWriter is Ownable {
    /// @notice `feeds` and `answers` aren't the same length.
    error LengthMismatch();

    constructor(address owner_) {
        _initializeOwner(owner_);
    }

    /// @notice Writes `answers[i]` to `feeds[i]`, as of now.
    function push(PaperFeed[] calldata feeds, int256[] calldata answers) external onlyOwner {
        if (feeds.length != answers.length) revert LengthMismatch();
        for (uint256 i = 0; i < feeds.length; ++i) {
            feeds[i].write(answers[i]);
        }
    }
}
