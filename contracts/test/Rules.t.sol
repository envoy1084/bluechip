// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {Outcome} from "../src/lib/Outcome.sol";
import {FairPriceRule} from "../src/rules/FairPriceRule.sol";
import {RebalanceRule} from "../src/rules/RebalanceRule.sol";
import {TradeSizeRule} from "../src/rules/TradeSizeRule.sol";
import {GuardInput, GuardPipeline} from "./utils/GuardInput.sol";

/// @dev A balanced Stock picker ($100 a trade, 30% in one stock, 10% cash, 1% collar, 1% a week) holding $1,000 of
/// cash, 5 NVDA at $100 and 2.5 AAPL at $200: $2,000 in all. Prices a minute old.
contract RulesTest is Test {
    GuardPipeline internal rules = new GuardPipeline();

    address internal constant NVDA = address(0xA1);
    address internal constant AAPL = address(0xA2);
    address internal constant TSLA = address(0xA3);
    uint256 internal constant NOW = 1_800_000_000;

    function base() internal pure returns (GuardInput.Input memory input) {
        input.settings = GuardInput.Settings({
            mode: GuardInput.BOTH,
            tradeWhilePaused: true,
            collarBps: 100,
            pausedCollarBps: 50,
            liveAge: 26 hours,
            pausedAge: 80 hours,
            minTradeUsd: 5e6,
            maxTradeUsd: 100e6,
            maxInOneStockBps: 3000,
            cashReserveBps: 1000,
            weeklySlippageBps: 100,
            slippageWindow: 7 days,
            bandBps: 100,
            overshootBps: 5,
            progressBps: 10,
            cashTargetBps: 0
        });
        input.cashBefore = 1000e6;
        input.cashAfter = 1000e6;
        input.stocks = new GuardInput.Stock[](3);
        input.stocks[0] = GuardInput.Stock(NVDA, true, 0, 5e8, 5e8, 100e8, NOW - 60);
        input.stocks[1] = GuardInput.Stock(AAPL, true, 0, 2.5e8, 2.5e8, 200e8, NOW - 60);
        input.stocks[2] = GuardInput.Stock(TSLA, false, 0, 0, 0, 0, 0);
        input.time = NOW;
    }

    /// @dev `input` after buying `shares` of NVDA for `usdc`.
    function buyNvda(GuardInput.Input memory input, uint256 usdc, uint256 shares)
        internal
        pure
        returns (GuardInput.Input memory)
    {
        input.cashAfter = input.cashBefore - usdc;
        input.stocks[0].balanceAfter = input.stocks[0].balanceBefore + shares;
        return input;
    }

    function test_aFairBuyOnTheCapPasses() public view {
        (bool traded, uint256 used) = rules.check(buyNvda(base(), 100e6, 1e8));

        assertTrue(traded);
        assertEq(used, 0);
    }

    function test_anOperationThatMovesNoStockChangesNothing() public view {
        GuardInput.Input memory input = base();
        input.slippageUsed = 7e6;

        (bool traded, uint256 used) = rules.check(input);

        assertFalse(traded);
        assertEq(used, 7e6);
    }

    function test_aStockBoughtWithoutPayingCash() public {
        GuardInput.Input memory input = base();
        input.stocks[0].balanceAfter = 6e8;

        vm.expectRevert(Outcome.NoCashSide.selector);
        rules.check(input);
    }

    function test_aStockSoldWithoutReceivingCash() public {
        GuardInput.Input memory input = base();
        input.stocks[0].balanceAfter = 4e8;
        input.cashAfter = 999e6;

        vm.expectRevert(Outcome.NoCashSide.selector);
        rules.check(input);
    }

    function test_aStalePriceOnAStockNotHeldIsIgnored() public view {
        GuardInput.Input memory input = buyNvda(base(), 100e6, 1e8);
        input.stocks[2].updatedAt = 1;

        (bool traded,) = rules.check(input);

        assertTrue(traded);
    }

    function test_aMissingPriceOnAStockHeld() public {
        GuardInput.Input memory input = buyNvda(base(), 100e6, 1e8);
        input.stocks[1].price = 0;

        vm.expectRevert(abi.encodeWithSelector(Outcome.PricesStale.selector, AAPL));
        rules.check(input);
    }

    function test_aPriceFromTheFutureCountsAsFresh() public view {
        GuardInput.Input memory input = buyNvda(base(), 100e6, 1e8);
        input.stocks[0].updatedAt = NOW + 5;

        (bool traded,) = rules.check(input);

        assertTrue(traded);
    }

    function test_twoBuysOfOneStockAreOneTradeInSize() public {
        // $200 of NVDA in one operation passes a $100 limit per trade, even if paid in two swaps.
        GuardInput.Input memory input = base();
        input.settings.maxInOneStockBps = 5000;

        vm.expectRevert(abi.encodeWithSelector(TradeSizeRule.OverTradeSize.selector, NVDA));
        rules.check(buyNvda(input, 200e6, 2e8));
    }

    function test_theCollarWeighsTheWholeOperation() public view {
        // Selling $100 of AAPL and buying $100 of NVDA, losing $2: 1% of the $200 traded.
        GuardInput.Input memory input = base();
        input.settings.maxInOneStockBps = 5000;
        input.stocks[0].balanceAfter = 6e8;
        input.stocks[1].balanceAfter = 2e8;
        input.cashAfter = 998e6;

        (bool traded, uint256 used) = rules.check(input);

        assertTrue(traded);
        assertEq(used, 2e6);
    }

    function test_aLossJustOverTheWholeOperationsCollar() public {
        GuardInput.Input memory input = base();
        input.settings.maxInOneStockBps = 5000;
        input.stocks[0].balanceAfter = 6e8;
        input.stocks[1].balanceAfter = 2e8;
        input.cashAfter = 998e6 - 1;

        vm.expectRevert(FairPriceRule.UnfairPrice.selector);
        rules.check(input);
    }

    function test_theLedgerAddsTheLossToWhatIsLeftAfterDecay() public view {
        // $10 lost three and a half days ago is $5 now; this buy loses $1.
        GuardInput.Input memory input = buyNvda(base(), 100e6, 0.99e8);
        input.slippageUsed = 10e6;
        input.slippageUpdatedAt = NOW - 3.5 days;

        (, uint256 used) = rules.check(input);

        assertEq(used, 6e6);
    }

    function test_aCashTargetCountsInTheRebalanceRules() public {
        // A Rebalancer targeting 30% NVDA, 30% AAPL, 40% cash, already at 25/25/50: buying NVDA to 30% is fine, but
        // past it by more than 5 basis points of the portfolio overshoots.
        GuardInput.Input memory input = base();
        input.settings.mode = GuardInput.REBALANCE;
        input.settings.tradeWhilePaused = false;
        input.settings.maxTradeUsd = 200e6;
        input.settings.maxInOneStockBps = 4000;
        input.settings.cashTargetBps = 4000;
        input.stocks[0].targetBps = 3000;
        input.stocks[1].targetBps = 3000;

        vm.expectRevert(abi.encodeWithSelector(RebalanceRule.Overshoots.selector, NVDA));
        rules.check(buyNvda(input, 110e6, 1.1e8));
    }
}
