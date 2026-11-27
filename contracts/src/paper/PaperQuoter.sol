// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {PaperPool} from "./PaperPool.sol";

/// @title PaperQuoter
/// @notice Quotes a paper pool's swap exactly as it would fill, called like Aerodrome's MetaQuoter
/// (`quoteExactInputSingleV3`).
contract PaperQuoter {
    /// @notice Paper pools have no price curve to stop on.
    error Unsupported();

    /// @notice What `amountIn` of `tokenIn` buys in `pool` now, the pool's price (paper fills don't move it) and no
    /// ticks crossed.
    function quoteExactInputSingleV3(address pool, address tokenIn, uint256 amountIn, uint160 sqrtPriceLimitX96)
        external
        view
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed)
    {
        if (sqrtPriceLimitX96 != 0) revert Unsupported();
        amountOut = PaperPool(pool).quote(tokenIn, amountIn);
        // forge-lint: disable-next-line(unused-return)
        (sqrtPriceX96After,,,,,) = PaperPool(pool).slot0();
        return (amountOut, sqrtPriceX96After, 0);
    }
}
