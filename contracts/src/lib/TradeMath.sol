// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice The integer math behind an agent's rules, the same as bluechip's TypeScript
/// (`packages/domain/src/agents/TradeMath.ts`): values at Chainlink's price rounded down, weights and drift in basis
/// points from exact values, and a slippage ledger that decays over its window, rounded up.
/// @dev USDC has 6 decimals, stock tokens 8, Chainlink's stock feeds 8 (USD per token, total return).
library TradeMath {
    uint256 internal constant BPS = 10_000;

    /// @dev shares (1e8) × price (1e8) = USD × 1e16; USDC has 1e6.
    uint256 internal constant SHARE_PRICE_TO_USDC = 1e10;

    /// @dev What `shares` are worth at `price`, in USDC units, rounded down.
    function valueOf(uint256 shares, uint256 price) internal pure returns (uint256) {
        return shares * price / SHARE_PRICE_TO_USDC;
    }

    /// @dev Whether `value` is at most `bps` of `total`, exactly.
    function isAtMostBps(uint256 value, uint256 total, uint256 bps) internal pure returns (bool) {
        return value * BPS <= bps * total;
    }

    /// @dev How far `values` (summing to `total`) are from `targets`, in basis points, rounded down:
    /// `½ Σ |valueᵢ × 10,000 − targetᵢ × total| / total`.
    function drift(uint256[] memory values, uint256 total, uint256[] memory targets) internal pure returns (uint256) {
        if (total == 0) return 0;

        uint256 distance = 0;
        for (uint256 i; i < values.length; ++i) {
            uint256 have = values[i] * BPS;
            uint256 want = targets[i] * total;
            distance += have > want ? have - want : want - have;
        }
        return distance / (2 * total);
    }

    /// @dev A ledger's loss at `time`: it decays linearly to nothing over `window` seconds, rounded up so the budget
    /// never frees up early.
    function decayed(uint256 used, uint256 updatedAt, uint256 time, uint256 window) internal pure returns (uint256) {
        uint256 elapsed = time > updatedAt ? time - updatedAt : 0;
        if (elapsed >= window) return 0;
        return (used * (window - elapsed) + window - 1) / window;
    }
}
