// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title StockCapRule
/// @notice A stock the operation bought ends at most the cap's share of the portfolio.
contract StockCapRule is IOutcomeRule {
    using TradeMath for uint256;

    /// @notice The largest share of the portfolio one stock may reach through a buy, in basis points.
    struct Config {
        uint16 maxBps;
    }

    /// @notice A stock the operation bought would pass the most the portfolio may hold of one stock.
    error OverStockCap(address token);

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));

        for (uint256 i; i < valuation.holdings.length; ++i) {
            if (valuation.holdings[i].afterward <= valuation.holdings[i].before) continue;

            uint256 value = valuation.holdings[i].afterward.valueOf(valuation.holdings[i].price);
            if (!value.isAtMostBps(valuation.totalAfter, limits.maxBps)) {
                revert OverStockCap(valuation.holdings[i].token);
            }
        }
    }
}
