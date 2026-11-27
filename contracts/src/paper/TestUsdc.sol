// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {MintableToken} from "./MintableToken.sol";

/// @title TestUsdc
/// @notice Paper's dollar: "Test USDC", 6 decimals like Circle's USDC.
contract TestUsdc is MintableToken {
    constructor(address owner_) MintableToken(owner_) {}

    function name() public pure override returns (string memory) {
        return "Test USDC";
    }

    function symbol() public pure override returns (string memory) {
        return "USDC";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
