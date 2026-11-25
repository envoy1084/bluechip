// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {TradeMath} from "./TradeMath.sol";

/// @notice TradeGuard's rules as a pure function of what an operation did: the account's balances before and after,
/// each stock's Chainlink price and age, and the agent's slippage ledger. It reverts with the first rule broken, in
/// the order bluechip's offchain `evaluate` reports them (`packages/domain/src/agents/Evaluate.ts`).
/// @dev Pure, so the shared vectors run through it without a chain. Moves are measured from balances, never read
/// from calldata, and value at Chainlink's price, never a pool's.
library GuardRules {
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
    /// @notice A trade worth less than the smallest trade.
    error TooSmall(address token);
    /// @notice A trade worth more than the agent may trade at once.
    error OverTradeSize(address token);
    /// @notice The operation lost more against Chainlink's prices than the collar allows.
    error UnfairPrice();
    /// @notice A stock the operation bought would pass the most the portfolio may hold of one stock.
    error OverStockCap(address token);
    /// @notice Cash would fall under the reserve.
    error UnderCashReserve();
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
    /// @notice The agent's losses to prices over its window passed its budget.
    error OverSlippageBudget();

    /// @notice What the agent may do, as `policyConfig` (`packages/domain/src/agents/PolicyConfig.ts`) sets it.
    struct Settings {
        uint8 mode;
        bool tradeWhilePaused;
        uint16 collarBps;
        uint16 pausedCollarBps;
        uint32 liveAge;
        uint32 pausedAge;
        uint128 minTradeUsd;
        uint128 maxTradeUsd;
        uint16 maxInOneStockBps;
        uint16 cashReserveBps;
        uint16 weeklySlippageBps;
        uint32 slippageWindow;
        uint16 bandBps;
        uint16 overshootBps;
        uint16 progressBps;
        uint16 cashTargetBps;
    }

    /// @notice One stock: whether the agent may trade it, its target (Rebalancer), the account's balance before and
    /// after the operation, and its feed's answer and update time (read only for stocks held or moved).
    struct Stock {
        address token;
        bool allowed;
        uint16 targetBps;
        uint256 balanceBefore;
        uint256 balanceAfter;
        int256 price;
        uint256 updatedAt;
    }

    /// @notice Everything a decision needs.
    struct Input {
        Settings settings;
        uint256 cashBefore;
        uint256 cashAfter;
        Stock[] stocks;
        uint256 slippageUsed;
        uint256 slippageUpdatedAt;
        uint256 time;
    }

    /// @dev What the valuation of the portfolio before and after gives the later rules.
    struct Valuation {
        uint256 before;
        uint256 afterward;
        uint256 lost;
        uint256 traded;
        bool paused;
    }

    /// @notice Checks an operation, reverting with the first broken rule. Returns whether a stock moved, and the
    /// slippage ledger's new loss (to store with `time`).
    function check(Input memory input) internal pure returns (bool traded, uint256 slippageUsed) {
        Settings memory settings = input.settings;
        uint256 moved = _checkMoves(input);
        if (moved == 0) return (false, input.slippageUsed);

        Valuation memory valuation = _value(input);
        _checkSizes(input);

        uint256 collar = valuation.paused ? settings.pausedCollarBps : settings.collarBps;
        if (valuation.lost * TradeMath.BPS > collar * valuation.traded) revert UnfairPrice();

        _checkPortfolio(input, valuation.afterward);
        if (settings.mode == REBALANCE) _checkRebalance(input, valuation, collar);

        uint256 used = TradeMath.decayed(
            input.slippageUsed, input.slippageUpdatedAt, input.time, settings.slippageWindow
        );
        uint256 budget = settings.weeklySlippageBps * valuation.before / TradeMath.BPS;
        if (used + valuation.lost > budget) revert OverSlippageBudget();
        return (true, used + valuation.lost);
    }

    /// @dev Which stocks moved, that each is allowed and goes the agent's way, and that USDC paid for a single one.
    function _checkMoves(Input memory input) private pure returns (uint256 moved) {
        uint8 mode = input.settings.mode;
        bool grewAlone;

        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.balanceAfter == stock.balanceBefore) continue;

            ++moved;
            bool grew = stock.balanceAfter > stock.balanceBefore;
            if (!stock.allowed) revert NotAllowedStock(stock.token);
            if ((mode == BUY && !grew) || (mode == SELL && grew)) revert WrongDirection(stock.token);
            grewAlone = grew;
        }

        if (moved != 1) return moved;
        bool cashPaid = input.cashAfter < input.cashBefore;
        bool cashReceived = input.cashAfter > input.cashBefore;
        if (grewAlone ? !cashPaid : !cashReceived) revert NoCashSide();
    }

    /// @dev The portfolio before and after at Chainlink's prices, checking every price it uses: what was lost, what
    /// was traded (the larger of the cash moved and the stocks moved), and whether a traded price is paused.
    function _value(Input memory input) private pure returns (Valuation memory valuation) {
        Settings memory settings = input.settings;
        valuation.before = input.cashBefore;
        valuation.afterward = input.cashAfter;
        uint256 stocksTraded;

        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.balanceBefore == 0 && stock.balanceAfter == 0) continue;

            if (stock.price <= 0) revert PricesStale(stock.token);
            uint256 age = input.time > stock.updatedAt ? input.time - stock.updatedAt : 0;
            if (age > settings.pausedAge) revert PricesStale(stock.token);

            uint256 price = uint256(stock.price);
            valuation.before += stock.balanceBefore.valueOf(price);
            valuation.afterward += stock.balanceAfter.valueOf(price);
            if (stock.balanceAfter == stock.balanceBefore) continue;

            if (age > settings.liveAge) {
                if (!settings.tradeWhilePaused || settings.mode == REBALANCE) revert PausedTradingOff(stock.token);
                valuation.paused = true;
            }
            stocksTraded += _moved(stock).valueOf(price);
        }

        valuation.lost = valuation.before > valuation.afterward ? valuation.before - valuation.afterward : 0;
        uint256 cashMoved = input.cashAfter > input.cashBefore
            ? input.cashAfter - input.cashBefore
            : input.cashBefore - input.cashAfter;
        valuation.traded = cashMoved > stocksTraded ? cashMoved : stocksTraded;
    }

    /// @dev Each traded stock's value is within the smallest and largest trade.
    function _checkSizes(Input memory input) private pure {
        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.balanceAfter == stock.balanceBefore) continue;

            uint256 value = _moved(stock).valueOf(uint256(stock.price));
            if (value < input.settings.minTradeUsd) revert TooSmall(stock.token);
            if (value > input.settings.maxTradeUsd) revert OverTradeSize(stock.token);
        }
    }

    /// @dev A stock the operation bought stays under the cap, and cash that fell stays over the reserve.
    function _checkPortfolio(Input memory input, uint256 total) private pure {
        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            if (stock.balanceAfter <= stock.balanceBefore) continue;

            uint256 value = stock.balanceAfter.valueOf(uint256(stock.price));
            if (!value.isAtMostBps(total, input.settings.maxInOneStockBps)) revert OverStockCap(stock.token);
        }

        if (input.cashAfter < input.cashBefore && input.cashAfter * TradeMath.BPS < input.settings.cashReserveBps * total)
        {
            revert UnderCashReserve();
        }
    }

    /// @dev Index Coop's rebalancing rules on the net moves (`packages/domain/src/agents/Rebalance.ts`).
    function _checkRebalance(Input memory input, Valuation memory valuation, uint256 collar) private pure {
        Settings memory settings = input.settings;
        uint256 count = input.stocks.length + 1;
        uint256[] memory before = new uint256[](count);
        uint256[] memory afterward = new uint256[](count);
        uint256[] memory targets = new uint256[](count);

        before[0] = input.cashBefore;
        afterward[0] = input.cashAfter;
        targets[0] = settings.cashTargetBps;
        for (uint256 i; i < input.stocks.length; ++i) {
            Stock memory stock = input.stocks[i];
            uint256 price = stock.price > 0 ? uint256(stock.price) : 0;
            before[i + 1] = stock.balanceBefore.valueOf(price);
            afterward[i + 1] = stock.balanceAfter.valueOf(price);
            targets[i + 1] = stock.targetBps;
        }

        uint256 driftBefore = TradeMath.drift(before, valuation.before, targets);
        if (driftBefore < settings.bandBps) revert NotNeeded();

        // Stocks first, then cash, which only counts as traded when it moved by more than the overshoot tolerance:
        // selling one stock to buy another passes through USDC and may leave a little behind.
        for (uint256 i = 1; i < count; ++i) {
            if (input.stocks[i - 1].balanceAfter == input.stocks[i - 1].balanceBefore) continue;
            _checkAsset(input.stocks[i - 1].token, before[i], afterward[i], targets[i], valuation, settings);
        }
        uint256 cashMove = input.cashAfter > input.cashBefore
            ? input.cashAfter - input.cashBefore
            : input.cashBefore - input.cashAfter;
        if (cashMove * TradeMath.BPS > settings.overshootBps * valuation.before) {
            _checkAsset(address(0), before[0], afterward[0], targets[0], valuation, settings);
        }

        uint256 driftAfter = TradeMath.drift(afterward, valuation.afterward, targets);
        if (driftAfter + settings.progressBps > driftBefore) revert NoProgress();

        if (valuation.afterward * TradeMath.BPS < valuation.before * (TradeMath.BPS - collar)) revert LosesValue();
    }

    /// @dev An asset a Rebalancer moved went toward its target, and not past it by more than the tolerance.
    function _checkAsset(
        address asset,
        uint256 valueBefore,
        uint256 valueAfter,
        uint256 target,
        Valuation memory valuation,
        Settings memory settings
    ) private pure {
        if (valueAfter == valueBefore) return;

        bool grew = valueAfter > valueBefore;
        uint256 weightBefore = valueBefore * TradeMath.BPS;
        bool underweight = weightBefore < target * valuation.before;
        bool overweight = weightBefore > target * valuation.before;
        if ((grew && !underweight) || (!grew && !overweight)) revert WrongWay(asset);

        uint256 tolerance = settings.overshootBps;
        uint256 weightAfter = valueAfter * TradeMath.BPS;
        if (grew && weightAfter > (target + tolerance) * valuation.afterward) revert Overshoots(asset);
        if (!grew && target >= tolerance && weightAfter < (target - tolerance) * valuation.afterward) {
            revert Overshoots(asset);
        }
    }

    function _moved(Stock memory stock) private pure returns (uint256) {
        return stock.balanceAfter > stock.balanceBefore
            ? stock.balanceAfter - stock.balanceBefore
            : stock.balanceBefore - stock.balanceAfter;
    }
}
