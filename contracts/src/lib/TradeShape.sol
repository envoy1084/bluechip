// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

/// @notice What an agent's operation may look like: pairs of an exact `approve` to Aerodrome's router and the
/// `exactInputSingle` swap it pays for, between USDC and one of the agent's stocks, back to the account.
/// @dev Pure, so its cases run without a chain; `AerodromeTradePolicy` calls it during ERC-4337 validation.
library TradeShape {
    uint8 internal constant BUY = 0;
    uint8 internal constant SELL = 1;

    bytes4 internal constant APPROVE = 0x095ea7b3;
    /// @dev `exactInputSingle((address,address,int24,address,uint256,uint256,uint256,uint160))`.
    bytes4 internal constant EXACT_INPUT_SINGLE = 0xa026383e;

    /// @notice A stock the agent may trade, and its pool's tick spacing.
    struct Market {
        address token;
        int24 tickSpacing;
    }

    /// @notice The agent's validation settings, as `policyConfig` sets them.
    struct Settings {
        uint8 mode;
        uint128 maxUsdcIn;
        uint128 dailyBudget;
        Market[] markets;
    }

    /// @notice Slipstream's `ExactInputSingleParams`.
    struct Swap {
        address tokenIn;
        address tokenOut;
        int24 tickSpacing;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Whether `calls`, made by `account`, are approve-then-swap pairs the agent may make, and the USDC its
    /// buys spend.
    function check(
        Settings memory settings,
        UserOpCalls.Call[] memory calls,
        address account,
        address usdc,
        address router
    ) internal pure returns (bool ok, uint256 buys) {
        if (calls.length == 0 || calls.length % 2 != 0) return (false, 0);

        for (uint256 i; i < calls.length; i += 2) {
            (bool pairOk, uint256 bought) = _checkPair(settings, calls[i], calls[i + 1], account, usdc, router);
            if (!pairOk) return (false, 0);
            buys += bought;
        }
        return (true, buys);
    }

    function _checkPair(
        Settings memory settings,
        UserOpCalls.Call memory approval,
        UserOpCalls.Call memory swapCall,
        address account,
        address usdc,
        address router
    ) private pure returns (bool, uint256) {
        if (approval.value != 0 || swapCall.value != 0) return (false, 0);
        if (approval.data.length != 68 || _selector(approval.data) != APPROVE) return (false, 0);
        if (swapCall.target != router || swapCall.data.length != 260) return (false, 0);
        if (_selector(swapCall.data) != EXACT_INPUT_SINGLE) return (false, 0);

        (address spender, uint256 approved) = abi.decode(_arguments(approval.data), (address, uint256));
        Swap memory swap = abi.decode(_arguments(swapCall.data), (Swap));
        if (spender != router || approval.target != swap.tokenIn || approved != swap.amountIn) return (false, 0);
        if (swap.amountIn == 0 || swap.amountOutMinimum == 0 || swap.sqrtPriceLimitX96 != 0) return (false, 0);
        if (swap.recipient != account) return (false, 0);

        bool buying = swap.tokenIn == usdc;
        if (!buying && swap.tokenOut != usdc) return (false, 0);
        if (!_trades(settings.markets, buying ? swap.tokenOut : swap.tokenIn, swap.tickSpacing)) return (false, 0);
        if ((settings.mode == BUY && !buying) || (settings.mode == SELL && buying)) return (false, 0);
        if (buying && swap.amountIn > settings.maxUsdcIn) return (false, 0);

        return (true, buying ? swap.amountIn : 0);
    }

    /// @dev Whether `token` is one of the agent's stocks, through its own pool.
    function _trades(Market[] memory markets, address token, int24 tickSpacing) private pure returns (bool) {
        for (uint256 i; i < markets.length; ++i) {
            if (markets[i].token == token) return markets[i].tickSpacing == tickSpacing;
        }
        return false;
    }

    function _selector(bytes memory data) private pure returns (bytes4 selector) {
        assembly ("memory-safe") {
            selector := mload(add(data, 0x20))
        }
    }

    /// @dev `data` without its 4-byte selector.
    function _arguments(bytes memory data) private pure returns (bytes memory arguments) {
        uint256 length = data.length - 4;
        arguments = new bytes(length);
        assembly ("memory-safe") {
            mcopy(add(arguments, 0x20), add(data, 0x24), length)
        }
    }
}
