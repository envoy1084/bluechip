// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title RebalanceRule
/// @notice Index Coop's rebalancing rules on the net moves (`packages/domain/src/agents/Rebalance.ts`): trade only
/// when the portfolio has drifted past the band, move each asset toward its target and not past it, get closer to the
/// target mix, and lose no more than the collar.
contract RebalanceRule is IOutcomeRule {
    using TradeMath for uint256;

    /// @notice The target mix (cash, then one target per valued stock, in the guard's order) and the tolerances, all in
    /// basis points.
    struct Config {
        uint16 cashTargetBps;
        uint16[] targetBps;
        uint16 bandBps;
        uint16 overshootBps;
        uint16 progressBps;
        uint16 collarBps;
    }

    /// @notice A Rebalancer traded while the portfolio is within its band.
    error NotNeeded();
    /// @notice A Rebalancer moved an asset away from its target (`address(0)` is cash).
    error WrongWay(address asset);
    /// @notice A Rebalancer pushed an asset past its target (`address(0)` is cash).
    error Overshoots(address asset);
    /// @notice A Rebalancer's trade didn't bring the portfolio closer to its target mix.
    error NoProgress();
    /// @notice A Rebalancer's trade cost the portfolio more than the collar.
    error LosesValue();
    /// @notice The configuration has fewer targets than the guard values stocks.
    error TargetsMismatch();

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32, address) external pure {
        Config memory limits = abi.decode(config, (Config));
        // Cash, then every valued stock: one the account never held is worth nothing either side.
        uint256 count = limits.targetBps.length + 1;
        uint256[] memory before = new uint256[](count);
        uint256[] memory afterward = new uint256[](count);
        uint256[] memory targets = new uint256[](count);
        before[0] = valuation.cashBefore;
        afterward[0] = valuation.cashAfter;
        targets[0] = limits.cashTargetBps;
        for (uint256 i; i < limits.targetBps.length; ++i) {
            targets[i + 1] = limits.targetBps[i];
        }
        for (uint256 i; i < valuation.holdings.length; ++i) {
            uint256 index = valuation.holdings[i].index;
            if (index >= limits.targetBps.length) revert TargetsMismatch();
            before[index + 1] = valuation.holdings[i].before.valueOf(valuation.holdings[i].price);
            afterward[index + 1] = valuation.holdings[i].afterward.valueOf(valuation.holdings[i].price);
        }

        uint256 driftBefore = TradeMath.drift(before, valuation.totalBefore, targets);
        if (driftBefore < limits.bandBps) revert NotNeeded();

        // Stocks first, then cash, which only counts as traded when it moved by more than the overshoot tolerance:
        // selling one stock to buy another passes through USDC and may leave a little behind.
        for (uint256 i; i < valuation.holdings.length; ++i) {
            if (valuation.holdings[i].afterward == valuation.holdings[i].before) continue;
            uint256 index = valuation.holdings[i].index + 1;
            _checkAsset(valuation.holdings[i].token, before[index], afterward[index], targets[index], valuation, limits);
        }
        uint256 cashMove = valuation.cashAfter > valuation.cashBefore
            ? valuation.cashAfter - valuation.cashBefore
            : valuation.cashBefore - valuation.cashAfter;
        if (cashMove * TradeMath.BPS > limits.overshootBps * valuation.totalBefore) {
            _checkAsset(address(0), before[0], afterward[0], targets[0], valuation, limits);
        }

        uint256 driftAfter = TradeMath.drift(afterward, valuation.totalAfter, targets);
        if (driftAfter + limits.progressBps > driftBefore) revert NoProgress();

        if (valuation.totalAfter * TradeMath.BPS < valuation.totalBefore * (TradeMath.BPS - limits.collarBps)) {
            revert LosesValue();
        }
    }

    /// @dev An asset a Rebalancer moved went toward its target, and not past it by more than the tolerance.
    function _checkAsset(
        address asset,
        uint256 valueBefore,
        uint256 valueAfter,
        uint256 target,
        Valuation calldata valuation,
        Config memory limits
    ) private pure {
        if (valueAfter == valueBefore) return;

        bool grew = valueAfter > valueBefore;
        uint256 weightBefore = valueBefore * TradeMath.BPS;
        bool underweight = weightBefore < target * valuation.totalBefore;
        bool overweight = weightBefore > target * valuation.totalBefore;
        if ((grew && !underweight) || (!grew && !overweight)) revert WrongWay(asset);

        uint256 tolerance = limits.overshootBps;
        uint256 weightAfter = valueAfter * TradeMath.BPS;
        if (grew && weightAfter > (target + tolerance) * valuation.totalAfter) revert Overshoots(asset);
        if (!grew && target >= tolerance && weightAfter < (target - tolerance) * valuation.totalAfter) {
            revert Overshoots(asset);
        }
    }
}
