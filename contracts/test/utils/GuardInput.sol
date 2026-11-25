// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Outcome} from "../../src/lib/Outcome.sol";
import {CashReserveRule} from "../../src/rules/CashReserveRule.sol";
import {FairPriceRule} from "../../src/rules/FairPriceRule.sol";
import {Valuation} from "../../src/rules/IOutcomeRule.sol";
import {RebalanceRule} from "../../src/rules/RebalanceRule.sol";
import {SlippageBudgetRule} from "../../src/rules/SlippageBudgetRule.sol";
import {StockCapRule} from "../../src/rules/StockCapRule.sol";
import {TradeSizeRule} from "../../src/rules/TradeSizeRule.sol";

/// @notice One operation as the rule tests and the shared vectors (`test/vectors.json`) describe it: every setting of
/// every rule, the account's cash and stocks before and after, and its slippage ledger.
library GuardInput {
    uint8 internal constant BUY = 0;
    uint8 internal constant SELL = 1;
    uint8 internal constant BOTH = 2;
    uint8 internal constant REBALANCE = 3;

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

    struct Stock {
        address token;
        bool allowed;
        uint16 targetBps;
        uint256 balanceBefore;
        uint256 balanceAfter;
        int256 price;
        uint256 updatedAt;
    }

    struct Input {
        Settings settings;
        uint256 cashBefore;
        uint256 cashAfter;
        Stock[] stocks;
        uint256 slippageUsed;
        uint256 slippageUpdatedAt;
        uint256 time;
    }
}

/// @notice `TradeGuard`'s checks without a chain: `Outcome`, then every rule contract in the order a full session
/// runs them (trade size, fair price, stock cap, cash reserve, rebalance for a Rebalancer, slippage budget).
contract GuardPipeline {
    TradeSizeRule public immutable tradeSize = new TradeSizeRule();
    FairPriceRule public immutable fairPrice = new FairPriceRule();
    StockCapRule public immutable stockCap = new StockCapRule();
    CashReserveRule public immutable cashReserve = new CashReserveRule();
    RebalanceRule public immutable rebalance = new RebalanceRule();
    SlippageBudgetRule public immutable slippageBudget = new SlippageBudgetRule();

    /// @notice Whether a stock moved, and the slippage ledger's new loss; reverts with the first broken rule.
    function check(GuardInput.Input memory input) public view returns (bool traded, uint256 slippageUsed) {
        GuardInput.Settings memory s = input.settings;
        (bool moved, Valuation memory valuation) = Outcome.value(_outcome(input));
        if (!moved) return (false, input.slippageUsed);

        tradeSize.check(valuation, abi.encode(TradeSizeRule.Config(s.minTradeUsd, s.maxTradeUsd)), 0, address(0));
        fairPrice.check(valuation, abi.encode(FairPriceRule.Config(s.collarBps, s.pausedCollarBps)), 0, address(0));
        stockCap.check(valuation, abi.encode(StockCapRule.Config(s.maxInOneStockBps)), 0, address(0));
        cashReserve.check(valuation, abi.encode(CashReserveRule.Config(s.cashReserveBps)), 0, address(0));
        if (s.mode == GuardInput.REBALANCE) {
            rebalance.check(valuation, abi.encode(rebalanceConfig(input)), 0, address(0));
        }
        uint256 used = slippageBudget.charge(
            input.slippageUsed,
            input.slippageUpdatedAt,
            valuation,
            SlippageBudgetRule.Config(s.weeklySlippageBps, s.slippageWindow)
        );
        return (true, used);
    }

    function checkEncoded(bytes calldata input) external view returns (bool traded, uint256 slippageUsed) {
        return check(abi.decode(input, (GuardInput.Input)));
    }

    function rebalanceConfig(GuardInput.Input memory input) public pure returns (RebalanceRule.Config memory config) {
        GuardInput.Settings memory s = input.settings;
        config.cashTargetBps = s.cashTargetBps;
        config.targetBps = new uint16[](input.stocks.length);
        for (uint256 i; i < input.stocks.length; ++i) {
            config.targetBps[i] = input.stocks[i].targetBps;
        }
        config.bandBps = s.bandBps;
        config.overshootBps = s.overshootBps;
        config.progressBps = s.progressBps;
        config.collarBps = s.collarBps;
    }

    function _outcome(GuardInput.Input memory input) private pure returns (Outcome.Input memory outcome) {
        GuardInput.Settings memory s = input.settings;
        outcome.mode = s.mode;
        outcome.prices = Outcome.Prices(s.tradeWhilePaused, s.liveAge, s.pausedAge);
        outcome.cashBefore = input.cashBefore;
        outcome.cashAfter = input.cashAfter;
        outcome.time = input.time;
        outcome.stocks = new Outcome.Stock[](input.stocks.length);
        for (uint256 i; i < input.stocks.length; ++i) {
            GuardInput.Stock memory stock = input.stocks[i];
            outcome.stocks[i] = Outcome.Stock(
                stock.token, stock.allowed, stock.balanceBefore, stock.balanceAfter, stock.price, stock.updatedAt
            );
        }
    }
}
