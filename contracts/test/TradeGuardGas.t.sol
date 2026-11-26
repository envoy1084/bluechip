// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {TradeGuard} from "../src/TradeGuard.sol";
import {Outcome} from "../src/lib/Outcome.sol";
import {CashReserveRule} from "../src/rules/CashReserveRule.sol";
import {FairPriceRule} from "../src/rules/FairPriceRule.sol";
import {SlippageBudgetRule} from "../src/rules/SlippageBudgetRule.sol";
import {StockCapRule} from "../src/rules/StockCapRule.sol";
import {StopLossFloorRule} from "../src/rules/StopLossFloorRule.sol";
import {TradeSizeRule} from "../src/rules/TradeSizeRule.sol";
import {MockAggregator, MockToken} from "./utils/Mocks.sol";

/// @dev TradeGuard's gas on a full configuration, every stock bluechip lists (13) and every rule a Stock picker has,
/// with cash and two stocks held:
/// enabling the session, and one buy (both checks), from cold storage as in an operation; and a Stop-loss guard's sale
/// under its floor on the same stocks. `forge snapshot` records
/// them in `snapshots/TradeGuardGasTest.json`.
contract TradeGuardGasTest is Test {
    bytes32 internal constant ID = keccak256("session");
    address internal constant ACCOUNT = address(0xACC);
    uint256 internal constant STOCKS = 13;

    MockToken internal usdc = new MockToken("USDC", 6);
    MockAggregator internal sequencer = new MockAggregator();
    MockToken[] internal tokens;
    bytes internal initData;
    TradeGuard internal guard;
    TradeGuard.Market[] internal markets;

    function setUp() public {
        vm.warp(1_800_000_000);
        guard = new TradeGuard(address(usdc), address(sequencer), 1 hours);
        sequencer.set(0, block.timestamp - 2 hours, block.timestamp - 2 hours);
        usdc.mint(ACCOUNT, 1000e6);

        for (uint256 i = 0; i < STOCKS; ++i) {
            markets.push(TradeGuard.Market(address(new MockToken("STOCK", 8)), address(new MockAggregator()), true));
        }
        TradeGuard.Config memory config = _config();
        for (uint256 i = 0; i < STOCKS; ++i) {
            MockToken token = MockToken(markets[i].token);
            tokens.push(token);
            MockAggregator(markets[i].feed).set(100e8, block.timestamp - 60, block.timestamp - 60);
            if (i < 2) token.mint(ACCOUNT, 1e8);
        }
        initData = encoded(config);
        guard.initializeWithMultiplexer(ACCOUNT, ID, initData);
    }

    function _config() internal returns (TradeGuard.Config memory c) {
        c.mode = Outcome.BOTH;
        c.prices = Outcome.Prices({tradeWhilePaused: true, liveAge: 26 hours, pausedAge: 80 hours});
        c.markets = guard.packMarkets(markets);
        c.rules = new TradeGuard.Rule[](5);
        c.rules[0] = TradeGuard.Rule(address(new TradeSizeRule()), abi.encode(TradeSizeRule.Config(5e6, 100e6)));
        c.rules[1] = TradeGuard.Rule(address(new FairPriceRule()), abi.encode(FairPriceRule.Config(100, 50)));
        c.rules[2] = TradeGuard.Rule(address(new StockCapRule()), abi.encode(StockCapRule.Config(3000)));
        c.rules[3] = TradeGuard.Rule(address(new CashReserveRule()), abi.encode(CashReserveRule.Config(1000)));
        c.rules[4] =
            TradeGuard.Rule(address(new SlippageBudgetRule()), abi.encode(SlippageBudgetRule.Config(100, 7 days)));
    }

    function test_enablingASessionOnEveryStock() public {
        vm.startSnapshotGas("enable");
        guard.initializeWithMultiplexer(address(0xB0B), ID, initData);
        vm.stopSnapshotGas();
    }

    function test_aBuyOnEveryStockConfigured() public {
        vm.startSnapshotGas("preCheck");
        bytes memory context = guard.preCheck(ID, ACCOUNT, "");
        vm.stopSnapshotGas();

        usdc.burn(ACCOUNT, 50e6);
        tokens[0].mint(ACCOUNT, 0.4995e8);

        vm.startSnapshotGas("postCheck");
        guard.postCheck(ID, ACCOUNT, context);
        vm.stopSnapshotGas();
    }

    function test_aStopLossSaleOnEveryStockConfigured() public {
        // Half an NVDA sold at $100, under a $150 floor on every stock.
        bytes32 id = keccak256("stop-loss");
        TradeGuard.Config memory c;
        c.mode = Outcome.SELL;
        c.prices = Outcome.Prices({tradeWhilePaused: true, liveAge: 26 hours, pausedAge: 80 hours});
        c.markets = guard.packMarkets(markets);
        uint256[] memory floors = new uint256[](STOCKS);
        for (uint256 i = 0; i < STOCKS; ++i) {
            floors[i] = 150e8;
        }
        c.rules = new TradeGuard.Rule[](4);
        c.rules[0] = TradeGuard.Rule(address(new TradeSizeRule()), abi.encode(TradeSizeRule.Config(5e6, 100e6)));
        c.rules[1] = TradeGuard.Rule(address(new FairPriceRule()), abi.encode(FairPriceRule.Config(100, 50)));
        c.rules[2] = TradeGuard.Rule(address(new StopLossFloorRule()), abi.encode(StopLossFloorRule.Config(floors)));
        c.rules[3] =
            TradeGuard.Rule(address(new SlippageBudgetRule()), abi.encode(SlippageBudgetRule.Config(100, 7 days)));
        guard.initializeWithMultiplexer(ACCOUNT, id, encoded(c));

        bytes memory context = guard.preCheck(id, ACCOUNT, "");
        tokens[0].burn(ACCOUNT, 0.5e8);
        usdc.mint(ACCOUNT, 49.95e6);

        vm.startSnapshotGas("stopLossPostCheck");
        guard.postCheck(id, ACCOUNT, context);
        vm.stopSnapshotGas();
    }

    function encoded(TradeGuard.Config memory c) internal pure returns (bytes memory) {
        return abi.encode(c.mode, c.prices, c.markets, c.rules);
    }
}
