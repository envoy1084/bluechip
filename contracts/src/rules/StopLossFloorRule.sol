// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title StopLossFloorRule
/// @notice A stock the operation sold had Chainlink's price at or under the floor you set for it, so a Stop-loss guard
/// never sells at a good price. Buys are not affected.
contract StopLossFloorRule is IOutcomeRule {
    /// @notice The highest price each stock may be sold at (USD, 8 decimals, Chainlink's scale), one per valued stock
    /// in the guard's order; 0 means the agent never sells that stock.
    struct Config {
        uint256[] floors;
    }

    /// @notice A stock the operation sold is priced above its floor.
    error AboveFloor(address token);
    /// @notice The configuration has fewer floors than the guard values stocks.
    error FloorsMismatch();

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));

        for (uint256 i; i < valuation.holdings.length; ++i) {
            if (valuation.holdings[i].afterward >= valuation.holdings[i].before) continue;

            uint256 index = valuation.holdings[i].index;
            if (index >= limits.floors.length) revert FloorsMismatch();
            // A floor of 0 refuses every sale: `TradeGuard` values a stock held only at a price above 0.
            if (valuation.holdings[i].price > limits.floors[index]) {
                revert AboveFloor(valuation.holdings[i].token);
            }
        }
    }
}
