// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

import {GuardRules} from "../src/lib/GuardRules.sol";
import {TradeMath} from "../src/lib/TradeMath.sol";
import {TradeShape} from "../src/lib/TradeShape.sol";
import {AerodromeTradePolicyHarness, RulesHarness, TradeGuardHarness} from "./utils/Mocks.sol";

/// @notice Properties the rules keep for any input: no batch but approve-then-swap pairs passes, nothing is ever
/// paid to another address, no accepted trade loses more than the collar, an accepted rebalance always gets closer to
/// the target mix, the slippage ledger only ever shrinks with time, and both policies' packed settings read back as
/// stored.
contract FuzzTest is Test {
    RulesHarness internal rules = new RulesHarness();
    TradeGuardHarness internal guard = new TradeGuardHarness();
    AerodromeTradePolicyHarness internal policy = new AerodromeTradePolicyHarness();

    address internal constant USDC = address(0xC0);
    address internal constant ROUTER = address(0xE0);
    address internal constant NVDA = address(0xA1);
    address internal constant AAPL = address(0xA2);
    address internal constant ACCOUNT = address(0xACC);
    uint256 internal constant NOW = 1_800_000_000;

    // The shape ------------------------------------------------------------------------------------------------------

    function settings() internal pure returns (TradeShape.Settings memory s) {
        s.mode = GuardRules.BOTH;
        s.maxUsdcIn = 100e6;
        s.dailyBudget = 250e6;
        s.markets = new TradeShape.Market[](1);
        s.markets[0] = TradeShape.Market(NVDA, 10);
    }

    function buy(uint256 usdc, address recipient) internal pure returns (UserOpCalls.Call[] memory calls) {
        TradeShape.Swap memory swap = TradeShape.Swap(USDC, NVDA, 10, recipient, NOW, usdc, 1, 0);
        calls = new UserOpCalls.Call[](2);
        calls[0] = UserOpCalls.Call(USDC, 0, abi.encodeWithSelector(TradeShape.APPROVE, ROUTER, usdc));
        calls[1] = UserOpCalls.Call(ROUTER, 0, abi.encodeWithSelector(TradeShape.EXACT_INPUT_SINGLE, swap));
    }

    function testFuzz_aSwapPaidToAnyoneElseFails(address recipient) public view {
        vm.assume(recipient != ACCOUNT);

        (bool ok,) = rules.shape(settings(), buy(50e6, recipient), ACCOUNT, USDC, ROUTER);

        assertFalse(ok);
    }

    function testFuzz_anyCallAddedToAPairFails(address target, uint256 value, bytes memory data) public view {
        UserOpCalls.Call[] memory pair = buy(50e6, ACCOUNT);
        UserOpCalls.Call[] memory calls = new UserOpCalls.Call[](3);
        calls[0] = pair[0];
        calls[1] = pair[1];
        calls[2] = UserOpCalls.Call(target, value, data);

        (bool ok,) = rules.shape(settings(), calls, ACCOUNT, USDC, ROUTER);

        assertFalse(ok);
    }

    function testFuzz_anyCallInPlaceOfTheSwapFails(address target, bytes memory data) public view {
        vm.assume(target != ROUTER || data.length != 260);
        UserOpCalls.Call[] memory calls = buy(50e6, ACCOUNT);
        calls[1] = UserOpCalls.Call(target, 0, data);

        (bool ok,) = rules.shape(settings(), calls, ACCOUNT, USDC, ROUTER);

        assertFalse(ok);
    }

    function testFuzz_anApprovalForAnyOtherAmountFails(uint256 approved) public view {
        vm.assume(approved != 50e6);
        UserOpCalls.Call[] memory calls = buy(50e6, ACCOUNT);
        calls[0].data = abi.encodeWithSelector(TradeShape.APPROVE, ROUTER, approved);

        (bool ok,) = rules.shape(settings(), calls, ACCOUNT, USDC, ROUTER);

        assertFalse(ok);
    }

    // The guard -----------------------------------------------------------------------------------------------------

    /// @dev A Rebalancer (30% NVDA, 30% AAPL, 40% cash) or a Stock picker with room to trade, at $100 NVDA and $200
    /// AAPL, prices a minute old.
    function guardInput(uint8 mode, uint256 cash, uint256 nvda, uint256 aapl)
        internal
        pure
        returns (GuardRules.Input memory input)
    {
        input.settings = GuardRules.Settings({
            mode: mode,
            tradeWhilePaused: false,
            collarBps: 100,
            pausedCollarBps: 50,
            liveAge: 26 hours,
            pausedAge: 80 hours,
            minTradeUsd: 5e6,
            maxTradeUsd: 1000e6,
            maxInOneStockBps: 10_000,
            cashReserveBps: 0,
            weeklySlippageBps: 10_000,
            slippageWindow: 7 days,
            bandBps: 100,
            overshootBps: 5,
            progressBps: 10,
            cashTargetBps: 4000
        });
        input.cashBefore = cash;
        input.cashAfter = cash;
        input.stocks = new GuardRules.Stock[](2);
        input.stocks[0] = GuardRules.Stock(NVDA, true, 3000, nvda, nvda, 100e8, NOW - 60);
        input.stocks[1] = GuardRules.Stock(AAPL, true, 3000, aapl, aapl, 200e8, NOW - 60);
        input.time = NOW;
    }

    function testFuzz_noAcceptedBuyLosesMoreThanTheCollar(uint256 cost, uint256 shares) public view {
        cost = bound(cost, 5e6, 1000e6);
        shares = bound(shares, 1, 20e8);
        GuardRules.Input memory input = guardInput(GuardRules.BOTH, 2000e6, 5e8, 2.5e8);
        input.cashAfter = input.cashBefore - cost;
        input.stocks[0].balanceAfter = input.stocks[0].balanceBefore + shares;

        try rules.check(input) {
            uint256 received = TradeMath.valueOf(shares, 100e8);
            uint256 lost = cost > received ? cost - received : 0;
            assertLe(lost * 10_000, 100 * cost);
        } catch {}
    }

    function testFuzz_anAcceptedRebalanceGetsCloserToTheMix(
        uint256 cash,
        uint256 nvda,
        uint256 aapl,
        uint256 dollars,
        bool buying
    ) public view {
        cash = bound(cash, 0, 4000e6);
        nvda = bound(nvda, 0, 40e8);
        aapl = bound(aapl, 0, 20e8);
        dollars = bound(dollars, 5, 400);
        GuardRules.Input memory input = guardInput(GuardRules.REBALANCE, cash, nvda, aapl);

        // A fair trade of NVDA at $100: `dollars` of USDC for `dollars / 100` shares, either way.
        uint256 usdc = dollars * 1e6;
        uint256 shares = dollars * 1e6;
        if (buying) {
            vm.assume(cash >= usdc);
            input.cashAfter = cash - usdc;
            input.stocks[0].balanceAfter = nvda + shares;
        } else {
            vm.assume(nvda >= shares);
            input.cashAfter = cash + usdc;
            input.stocks[0].balanceAfter = nvda - shares;
        }

        try rules.check(input) {
            assertLt(_drift(input.cashAfter, input.stocks[0].balanceAfter, aapl), _drift(cash, nvda, aapl));
        } catch {}
    }

    function testFuzz_theLedgerOnlyShrinksWithTime(uint128 used, uint32 elapsed, uint32 later) public pure {
        uint256 start = 1_000_000;
        uint256 first = TradeMath.decayed(used, start, start + elapsed, 7 days);
        uint256 second = TradeMath.decayed(used, start, start + uint256(elapsed) + later, 7 days);

        assertLe(first, used);
        assertLe(second, first);
    }

    function _drift(uint256 cash, uint256 nvda, uint256 aapl) internal pure returns (uint256) {
        uint256[] memory values = new uint256[](3);
        values[0] = cash;
        values[1] = TradeMath.valueOf(nvda, 100e8);
        values[2] = TradeMath.valueOf(aapl, 200e8);
        uint256[] memory targets = new uint256[](3);
        targets[0] = 4000;
        targets[1] = 3000;
        targets[2] = 3000;
        return TradeMath.drift(values, values[0] + values[1] + values[2], targets);
    }

    // TradeGuard's storage -------------------------------------------------------------------------------------------

    function testFuzz_settingsComeBackAsStored(GuardRules.Settings memory s) public view {
        assertEq(abi.encode(guard.roundTrip(s)), abi.encode(s));
    }

    function testFuzz_policySettingsComeBackAsStored(TradeShape.Settings memory s) public view {
        s.maxUsdcIn = uint128(bound(s.maxUsdcIn, 0, (uint256(1) << 124) - 1));
        s.dailyBudget = uint128(bound(s.dailyBudget, 0, (uint256(1) << 124) - 1));

        assertEq(abi.encode(policy.roundTrip(abi.encode(s))), abi.encode(s));
    }
}
