// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Holding, Valuation} from "../rules/IOutcomeRule.sol";
import {TradeMath} from "./TradeMath.sol";

/// @notice What `TradeGuard` checks itself before its rules: which stocks moved (each allowed, in the agent's
/// direction, paid for in USDC) and the portfolio's value before and after at Chainlink's prices, checking each price
/// it uses. Moves are measured from balances, never read from calldata, and value at Chainlink's price, never a pool's.
/// @dev Pure, so the shared vectors and fuzz tests run through it without a chain.
library Outcome {
    using TradeMath for uint256;

    uint8 internal constant BUY = 0;
    uint8 internal constant SELL = 1;
    uint8 internal constant BOTH = 2;
    uint8 internal constant REBALANCE = 3;

    /// @notice A stock was traded that the agent may not trade.
    error NotAllowedStock(address token);
    /// @notice A stock moved against the agent's direction (bought by a sell-only agent, or sold by a buy-only one).
    error WrongDirection(address token);
    /// @notice A single stock moved without USDC moving the other way.
    error NoCashSide();
    /// @notice A stock's price is missing or older than a weekend: nothing trades or is valued on it.
    error PricesStale(address token);
    /// @notice A stock traded while its price is paused, and the agent doesn't trade then.
    error PausedTradingOff(address token);

    /// @notice How old a price may be: live, and paused (weekends and holidays), and whether the agent trades on a
    /// paused price.
    struct Prices {
        bool tradeWhilePaused;
        uint32 liveAge;
        uint32 pausedAge;
    }

    /// @notice One stock the portfolio is valued over: whether the agent may trade it, the account's balance before and
    /// after, and its feed's answer and update time (read only for stocks held before or after).
    struct Stock {
        address token;
        bool allowed;
        uint256 before;
        uint256 afterward;
        int256 price;
        uint256 updatedAt;
    }

    /// @notice Everything the check needs: the agent's direction, its price ages, cash and stocks, and the time.
    struct Input {
        uint8 mode;
        Prices prices;
        uint256 cashBefore;
        uint256 cashAfter;
        Stock[] stocks;
        uint256 time;
    }

    /// @notice Checks the moves and values the portfolio, reverting with the first problem; `moved` is false (and the
    /// valuation empty) when no stock moved, so the rules have nothing to check.
    function value(Input memory input) internal pure returns (bool moved, Valuation memory valuation) {
        if (_checkMoves(input) == 0) return (false, valuation);

        valuation.cashBefore = input.cashBefore;
        valuation.cashAfter = input.cashAfter;
        valuation.holdings = new Holding[](_held(input.stocks));
        valuation.totalBefore = input.cashBefore;
        valuation.totalAfter = input.cashAfter;
        valuation.time = input.time;
        uint256 stocksTraded = 0;
        uint256 held = 0;

        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.before == 0 && stock.afterward == 0) continue;

            if (stock.price <= 0) revert PricesStale(stock.token);
            uint256 age = input.time > stock.updatedAt ? input.time - stock.updatedAt : 0;
            if (age > input.prices.pausedAge) revert PricesStale(stock.token);

            // forge-lint: disable-next-line(unsafe-typecast)
            Holding memory holding = Holding(i, stock.token, stock.before, stock.afterward, uint256(stock.price));
            valuation.holdings[held++] = holding;
            valuation.totalBefore += stock.before.valueOf(holding.price);
            valuation.totalAfter += stock.afterward.valueOf(holding.price);
            if (stock.afterward == stock.before) continue;

            if (age > input.prices.liveAge) {
                if (!input.prices.tradeWhilePaused) revert PausedTradingOff(stock.token);
                valuation.paused = true;
            }
            stocksTraded += amountMoved(holding).valueOf(holding.price);
        }

        valuation.lost = valuation.totalBefore > valuation.totalAfter ? valuation.totalBefore - valuation.totalAfter : 0;
        uint256 cashMoved = input.cashAfter > input.cashBefore
            ? input.cashAfter - input.cashBefore
            : input.cashBefore - input.cashAfter;
        valuation.traded = cashMoved > stocksTraded ? cashMoved : stocksTraded;
        return (true, valuation);
    }

    /// @notice How much of a holding moved, either way.
    function amountMoved(Holding memory holding) internal pure returns (uint256) {
        return
            holding.afterward > holding.before ? holding.afterward - holding.before : holding.before - holding.afterward;
    }

    function _held(Stock[] memory stocks) private pure returns (uint256 count) {
        for (uint256 i; i < stocks.length; ++i) {
            if (stocks[i].before != 0 || stocks[i].afterward != 0) ++count;
        }
    }

    /// @dev Which stocks moved, that each is allowed and goes the agent's way, and that USDC paid for a single one.
    function _checkMoves(Input memory input) private pure returns (uint256 moved) {
        bool grewAlone = false;

        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.afterward == stock.before) continue;

            ++moved;
            bool grew = stock.afterward > stock.before;
            if (!stock.allowed) revert NotAllowedStock(stock.token);
            if ((input.mode == BUY && !grew) || (input.mode == SELL && grew)) revert WrongDirection(stock.token);
            grewAlone = grew;
        }

        if (moved != 1) return moved;
        bool cashPaid = input.cashAfter < input.cashBefore;
        bool cashReceived = input.cashAfter > input.cashBefore;
        if (grewAlone ? !cashPaid : !cashReceived) revert NoCashSide();
    }
}
