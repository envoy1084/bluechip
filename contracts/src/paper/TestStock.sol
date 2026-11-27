// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {MintableToken} from "./MintableToken.sol";

/// @title TestStock
/// @notice A paper stock: 8 decimals like Coinbase's stock tokens, with their B20 `multiplier()` at one share per token.
contract TestStock is MintableToken {
    /// @notice One share per token, at the multiplier's 18 decimals: paper stocks have no corporate actions.
    uint256 public constant MULTIPLIER = 1e18;

    string internal _name;
    string internal _symbol;

    constructor(address owner_, string memory name_, string memory symbol_) MintableToken(owner_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    /// @notice How many shares one token stands for, at 18 decimals.
    function multiplier() external pure returns (uint256) {
        return MULTIPLIER;
    }

    /// @notice `account`'s balance in shares (8 decimals), as B20 tokens report it.
    function scaledBalanceOf(address account) external view returns (uint256) {
        return balanceOf(account) * MULTIPLIER / 1e18;
    }
}
