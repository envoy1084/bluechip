// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

import {PaperFactory} from "./PaperFactory.sol";
import {PaperPool} from "./PaperPool.sol";

/// @title PaperRouter
/// @notice Paper's swap router, called exactly like Slipstream's `exactInputSingle`: it pulls the input from the
/// caller into the pool, the pool pays the recipient, and it reverts with Slipstream's messages past the deadline or
/// under the minimum out.
contract PaperRouter {
    /// @notice Slipstream's `ExactInputSingleParams`.
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        int24 tickSpacing;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    address internal immutable FACTORY;

    /// @notice There is no pool of the two tokens at that tick spacing.
    error UnknownPool();
    /// @notice Paper pools have no price curve to stop on, and take no ETH.
    error Unsupported();

    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address factory_) {
        FACTORY = factory_;
    }

    function factory() external view returns (address) {
        return FACTORY;
    }

    /// @notice Swaps `amountIn` of `tokenIn` for at least `amountOutMinimum` of `tokenOut`, paid to `recipient`.
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        // Slipstream's own revert strings, so a failed paper trade reads as a failed Base trade.
        // forge-lint: disable-next-line(block-timestamp)
        require(block.timestamp <= params.deadline, "Transaction too old");
        if (msg.value != 0 || params.sqrtPriceLimitX96 != 0) revert Unsupported();

        address pool = PaperFactory(FACTORY).getPool(params.tokenIn, params.tokenOut, params.tickSpacing);
        if (pool == address(0)) revert UnknownPool();

        SafeTransferLib.safeTransferFrom(params.tokenIn, msg.sender, pool, params.amountIn);
        amountOut = PaperPool(pool).swap(params.recipient, params.tokenIn);
        require(amountOut >= params.amountOutMinimum, "Too little received");
    }
}
