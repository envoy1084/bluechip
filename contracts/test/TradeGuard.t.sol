// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {IPolicy} from "namera/policies/interfaces/IPolicy.sol";

import {TradeGuard} from "../src/TradeGuard.sol";
import {GuardRules} from "../src/lib/GuardRules.sol";
import {MockAggregator, MockToken} from "./utils/Mocks.sol";

/// @dev The test contract plays SessionHook (the multiplexer); "trading" mints and burns the account's balances
/// between `preCheck` and `postCheck`. A Stock picker holding $1,000 of cash and 5 NVDA at $100.
contract TradeGuardTest is Test {
    bytes32 internal constant ID = keccak256("session");
    address internal constant ACCOUNT = address(0xACC);

    MockToken internal usdc = new MockToken("USDC", 6);
    MockToken internal nvda = new MockToken("NVDA", 8);
    MockAggregator internal nvdaFeed = new MockAggregator();
    MockAggregator internal sequencer = new MockAggregator();
    TradeGuard internal guard;

    function setUp() public {
        vm.warp(1_800_000_000);
        guard = new TradeGuard(address(usdc), address(sequencer), 1 hours);
        sequencer.set(0, block.timestamp - 2 hours, block.timestamp - 2 hours);
        nvdaFeed.set(100e8, block.timestamp - 60, block.timestamp - 60);
        usdc.mint(ACCOUNT, 1000e6);
        nvda.mint(ACCOUNT, 5e8);
        guard.initializeWithMultiplexer(ACCOUNT, ID, abi.encode(config()));
    }

    function config() internal view returns (TradeGuard.Config memory c) {
        c.settings = GuardRules.Settings({
            mode: GuardRules.BOTH,
            tradeWhilePaused: true,
            collarBps: 100,
            pausedCollarBps: 50,
            liveAge: 26 hours,
            pausedAge: 80 hours,
            minTradeUsd: 5e6,
            maxTradeUsd: 100e6,
            maxInOneStockBps: 5000,
            cashReserveBps: 1000,
            weeklySlippageBps: 100,
            slippageWindow: 7 days,
            bandBps: 100,
            overshootBps: 5,
            progressBps: 10,
            cashTargetBps: 0
        });
        c.markets = new TradeGuard.Market[](1);
        c.markets[0] = TradeGuard.Market(address(nvda), address(nvdaFeed), true, 0);
    }

    /// @dev A buy of `shares` NVDA for `cost` USDC, between the guard's checks.
    function buy(uint256 cost, uint256 shares) internal {
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");
        usdc.burn(ACCOUNT, cost);
        nvda.mint(ACCOUNT, shares);
        guard.postCheck(ID, ACCOUNT, context);
    }

    function test_aFairBuyPassesAndRecordsItsLoss() public {
        buy(100e6, 0.995e8);

        (uint256 used, uint256 updatedAt) = guard.ledger(ID, address(this), ACCOUNT);
        assertEq(used, 0.5e6);
        assertEq(updatedAt, block.timestamp);
    }

    function test_anUnfairBuyReverts() public {
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");
        usdc.burn(ACCOUNT, 100e6);
        nvda.mint(ACCOUNT, 0.98e8);

        vm.expectRevert(GuardRules.UnfairPrice.selector);
        guard.postCheck(ID, ACCOUNT, context);
    }

    function test_anOperationWhileTheSequencerIsDown() public {
        sequencer.set(1, block.timestamp - 2 hours, block.timestamp - 2 hours);
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");

        vm.expectRevert(TradeGuard.SequencerDown.selector);
        guard.postCheck(ID, ACCOUNT, context);
    }

    function test_anOperationWithinTheHourTheSequencerCameBack() public {
        sequencer.set(0, block.timestamp - 1 hours, block.timestamp - 1 hours);
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");

        vm.expectRevert(TradeGuard.SequencerDown.selector);
        guard.postCheck(ID, ACCOUNT, context);
    }

    function test_anOperationThatTradesNothingLeavesTheLedger() public {
        guard.postCheck(ID, ACCOUNT, guard.preCheck(ID, ACCOUNT, ""));

        (uint256 used, uint256 updatedAt) = guard.ledger(ID, address(this), ACCOUNT);
        assertEq(used, 0);
        assertEq(updatedAt, 0);
    }

    function test_aStockReadsOnlyTheFeedsOfWhatIsHeld() public {
        // A second, unheld stock with a feed that reverts: never read.
        MockToken tsla = new MockToken("TSLA", 8);
        TradeGuard.Config memory c = config();
        TradeGuard.Market[] memory markets = new TradeGuard.Market[](2);
        markets[0] = c.markets[0];
        markets[1] = TradeGuard.Market(address(tsla), address(0xDEAD), false, 0);
        c.markets = markets;
        guard.initializeWithMultiplexer(ACCOUNT, ID, abi.encode(c));

        buy(100e6, 1e8);
    }

    function test_anAccountWithoutAConfiguration() public {
        vm.expectRevert(
            abi.encodeWithSelector(IPolicy.PolicyNotInitialized.selector, ID, address(this), address(0xBEEF))
        );
        guard.preCheck(ID, address(0xBEEF), "");
    }
}
