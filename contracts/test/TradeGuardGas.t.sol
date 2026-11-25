// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {TradeGuard} from "../src/TradeGuard.sol";
import {GuardRules} from "../src/lib/GuardRules.sol";
import {MockAggregator, MockToken} from "./utils/Mocks.sol";

/// @dev TradeGuard's gas on a full configuration, every stock bluechip lists (13), with cash and two stocks held:
/// enabling the session, and one buy (both checks), from cold storage as in an operation. `forge snapshot` records
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

    function setUp() public {
        vm.warp(1_800_000_000);
        guard = new TradeGuard(address(usdc), address(sequencer), 1 hours);
        sequencer.set(0, block.timestamp - 2 hours, block.timestamp - 2 hours);
        usdc.mint(ACCOUNT, 1000e6);

        TradeGuard.Config memory config = _config();
        for (uint256 i = 0; i < STOCKS; ++i) {
            MockToken token = MockToken(config.markets[i].token);
            tokens.push(token);
            MockAggregator(config.markets[i].feed).set(100e8, block.timestamp - 60, block.timestamp - 60);
            if (i < 2) token.mint(ACCOUNT, 1e8);
        }
        initData = abi.encode(config);
        guard.initializeWithMultiplexer(ACCOUNT, ID, initData);
    }

    function _config() internal returns (TradeGuard.Config memory c) {
        c.settings = GuardRules.Settings({
            mode: GuardRules.BOTH,
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
        c.markets = new TradeGuard.Market[](STOCKS);
        for (uint256 i = 0; i < STOCKS; ++i) {
            c.markets[i] = TradeGuard.Market(address(new MockToken("STOCK", 8)), address(new MockAggregator()), true, 0);
        }
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
}
