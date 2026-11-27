// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {IPolicy} from "namera/policies/interfaces/IPolicy.sol";
import {PolicyStorage} from "namera/policies/lib/PolicyStorage.sol";

import {TradeGuard} from "../src/TradeGuard.sol";
import {Outcome} from "../src/lib/Outcome.sol";
import {CashReserveRule} from "../src/rules/CashReserveRule.sol";
import {FairPriceRule} from "../src/rules/FairPriceRule.sol";
import {SlippageBudgetRule} from "../src/rules/SlippageBudgetRule.sol";
import {StockCapRule} from "../src/rules/StockCapRule.sol";
import {TradeSizeRule} from "../src/rules/TradeSizeRule.sol";
import {MockAggregator, MockToken} from "./utils/Mocks.sol";

/// @dev The test contract plays SessionHook (the multiplexer); "trading" mints and burns the account's balances
/// between `preCheck` and `postCheck`. A Stock picker holding $1,000 of cash and 5 NVDA at $100, with every rule but
/// the Rebalancer's.
contract TradeGuardTest is Test {
    bytes32 internal constant ID = keccak256("session");
    bytes32 internal constant RENEWED = keccak256("renewed session");
    bytes32 internal constant AGENT = keccak256("agent");
    address internal constant ACCOUNT = address(0xACC);

    MockToken internal usdc = new MockToken("USDC", 6);
    MockToken internal nvda = new MockToken("NVDA", 8);
    MockAggregator internal nvdaFeed = new MockAggregator();
    MockAggregator internal sequencer = new MockAggregator();
    TradeSizeRule internal tradeSize = new TradeSizeRule();
    FairPriceRule internal fairPrice = new FairPriceRule();
    StockCapRule internal stockCap = new StockCapRule();
    CashReserveRule internal cashReserve = new CashReserveRule();
    SlippageBudgetRule internal slippageBudget = new SlippageBudgetRule();
    TradeGuard internal guard;

    function setUp() public {
        vm.warp(1_800_000_000);
        guard = new TradeGuard(address(usdc), address(sequencer), 1 hours);
        sequencer.set(0, block.timestamp - 2 hours, block.timestamp - 2 hours);
        nvdaFeed.set(100e8, block.timestamp - 60, block.timestamp - 60);
        usdc.mint(ACCOUNT, 1000e6);
        nvda.mint(ACCOUNT, 5e8);
        guard.initializeWithMultiplexer(ACCOUNT, ID, encoded(config()));
    }

    function config() internal view returns (TradeGuard.Config memory c) {
        c.mode = Outcome.BOTH;
        c.prices = Outcome.Prices({tradeWhilePaused: true, liveAge: 26 hours, pausedAge: 80 hours});
        TradeGuard.Market[] memory markets = new TradeGuard.Market[](1);
        markets[0] = TradeGuard.Market(address(nvda), address(nvdaFeed), true);
        c.markets = guard.packMarkets(markets);
        c.rules = new TradeGuard.Rule[](5);
        c.rules[0] = TradeGuard.Rule(address(tradeSize), abi.encode(TradeSizeRule.Config(5e6, 100e6)));
        c.rules[1] = TradeGuard.Rule(address(fairPrice), abi.encode(FairPriceRule.Config(100, 50)));
        c.rules[2] = TradeGuard.Rule(address(stockCap), abi.encode(StockCapRule.Config(5000)));
        c.rules[3] = TradeGuard.Rule(address(cashReserve), abi.encode(CashReserveRule.Config(1000)));
        c.rules[4] = TradeGuard.Rule(address(slippageBudget), abi.encode(SlippageBudgetRule.Config(100, 7 days)));
        c.agent = AGENT;
    }

    /// @dev A buy of `shares` NVDA for `cost` USDC, between the guard's checks.
    function buy(uint256 cost, uint256 shares) internal {
        buyIn(ID, cost, shares);
    }

    /// @dev The same buy in the session `id`.
    function buyIn(bytes32 id, uint256 cost, uint256 shares) internal {
        bytes memory context = guard.preCheck(id, ACCOUNT, "");
        usdc.burn(ACCOUNT, cost);
        nvda.mint(ACCOUNT, shares);
        guard.postCheck(id, ACCOUNT, context);
    }

    /// @dev A buy of `shares` NVDA for `cost` USDC, expecting the guard to refuse it with `reason`.
    function refusedBuy(uint256 cost, uint256 shares, bytes memory reason) internal {
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");
        usdc.burn(ACCOUNT, cost);
        nvda.mint(ACCOUNT, shares);

        vm.expectRevert(reason);
        guard.postCheck(ID, ACCOUNT, context);
    }

    function ledger() internal view returns (uint256 used, uint256 updatedAt) {
        return slippageBudget.ledger(address(guard), PolicyStorage.configKey(AGENT, address(this)), ACCOUNT);
    }

    function test_aFairBuyPassesAndTheSlippageRuleRecordsItsLoss() public {
        buy(100e6, 0.995e8);

        (uint256 used, uint256 updatedAt) = ledger();
        assertEq(used, 0.5e6);
        assertEq(updatedAt, block.timestamp);
    }

    function test_anUnfairBuyIsRefusedWithTheRulesOwnError() public {
        refusedBuy(100e6, 0.98e8, abi.encodeWithSelector(FairPriceRule.UnfairPrice.selector));
    }

    function test_aSessionWithoutARuleDoesntCheckIt() public {
        TradeGuard.Config memory c = config();
        c.rules[1] = c.rules[4];
        TradeGuard.Rule[] memory rules = new TradeGuard.Rule[](4);
        for (uint256 i; i < 4; ++i) {
            rules[i] = c.rules[i];
        }
        c.rules = rules;
        guard.initializeWithMultiplexer(ACCOUNT, ID, encoded(c));

        // 2% lost: past the 1% collar, but the fair-price rule isn't in this session.
        buy(100e6, 0.98e8);

        (uint256 used,) = ledger();
        assertEq(used, 2e6);
    }

    function test_rulesRunInTheOrderTheSessionLists() public {
        TradeGuard.Config memory c = config();
        (c.rules[0], c.rules[1]) = (c.rules[1], c.rules[0]);
        guard.initializeWithMultiplexer(ACCOUNT, ID, encoded(c));

        // Over the largest trade and unfair: the fair-price rule, listed first now, refuses it.
        refusedBuy(200e6, 1.5e8, abi.encodeWithSelector(FairPriceRule.UnfairPrice.selector));
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

    function test_anOperationThatTradesNothingRunsNoRule() public {
        guard.postCheck(ID, ACCOUNT, guard.preCheck(ID, ACCOUNT, ""));

        (uint256 used, uint256 updatedAt) = ledger();
        assertEq(used, 0);
        assertEq(updatedAt, 0);
    }

    function test_aStockReadsOnlyTheFeedsOfWhatIsHeld() public {
        // A second, unheld stock with a feed that reverts: never read.
        MockToken tsla = new MockToken("TSLA", 8);
        TradeGuard.Config memory c = config();
        TradeGuard.Market[] memory markets = new TradeGuard.Market[](2);
        markets[0] = TradeGuard.Market(address(nvda), address(nvdaFeed), true);
        markets[1] = TradeGuard.Market(address(tsla), address(0xDEAD), false);
        c.markets = guard.packMarkets(markets);
        guard.initializeWithMultiplexer(ACCOUNT, ID, encoded(c));

        buy(100e6, 1e8);
    }

    function test_aReconfiguredSessionChecksTheNewConfiguration() public {
        TradeGuard.Config memory c = config();
        c.mode = Outcome.SELL;
        guard.initializeWithMultiplexer(ACCOUNT, ID, encoded(c));

        refusedBuy(100e6, 0.995e8, abi.encodeWithSelector(Outcome.WrongDirection.selector, address(nvda)));
    }

    function test_aRenewedSessionOfTheSameAgentKeepsTheSlippageLedger() public {
        buy(100e6, 0.995e8);
        guard.initializeWithMultiplexer(ACCOUNT, RENEWED, encoded(config()));

        buyIn(RENEWED, 100e6, 0.995e8);

        (uint256 used,) = ledger();
        assertEq(used, 1e6);
    }

    function test_anotherAgentsSessionStartsItsOwnLedger() public {
        buy(100e6, 0.995e8);
        TradeGuard.Config memory c = config();
        c.agent = keccak256("another agent");
        guard.initializeWithMultiplexer(ACCOUNT, RENEWED, encoded(c));

        buyIn(RENEWED, 100e6, 0.995e8);

        (uint256 theirs,) =
            slippageBudget.ledger(address(guard), PolicyStorage.configKey(c.agent, address(this)), ACCOUNT);
        (uint256 ours,) = ledger();
        assertEq(theirs, 0.5e6);
        assertEq(ours, 0.5e6);
    }

    function test_anotherMultiplexerCantWriteTheAgentsLedger() public {
        bytes memory initData = encoded(config());
        vm.startPrank(address(0xBAD));
        guard.initializeWithMultiplexer(ACCOUNT, ID, initData);
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");
        usdc.burn(ACCOUNT, 100e6);
        nvda.mint(ACCOUNT, 0.995e8);
        guard.postCheck(ID, ACCOUNT, context);
        vm.stopPrank();

        (uint256 used,) = ledger();
        assertEq(used, 0);
    }

    function test_anAccountWithoutAConfiguration() public {
        vm.expectRevert(
            abi.encodeWithSelector(IPolicy.PolicyNotInitialized.selector, ID, address(this), address(0xBEEF))
        );
        guard.preCheck(ID, address(0xBEEF), "");
    }

    function encoded(TradeGuard.Config memory c) internal pure returns (bytes memory) {
        return abi.encode(c.mode, c.prices, c.markets, c.rules, c.agent);
    }
}
