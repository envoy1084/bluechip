// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "../lib/TradeMath.sol";
import {IOutcomeRule, Valuation} from "./IOutcomeRule.sol";

/// @title SlippageBudgetRule
/// @notice What the agent loses to prices, decaying over its window, stays within its budget's share of the
/// portfolio. Each loss is recorded in a ledger per guard, session and account.
contract SlippageBudgetRule is IOutcomeRule {
    /// @notice The budget's share of the portfolio in basis points, and the window it decays over, in seconds.
    struct Config {
        uint16 budgetBps;
        uint32 window;
    }

    /// @notice The agent's losses to prices over its window passed its budget.
    error OverSlippageBudget();

    /// @dev The loss (low 128 bits) and when it was written, per calling guard, session and account.
    mapping(address guard => mapping(bytes32 key => mapping(address account => uint256 ledger))) internal $ledgers;

    /// @inheritdoc IOutcomeRule
    function check(Valuation calldata valuation, bytes calldata config, bytes32 key, address account) external {
        Config memory limits = abi.decode(config, (Config));
        uint256 word = $ledgers[msg.sender][key][account];
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 used = charge(uint128(word), word >> 128, valuation, limits);
        $ledgers[msg.sender][key][account] = (valuation.time << 128) | used;
    }

    /// @notice What `account` has lost to prices under `guard`'s session `key`, as of when it was last written.
    function ledger(address guard, bytes32 key, address account)
        external
        view
        returns (uint256 used, uint256 updatedAt)
    {
        uint256 word = $ledgers[guard][key][account];
        // The low 128 bits are the loss.
        // forge-lint: disable-next-line(unsafe-typecast)
        return (uint128(word), word >> 128);
    }

    /// @notice The ledger's loss after this operation, reverting past the budget.
    function charge(uint256 used, uint256 updatedAt, Valuation calldata valuation, Config memory limits)
        public
        pure
        returns (uint256)
    {
        uint256 decayed = TradeMath.decayed(used, updatedAt, valuation.time, limits.window);
        uint256 budget = limits.budgetBps * valuation.totalBefore / TradeMath.BPS;
        if (decayed + valuation.lost > budget) revert OverSlippageBudget();
        return decayed + valuation.lost;
    }
}
