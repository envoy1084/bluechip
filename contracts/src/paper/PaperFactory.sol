// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Ownable} from "solady/auth/Ownable.sol";

import {PaperPool} from "./PaperPool.sol";

/// @title PaperFactory
/// @notice Paper's stock pools against Test USDC, found like Slipstream's (`getPool(tokenA, tokenB, tickSpacing)`).
/// Its owner (bluechip's operator) creates them.
contract PaperFactory is Ownable {
    address public immutable USDC;

    /// @notice The pool of two tokens at a tick spacing, in either order; zero when there is none.
    mapping(address tokenA => mapping(address tokenB => mapping(int24 tickSpacing => address pool))) public getPool;

    /// @notice Slipstream's `PoolCreated`.
    event PoolCreated(address indexed token0, address indexed token1, int24 indexed tickSpacing, address pool);

    /// @notice There already is a pool of the stock at that tick spacing.
    error PoolExists();
    /// @notice A stock, feed and fee under 100% are required.
    error InvalidPool();

    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address owner_, address usdc) {
        _initializeOwner(owner_);
        USDC = usdc;
    }

    /// @notice Creates `stock`'s pool against USDC at `tickSpacing`, priced from `feed` and keeping `fee` pips.
    function createPool(address stock, address feed, int24 tickSpacing, uint24 fee)
        external
        onlyOwner
        returns (address pool)
    {
        if (stock == address(0) || stock == USDC || feed == address(0) || fee >= 1_000_000) {
            revert InvalidPool();
        }
        if (getPool[USDC][stock][tickSpacing] != address(0)) revert PoolExists();

        pool = address(new PaperPool(USDC, stock, feed, tickSpacing, fee));
        getPool[USDC][stock][tickSpacing] = pool;
        getPool[stock][USDC][tickSpacing] = pool;
        (address token0, address token1) = USDC < stock ? (USDC, stock) : (stock, USDC);
        // forge-lint: disable-next-line(reentrancy-events)
        emit PoolCreated(token0, token1, tickSpacing, pool);
    }
}
