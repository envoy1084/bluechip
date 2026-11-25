// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC20} from "solady/tokens/ERC20.sol";

import {GuardRules} from "../../src/lib/GuardRules.sol";
import {TradeShape} from "../../src/lib/TradeShape.sol";
import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

/// @notice A token with a public mint and burn, standing in for USDC and the stock tokens.
contract MockToken is ERC20 {
    string internal _symbol;
    uint8 internal immutable _decimals;

    constructor(string memory symbol_, uint8 decimals_) {
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name() public view override returns (string memory) {
        return _symbol;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @notice A Chainlink feed whose answer and times the test sets.
contract MockAggregator {
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;

    function set(int256 answer_, uint256 startedAt_, uint256 updatedAt_) external {
        answer = answer_;
        startedAt = startedAt_;
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, startedAt, updatedAt, 1);
    }
}

/// @notice The pure libraries behind an external function each, so tests can expect their reverts.
contract RulesHarness {
    function check(GuardRules.Input memory input) external pure returns (bool traded, uint256 slippageUsed) {
        return GuardRules.check(input);
    }

    function checkEncoded(bytes calldata input) external pure returns (bool traded, uint256 slippageUsed) {
        return GuardRules.check(abi.decode(input, (GuardRules.Input)));
    }

    function shape(
        TradeShape.Settings memory settings,
        UserOpCalls.Call[] memory calls,
        address account,
        address usdc,
        address router
    ) external pure returns (bool ok, uint256 buys) {
        return TradeShape.check(settings, calls, account, usdc, router);
    }
}
