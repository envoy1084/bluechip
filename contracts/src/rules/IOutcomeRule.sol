// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice What an operation did to an account, valued once by `TradeGuard` at Chainlink's prices, for its rules.
/// @dev USDC has 6 decimals, stock tokens 8, Chainlink's stock feeds 8. `index` is the stock's position in the guard's
/// markets.
struct Holding {
    uint256 index;
    address token;
    uint256 before;
    uint256 afterward;
    uint256 price;
}

/// @notice The account's cash and the stocks it held before or after (only those: a stock it never held is worth
/// nothing either side), their total value, the value lost to prices, the value
/// traded (the larger of cash moved and stocks moved), whether a traded price was paused, and the time.
struct Valuation {
    uint256 cashBefore;
    uint256 cashAfter;
    Holding[] holdings;
    uint256 totalBefore;
    uint256 totalAfter;
    uint256 lost;
    uint256 traded;
    bool paused;
    uint256 time;
}

/// @title IOutcomeRule
/// @notice One rule `TradeGuard` checks after an agent's operation. It reverts with its own error when the operation
/// breaks it; `TradeGuard` lets the revert through unchanged.
/// @dev Called only when a stock moved. `key` and `account` identify the session, for rules that keep state (keyed by
/// the caller too, so only the guard that calls a rule writes its state). Stateless rules implement it as `view`.
interface IOutcomeRule {
    function check(Valuation calldata valuation, bytes calldata config, bytes32 key, address account) external;
}
