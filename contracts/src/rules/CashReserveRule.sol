// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title CashReserveRule
/// @notice Cash that the operation spent stays at or above the reserve's share of the portfolio.
contract CashReserveRule is IOutcomeRule {
    /// @notice The smallest share of the portfolio kept in cash, in basis points.
    struct Config {
        uint16 minBps;
    }

    /// @notice Cash would fall under the reserve.
    error UnderCashReserve();

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));
        if (
            valuation.cashAfter < valuation.cashBefore
                && valuation.cashAfter * TradeMath.BPS < limits.minBps * valuation.totalAfter
        ) {
            revert UnderCashReserve();
        }
    }
}
