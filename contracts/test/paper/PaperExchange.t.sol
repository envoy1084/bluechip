// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Vm} from "forge-std/Vm.sol";
import {Ownable} from "solady/auth/Ownable.sol";

import {PaperFactory} from "../../src/paper/PaperFactory.sol";
import {PaperFeed} from "../../src/paper/PaperFeed.sol";
import {PaperPool} from "../../src/paper/PaperPool.sol";
import {PaperQuoter} from "../../src/paper/PaperQuoter.sol";
import {PaperRouter} from "../../src/paper/PaperRouter.sol";
import {TestStock} from "../../src/paper/TestStock.sol";
import {PaperMarket} from "./PaperMarket.sol";

/// @dev NVDA at $150 and AAPL at $200, a 0.03% fee and 2 basis points of impact per $10,000.
contract PaperExchangeTest is PaperMarket {
    bytes32 internal constant TRANSFER = keccak256("Transfer(address,address,uint256)");

    // Finding pools -------------------------------------------------------------------------------------------------

    function test_theFactoryFindsAPoolInEitherOrder() public view {
        assertEq(factory.getPool(address(usdc), address(nvda), TICK_SPACING), address(nvdaPool));
        assertEq(factory.getPool(address(nvda), address(usdc), TICK_SPACING), address(nvdaPool));
    }

    function test_theFactoryHasNoPoolAtAnotherTickSpacing() public view {
        assertEq(factory.getPool(address(usdc), address(nvda), 100), address(0));
    }

    function test_onlyTheOwnerCreatesPools() public {
        vm.prank(TRADER);
        vm.expectRevert(Ownable.Unauthorized.selector);
        factory.createPool(address(nvda), address(nvdaFeed), 100, FEE);
    }

    function test_aSecondPoolOfAStockAtTheSameTickSpacing() public {
        vm.prank(OPERATOR);
        vm.expectRevert(PaperFactory.PoolExists.selector);
        factory.createPool(address(nvda), address(nvdaFeed), TICK_SPACING, FEE);
    }

    // Reading a pool like Slipstream's --------------------------------------------------------------------------------

    function test_aPoolReadsLikeASlipstreamPool() public view {
        assertEq(nvdaPool.factory(), address(factory));
        assertEq(nvdaPool.token0(), address(usdc));
        assertEq(nvdaPool.token1(), address(nvda));
        assertEq(nvdaPool.tickSpacing(), 10);
        assertEq(nvdaPool.fee(), 300);
    }

    function test_slot0IsTheFeedsPriceWithUsdcFirst() public view {
        (uint160 sqrtPriceX96, int24 tick,,,, bool unlocked) = nvdaPool.slot0();
        assertEq(sqrtPriceX96, 64_689_523_806_083_061_751_132_589_430);
        assertEq(tick, -4055);
        assertTrue(unlocked);
    }

    function test_slot0IsTheFeedsPriceWithTheStockFirst() public view {
        assertEq(aaplPool.token0(), address(aapl));
        (uint160 sqrtPriceX96, int24 tick,,,,) = aaplPool.slot0();
        assertEq(sqrtPriceX96, 112_045_541_949_572_279_837_463_876_454);
        assertEq(tick, 6931);
    }

    // Prices ----------------------------------------------------------------------------------------------------------

    function test_aSmallBuyPaysOnlyTheFee() public view {
        // $100 buys 0.6667 NVDA, less 0.03%: no impact under $5,000.
        assertEq(nvdaPool.quote(address(usdc), 100e6), 66_646_666);
    }

    function test_aLargeBuyPaysTheSizeImpact() public view {
        // $50,000: 10 basis points of impact on top of the fee.
        assertEq(nvdaPool.quote(address(usdc), 50_000e6), 33_290_009_999);
    }

    function test_theImpactStopsAtTenPercent() public view {
        // $10,000,000 would be 2,000 basis points.
        assertEq(nvdaPool.quote(address(usdc), 10_000_000e6), 5_998_199_999_999);
    }

    function test_aSellPaysTheFee() public view {
        assertEq(nvdaPool.quote(address(nvda), 1e8), 149_955_000);
    }

    function test_aTokenThatIsntThePools() public {
        vm.expectRevert(PaperPool.UnknownToken.selector);
        nvdaPool.quote(address(aapl), 1e8);
    }

    function test_aStalePriceIsRefused() public {
        vm.warp(NOW + 5 days + 1);
        vm.expectRevert(PaperPool.StalePrice.selector);
        nvdaPool.quote(address(usdc), 100e6);
    }

    function test_aPriceFiveDaysOldStillFills() public {
        vm.warp(NOW + 5 days);
        assertEq(nvdaPool.quote(address(usdc), 100e6), 66_646_666);
    }

    function test_aFeedNeverWrittenIsRefused() public {
        TestStock tsla = new TestStock(OPERATOR, "Tesla", "TSLA");
        PaperFeed tslaFeed = new PaperFeed(address(writer), "TSLA / USD");
        vm.prank(OPERATOR);
        PaperPool pool = PaperPool(factory.createPool(address(tsla), address(tslaFeed), TICK_SPACING, FEE));

        vm.expectRevert(PaperPool.InvalidPrice.selector);
        pool.quote(address(usdc), 100e6);
    }

    // Quotes ----------------------------------------------------------------------------------------------------------

    function test_theQuoterAnswersWhatTheSwapFills() public {
        (uint256 quoted, uint160 sqrtPriceX96After, uint32 crossed) =
            quoter.quoteExactInputSingleV3(address(nvdaPool), address(usdc), 50_000e6, 0);

        assertEq(trade(params(address(usdc), address(nvda), 50_000e6, 1)), quoted);
        assertEq(sqrtPriceX96After, 64_689_523_806_083_061_751_132_589_430);
        assertEq(crossed, 0);
    }

    function test_theQuoterRefusesAPriceLimit() public {
        vm.expectRevert(PaperQuoter.Unsupported.selector);
        quoter.quoteExactInputSingleV3(address(nvdaPool), address(usdc), 100e6, 1);
    }

    // Swaps -----------------------------------------------------------------------------------------------------------

    function test_aBuyPaysTheStockToTheRecipient() public {
        uint256 amountOut = trade(params(address(usdc), address(nvda), 100e6, 66_646_666));

        assertEq(amountOut, 66_646_666);
        assertEq(usdc.balanceOf(TRADER), 999_900e6);
        assertEq(nvda.balanceOf(TRADER), 10e8 + 66_646_666);
    }

    function test_aSellPaysUsdcToTheRecipient() public {
        uint256 amountOut = trade(params(address(nvda), address(usdc), 1e8, 1));

        assertEq(amountOut, 149_955_000);
        assertEq(usdc.balanceOf(TRADER), 1_000_000e6 + 149_955_000);
        assertEq(nvda.balanceOf(TRADER), 9e8);
    }

    function test_aFillsTransfersAreBetweenTheTraderAndThePool() public {
        vm.recordLogs();
        trade(params(address(usdc), address(nvda), 100e6, 1));
        Vm.Log[] memory logs = vm.getRecordedLogs();

        // The pool mints what it's short of to itself, then pays: USDC in from the trader, NVDA out from the pool.
        uint256 transfers;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != TRANSFER) continue;
            address from = address(uint160(uint256(logs[i].topics[1])));
            address to = address(uint160(uint256(logs[i].topics[2])));
            if (to == TRADER || from == TRADER) {
                assertEq(from == TRADER ? to : from, address(nvdaPool));
                ++transfers;
            }
        }
        assertEq(transfers, 2);
    }

    function test_aPoolPaysFromWhatItHoldsBeforeMinting() public {
        trade(params(address(usdc), address(nvda), 10_000e6, 1));
        uint256 supply = usdc.totalSupply();

        // The sell is paid from the $10,000 the buy left in the pool.
        trade(params(address(nvda), address(usdc), 1e8, 1));
        assertEq(usdc.totalSupply(), supply);
    }

    function test_aSwapEmitsSlipstreamsSwapEvent() public {
        PaperRouter.ExactInputSingleParams memory p = params(address(usdc), address(nvda), 100e6, 1);
        vm.prank(TRADER);
        usdc.approve(address(router), p.amountIn);

        vm.expectEmit(address(nvdaPool));
        emit PaperPool.Swap(
            address(router), TRADER, 100e6, -66_646_666, 64_689_523_806_083_061_751_132_589_430, 0, -4055
        );
        vm.prank(TRADER);
        router.exactInputSingle(p);
    }

    function test_aSwapPastItsDeadline() public {
        PaperRouter.ExactInputSingleParams memory p = params(address(usdc), address(nvda), 100e6, 1);
        p.deadline = block.timestamp - 1;

        vm.prank(TRADER);
        usdc.approve(address(router), p.amountIn);
        vm.prank(TRADER);
        vm.expectRevert(bytes("Transaction too old"));
        router.exactInputSingle(p);
    }

    function test_aSwapUnderItsMinimumOut() public {
        PaperRouter.ExactInputSingleParams memory p = params(address(usdc), address(nvda), 100e6, 66_646_667);

        vm.prank(TRADER);
        usdc.approve(address(router), p.amountIn);
        vm.prank(TRADER);
        vm.expectRevert(bytes("Too little received"));
        router.exactInputSingle(p);
    }

    function test_aSwapWithoutAPool() public {
        PaperRouter.ExactInputSingleParams memory p = params(address(usdc), address(nvda), 100e6, 1);
        p.tickSpacing = 100;

        vm.prank(TRADER);
        vm.expectRevert(PaperRouter.UnknownPool.selector);
        router.exactInputSingle(p);
    }

    function test_aSwapWithAPriceLimit() public {
        PaperRouter.ExactInputSingleParams memory p = params(address(usdc), address(nvda), 100e6, 1);
        p.sqrtPriceLimitX96 = 1;

        vm.prank(TRADER);
        vm.expectRevert(PaperRouter.Unsupported.selector);
        router.exactInputSingle(p);
    }

    function test_aSwapWithNothingSentToThePool() public {
        vm.expectRevert(PaperPool.NothingToSwap.selector);
        nvdaPool.swap(TRADER, address(usdc));
    }
}
