// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title TradeSizeRule
/// @notice Each stock an operation moved is worth at least the smallest trade and at most the agent's largest, at
/// Chainlink's price.
contract TradeSizeRule is IOutcomeRule {
    using TradeMath for uint256;

    /// @notice The smallest and largest trade, in USDC units.
    struct Config {
        uint128 minTrade;
        uint128 maxTrade;
    }

    /// @notice A trade worth less than the smallest trade.
    error TooSmall(address token);
    /// @notice A trade worth more than the agent may trade at once.
    error OverTradeSize(address token);

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));

        for (uint256 i; i < valuation.holdings.length; ++i) {
            uint256 before = valuation.holdings[i].before;
            uint256 afterward = valuation.holdings[i].afterward;
            if (afterward == before) continue;

            uint256 value =
                (afterward > before ? afterward - before : before - afterward).valueOf(valuation.holdings[i].price);
            if (value < limits.minTrade) revert TooSmall(valuation.holdings[i].token);
            if (value > limits.maxTrade) revert OverTradeSize(valuation.holdings[i].token);
        }
    }
}
