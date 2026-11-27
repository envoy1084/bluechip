// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {Period} from "namera/policies/lib/Period.sol";
import {PolicyStorage} from "namera/policies/lib/PolicyStorage.sol";
import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

import {AerodromeTradePolicy} from "../../src/AerodromeTradePolicy.sol";
import {TradeGuard} from "../../src/TradeGuard.sol";
import {Outcome} from "../../src/lib/Outcome.sol";
import {TradeShape} from "../../src/lib/TradeShape.sol";
import {SequencerUptimeStub} from "../../src/paper/SequencerUptimeStub.sol";
import {FairPriceRule} from "../../src/rules/FairPriceRule.sol";
import {SlippageBudgetRule} from "../../src/rules/SlippageBudgetRule.sol";
import {PaperMarket} from "./PaperMarket.sol";

/// @dev bluechip's policies deployed unchanged over paper's USDC, router and sequencer stub, as on Base Sepolia. The
/// test plays both multiplexers (Smart Sessions for validation, SessionHook around execution); the trader is the
/// account, an agent trading NVDA up to $1,000,000 a buy with a 1% collar and a 1% weekly slippage budget.
contract PaperTradeTest is PaperMarket {
    bytes32 internal constant ID = keccak256("session");

    AerodromeTradePolicy internal policy;
    TradeGuard internal guard;
    FairPriceRule internal fairPrice = new FairPriceRule();
    SlippageBudgetRule internal slippageBudget = new SlippageBudgetRule();

    function setUp() public override {
        super.setUp();
        policy = new AerodromeTradePolicy(address(usdc), address(router));
        guard = new TradeGuard(address(usdc), address(new SequencerUptimeStub()), 1 hours);

        TradeShape.Settings memory settings;
        settings.mode = Outcome.BOTH;
        settings.maxUsdcIn = 1_000_000e6;
        settings.dailyBudget = 1_000_000e6;
        settings.markets = new TradeShape.Market[](1);
        settings.markets[0] = TradeShape.Market(address(nvda), TICK_SPACING);
        policy.initializeWithMultiplexer(TRADER, ID, abi.encode(settings, keccak256("agent")));

        TradeGuard.Market[] memory markets = new TradeGuard.Market[](1);
        markets[0] = TradeGuard.Market(address(nvda), address(nvdaFeed), true);
        TradeGuard.Rule[] memory rules = new TradeGuard.Rule[](2);
        rules[0] = TradeGuard.Rule(address(fairPrice), abi.encode(FairPriceRule.Config(100, 50)));
        rules[1] = TradeGuard.Rule(address(slippageBudget), abi.encode(SlippageBudgetRule.Config(100, 7 days)));
        guard.initializeWithMultiplexer(
            TRADER,
            ID,
            abi.encode(
                Outcome.BOTH,
                Outcome.Prices({tradeWhilePaused: true, liveAge: 26 hours, pausedAge: 80 hours}),
                guard.packMarkets(markets),
                rules,
                keccak256("agent")
            )
        );
    }

    /// @dev The agent's approve-then-swap calls for a buy of NVDA with `usdcIn`, as bluechip builds them.
    function buyCalls(uint256 usdcIn) internal view returns (UserOpCalls.Call[] memory calls) {
        bytes memory swap = abi.encodeCall(router.exactInputSingle, (params(address(usdc), address(nvda), usdcIn, 1)));
        calls = new UserOpCalls.Call[](2);
        calls[0] = UserOpCalls.Call(address(usdc), 0, abi.encodeCall(usdc.approve, (address(router), usdcIn)));
        calls[1] = UserOpCalls.Call(address(router), 0, swap);
    }

    /// @dev A Kernel batch `execute` with the agent's stated time appended, as Namera's SDK sends it.
    function operation(UserOpCalls.Call[] memory calls) internal pure returns (ERC4337.PackedUserOperation memory op) {
        bytes32 batch = bytes32(uint256(1) << 248);
        op.sender = TRADER;
        op.callData =
            abi.encodePacked(abi.encodeWithSelector(UserOpCalls.EXECUTE, batch, abi.encode(calls)), bytes32(NOW));
    }

    /// @dev Runs `calls` as the account after the guard's `preCheck`, returning its context for `postCheck`.
    function trade(UserOpCalls.Call[] memory calls) internal returns (bytes memory context) {
        context = guard.preCheck(ID, TRADER, "");
        vm.startPrank(TRADER);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = calls[i].target.call(calls[i].data);
            assertTrue(ok);
        }
        vm.stopPrank();
    }

    function test_anAgentsBuyThroughThePaperRouterPassesValidation() public {
        assertEq(policy.checkUserOpPolicy(ID, operation(buyCalls(100e6))), Period.bounds(1 days, NOW));
    }

    function test_anAgentsBuyThroughThePaperRouterPassesTheGuard() public {
        guard.postCheck(ID, TRADER, trade(buyCalls(100e6)));

        // $100 for 0.66646666 NVDA, worth $99.969999 at the feed: the fee, 3 cents, is the slippage.
        (uint256 used,) =
            slippageBudget.ledger(address(guard), PolicyStorage.configKey(keccak256("agent"), address(this)), TRADER);
        assertEq(used, 30_001);
        assertEq(nvda.balanceOf(TRADER), 10e8 + 66_646_666);
    }

    function test_aBuyWhoseImpactPassesTheCollarIsRefused() public {
        // $600,000: 120 basis points of impact, past the 1% collar.
        bytes memory context = trade(buyCalls(600_000e6));

        vm.expectRevert(FairPriceRule.UnfairPrice.selector);
        guard.postCheck(ID, TRADER, context);
    }
}
