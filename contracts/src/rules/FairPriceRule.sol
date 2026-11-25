// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title FairPriceRule
/// @notice The whole operation loses at most the collar of what it traded, against Chainlink's prices: a tighter
/// collar while a traded price is paused (weekends and holidays).
contract FairPriceRule is IOutcomeRule {
    /// @notice The collar in basis points, live and paused.
    struct Config {
        uint16 collarBps;
        uint16 pausedCollarBps;
    }

    /// @notice The operation lost more against Chainlink's prices than the collar allows.
    error UnfairPrice();

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));
        uint256 collar = valuation.paused ? limits.pausedCollarBps : limits.collarBps;
        if (valuation.lost * TradeMath.BPS > collar * valuation.traded) revert UnfairPrice();
    }
}
