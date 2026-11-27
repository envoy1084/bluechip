// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

import {MintableToken} from "./MintableToken.sol";

interface IPaperFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @title PaperPool
/// @notice A paper stock's market against Test USDC, read like an Aerodrome Slipstream pool (`fee`, `token0`,
/// `token1`, `tickSpacing`, `slot0`, `Swap`). It fills at the stock's paper feed less its fee and a size impact, from
/// its own inventory, minting to itself what it's short of, so every fill is a `Transfer` from the pool as on Base.
/// @dev Paid like a Uniswap V2 pair: the router transfers the input to the pool, then `swap` pays out against what
/// arrived beyond the pool's reserves.
contract PaperPool {
    /// @notice A fee's denominator: fees are in millionths (pips), as Slipstream's.
    uint256 public constant PIPS = 1_000_000;
    /// @notice The size impact: 2 basis points per $10,000 traded, at most 10%.
    uint256 public constant IMPACT_BPS_PER_10K_USD = 2;
    uint256 public constant MAX_IMPACT_BPS = 1000;
    /// @notice The oldest price it fills at: longer than any market close (a long weekend), as Base's pools trade
    /// through them.
    uint256 public constant MAX_PRICE_AGE = 5 days;

    /// @dev USDC (6 decimals) per stock token (8 decimals) at a feed answer (8 decimals): 10^(8 + 8 - 6).
    uint256 internal constant SCALE = 1e10;
    uint256 internal constant BPS = 10_000;
    /// @dev ln(1.0001) at 18 decimals: a tick's width.
    int256 internal constant LN_TICK = 99_995_000_333_308;

    address internal immutable FACTORY;
    address internal immutable USDC;
    address internal immutable STOCK;
    address internal immutable FEED;
    address internal immutable TOKEN0;
    address internal immutable TOKEN1;
    int24 internal immutable TICK_SPACING;
    uint24 internal immutable FEE;

    uint256 internal _reserveUsdc;
    uint256 internal _reserveStock;

    /// @notice Slipstream's `Swap`: the pool's deltas (positive in, negative out) and its price after.
    event Swap(
        address indexed sender,
        address indexed recipient,
        int256 amount0,
        int256 amount1,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick
    );

    /// @notice The token isn't one of the pool's two.
    error UnknownToken();
    /// @notice The feed's answer isn't above zero.
    error InvalidPrice();
    /// @notice The feed hasn't been written for longer than `MAX_PRICE_AGE`.
    error StalePrice();
    /// @notice Nothing arrived to swap, or it buys nothing.
    error NothingToSwap();

    // Created only by `PaperFactory`, which checks its arguments.
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address usdc, address stock, address feed_, int24 tickSpacing_, uint24 fee_) {
        FACTORY = msg.sender;
        USDC = usdc;
        STOCK = stock;
        FEED = feed_;
        (TOKEN0, TOKEN1) = usdc < stock ? (usdc, stock) : (stock, usdc);
        TICK_SPACING = tickSpacing_;
        FEE = fee_;
    }

    function factory() external view returns (address) {
        return FACTORY;
    }

    function token0() external view returns (address) {
        return TOKEN0;
    }

    function token1() external view returns (address) {
        return TOKEN1;
    }

    function tickSpacing() external view returns (int24) {
        return TICK_SPACING;
    }

    /// @notice The share of the input the pool keeps, in pips.
    function fee() external view returns (uint24) {
        return FEE;
    }

    /// @notice The paper feed it prices from.
    function feed() external view returns (address) {
        return FEED;
    }

    /// @notice Slipstream's `slot0`: the feed's price as a Q64.96 square root of token1 per token0, and its tick.
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            bool unlocked
        )
    {
        (sqrtPriceX96, tick) = _sqrtPriceAndTick(price());
        return (sqrtPriceX96, tick, 0, 1, 1, true);
    }

    /// @notice The stock's price in USDC per token, at the feed's 8 decimals; fails on a zero or stale answer.
    function price() public view returns (uint256) {
        // forge-lint: disable-next-line(unused-return)
        (, int256 answer,, uint256 updatedAt,) = IPaperFeed(FEED).latestRoundData();
        if (answer <= 0) revert InvalidPrice();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer);
    }

    /// @notice What `amountIn` of `tokenIn` buys now: at the feed's price, less the fee, less the size impact.
    function quote(address tokenIn, uint256 amountIn) public view returns (uint256 amountOut) {
        uint256 answer = price();
        uint256 gross;
        uint256 usd;
        if (tokenIn == USDC) {
            gross = amountIn * SCALE / answer;
            usd = amountIn;
        } else if (tokenIn == STOCK) {
            gross = amountIn * answer / SCALE;
            usd = gross;
        } else {
            revert UnknownToken();
        }

        // The impact is in whole basis points, by design.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 impact = FixedPointMathLib.min(usd * IMPACT_BPS_PER_10K_USD / 10_000e6, MAX_IMPACT_BPS);
        return FixedPointMathLib.fullMulDiv(gross, (PIPS - FEE) * (BPS - impact), PIPS * BPS);
    }

    /// @notice Swaps what arrived of `tokenIn` beyond the reserves for the other token, paid to `recipient`.
    function swap(address recipient, address tokenIn) external returns (uint256 amountOut) {
        if (tokenIn != USDC && tokenIn != STOCK) revert UnknownToken();
        bool buying = tokenIn == USDC;
        address tokenOut = buying ? STOCK : USDC;

        uint256 amountIn = SafeTransferLib.balanceOf(tokenIn, address(this)) - (buying ? _reserveUsdc : _reserveStock);
        if (amountIn == 0) revert NothingToSwap();
        amountOut = quote(tokenIn, amountIn);
        if (amountOut == 0) revert NothingToSwap();

        // Both tokens are paper's own ERC-20s, with no hooks to reenter through.
        uint256 held = SafeTransferLib.balanceOf(tokenOut, address(this));
        // forge-lint: disable-next-line(reentrancy-no-eth)
        if (held < amountOut) MintableToken(tokenOut).mint(address(this), amountOut - held);
        SafeTransferLib.safeTransfer(tokenOut, recipient, amountOut);

        _reserveUsdc = SafeTransferLib.balanceOf(USDC, address(this));
        _reserveStock = SafeTransferLib.balanceOf(STOCK, address(this));

        (uint160 sqrtPriceX96, int24 tick) = _sqrtPriceAndTick(price());
        // Amounts fit in int256: both tokens' supplies are far below 2^255.
        // forge-lint: disable-next-line(unsafe-typecast)
        (int256 delta0, int256 delta1) = (int256(amountIn), -int256(amountOut));
        if (tokenIn != TOKEN0) (delta0, delta1) = (delta1, delta0);
        // forge-lint: disable-next-line(reentrancy-events)
        emit Swap(msg.sender, recipient, delta0, delta1, sqrtPriceX96, 0, tick);
    }

    /// @dev Token1 per token0 in raw units: stock tokens per USDC unit is `SCALE / answer`, its inverse the other way.
    function _sqrtPriceAndTick(uint256 answer) internal view returns (uint160 sqrtPriceX96, int24 tick) {
        bool usdcFirst = TOKEN0 == USDC;
        // Under 2^160 for any answer from 10^-6 to 10^30 dollars.
        // forge-lint: disable-next-line(unsafe-typecast)
        sqrtPriceX96 = uint160(FixedPointMathLib.sqrt(usdcFirst ? (SCALE << 192) / answer : (answer << 192) / SCALE));

        // forge-lint: disable-next-line(unsafe-typecast)
        int256 ln = FixedPointMathLib.lnWad(int256(usdcFirst ? SCALE * 1e18 / answer : answer * 1e18 / SCALE));
        int256 ticks = ln / LN_TICK;
        // Rounded down, as Slipstream's ticks are; Solidity's division rounds toward zero.
        if (ln % LN_TICK < 0) --ticks;
        // Within Slipstream's ±887,272 ticks for any such answer.
        // forge-lint: disable-next-line(unsafe-typecast)
        tick = int24(ticks);
    }
}
