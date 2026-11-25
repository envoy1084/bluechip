// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IPolicy} from "namera/policies/interfaces/IPolicy.sol";
import {Period} from "namera/policies/lib/Period.sol";
import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

import {AerodromeTradePolicy} from "../src/AerodromeTradePolicy.sol";
import {TradeShape} from "../src/lib/TradeShape.sol";

/// @dev The test contract plays Smart Sessions (the multiplexer). A Stock picker trades NVDA and AAPL, up to $100 a
/// buy and $250 a day.
contract AerodromeTradePolicyTest is Test {
    address internal constant USDC = address(0xC0);
    address internal constant ROUTER = address(0xE0);
    address internal constant NVDA = address(0xA1);
    address internal constant AAPL = address(0xA2);
    address internal constant TSLA = address(0xA3);
    address internal constant ACCOUNT = address(0xACC);

    bytes32 internal constant ACTION_ID = keccak256("action");
    bytes32 internal constant OPERATION_ID = keccak256("operation");
    uint256 internal constant NOW = 1_800_000_000;
    uint256 internal constant FAILED = 1;

    AerodromeTradePolicy internal policy = new AerodromeTradePolicy(USDC, ROUTER);

    function settings(uint8 mode) internal pure returns (TradeShape.Settings memory s) {
        s.mode = mode;
        s.maxUsdcIn = 100e6;
        s.dailyBudget = 250e6;
        s.markets = new TradeShape.Market[](2);
        s.markets[0] = TradeShape.Market(NVDA, 10);
        s.markets[1] = TradeShape.Market(AAPL, 10);
    }

    function setUp() public {
        policy.initializeWithMultiplexer(ACCOUNT, ACTION_ID, abi.encode(policy.ACTION()));
        policy.initializeWithMultiplexer(ACCOUNT, OPERATION_ID, abi.encode(policy.OPERATION(), settings(2)));
    }

    // Calls ----------------------------------------------------------------------------------------------------------

    function swap(address tokenIn, address tokenOut, uint256 amountIn) internal pure returns (TradeShape.Swap memory) {
        return TradeShape.Swap(tokenIn, tokenOut, 10, ACCOUNT, NOW + 120, amountIn, 1, 0);
    }

    function pair(TradeShape.Swap memory s) internal pure returns (UserOpCalls.Call[] memory calls) {
        calls = new UserOpCalls.Call[](2);
        calls[0] = UserOpCalls.Call(s.tokenIn, 0, abi.encodeWithSelector(TradeShape.APPROVE, ROUTER, s.amountIn));
        calls[1] = UserOpCalls.Call(ROUTER, 0, abi.encodeWithSelector(TradeShape.EXACT_INPUT_SINGLE, s));
    }

    function buy(address stock, uint256 usdc) internal pure returns (UserOpCalls.Call[] memory) {
        return pair(swap(USDC, stock, usdc));
    }

    function sell(address stock, uint256 shares) internal pure returns (UserOpCalls.Call[] memory) {
        return pair(swap(stock, USDC, shares));
    }

    function both(UserOpCalls.Call[] memory a, UserOpCalls.Call[] memory b)
        internal
        pure
        returns (UserOpCalls.Call[] memory calls)
    {
        calls = new UserOpCalls.Call[](a.length + b.length);
        for (uint256 i; i < a.length; ++i) calls[i] = a[i];
        for (uint256 i; i < b.length; ++i) calls[a.length + i] = b[i];
    }

    /// @dev A Kernel batch `execute` with the agent's stated time appended, as Namera's SDK sends it.
    function operation(UserOpCalls.Call[] memory calls, uint256 time)
        internal
        pure
        returns (ERC4337.PackedUserOperation memory op)
    {
        bytes32 batch = bytes32(uint256(1) << 248);
        op.sender = ACCOUNT;
        op.callData = abi.encodePacked(
            abi.encodeWithSelector(UserOpCalls.EXECUTE, batch, abi.encode(calls)), bytes32(time)
        );
    }

    function check(UserOpCalls.Call[] memory calls) internal returns (uint256) {
        return policy.checkUserOpPolicy(OPERATION_ID, operation(calls, NOW));
    }

    // Accepted ------------------------------------------------------------------------------------------------------

    function test_aBuyPassesWithinTheDayItWasStated() public {
        assertEq(check(buy(NVDA, 100e6)), Period.bounds(1 days, NOW));
    }

    function test_aSellPassesWithNoTimeBounds() public {
        assertEq(check(sell(NVDA, 1e8)), 0);
    }

    function test_aSellAndABuyInOneOperationPass() public {
        assertEq(check(both(sell(AAPL, 0.5e8), buy(NVDA, 100e6))), Period.bounds(1 days, NOW));
    }

    // The shape -----------------------------------------------------------------------------------------------------

    function test_anEmptyOperation() public {
        assertEq(check(new UserOpCalls.Call[](0)), FAILED);
    }

    function test_anApprovalWithoutItsSwap() public {
        UserOpCalls.Call[] memory calls = new UserOpCalls.Call[](1);
        calls[0] = buy(NVDA, 100e6)[0];
        assertEq(check(calls), FAILED);
    }

    function test_aSwapWithoutItsApproval() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[0] = calls[1];
        assertEq(check(calls), FAILED);
    }

    function test_anApprovalToAnotherSpender() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[0].data = abi.encodeWithSelector(TradeShape.APPROVE, address(0xBAD), 100e6);
        assertEq(check(calls), FAILED);
    }

    function test_anApprovalForMoreThanTheSwap() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[0].data = abi.encodeWithSelector(TradeShape.APPROVE, ROUTER, 100e6 + 1);
        assertEq(check(calls), FAILED);
    }

    function test_anApprovalOfAnotherToken() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[0].target = NVDA;
        assertEq(check(calls), FAILED);
    }

    function test_aSwapThroughAnotherRouter() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[1].target = address(0xBAD);
        assertEq(check(calls), FAILED);
    }

    function test_aCallThatSendsEth() public {
        UserOpCalls.Call[] memory calls = buy(NVDA, 100e6);
        calls[1].value = 1;
        assertEq(check(calls), FAILED);
    }

    // The swap ------------------------------------------------------------------------------------------------------

    function test_aStockTheAgentCantTrade() public {
        assertEq(check(buy(TSLA, 50e6)), FAILED);
    }

    function test_aStockThroughAnotherPool() public {
        TradeShape.Swap memory s = swap(USDC, NVDA, 50e6);
        s.tickSpacing = 100;
        assertEq(check(pair(s)), FAILED);
    }

    function test_oneStockForAnother() public {
        assertEq(check(pair(swap(AAPL, NVDA, 1e8))), FAILED);
    }

    function test_paidToSomeoneElse() public {
        TradeShape.Swap memory s = swap(USDC, NVDA, 50e6);
        s.recipient = address(0xBAD);
        assertEq(check(pair(s)), FAILED);
    }

    function test_withNoMinimumOutput() public {
        TradeShape.Swap memory s = swap(USDC, NVDA, 50e6);
        s.amountOutMinimum = 0;
        assertEq(check(pair(s)), FAILED);
    }

    function test_withAPriceLimit() public {
        TradeShape.Swap memory s = swap(USDC, NVDA, 50e6);
        s.sqrtPriceLimitX96 = 1;
        assertEq(check(pair(s)), FAILED);
    }

    function test_ofNothing() public {
        assertEq(check(sell(NVDA, 0)), FAILED);
    }

    function test_aBuyOverTheMostPerBuy() public {
        assertEq(check(buy(NVDA, 100e6 + 1)), FAILED);
    }

    function test_aSellByABuyOnlyAgent() public {
        policy.initializeWithMultiplexer(ACCOUNT, OPERATION_ID, abi.encode(policy.OPERATION(), settings(0)));
        assertEq(check(sell(NVDA, 1e8)), FAILED);
    }

    function test_aBuyByASellOnlyAgent() public {
        policy.initializeWithMultiplexer(ACCOUNT, OPERATION_ID, abi.encode(policy.OPERATION(), settings(1)));
        assertEq(check(buy(NVDA, 50e6)), FAILED);
    }

    // The daily budget ----------------------------------------------------------------------------------------------

    function test_buysAddUpToTheDailyBudget() public {
        check(buy(NVDA, 100e6));
        check(buy(AAPL, 100e6));

        assertEq(check(buy(NVDA, 50e6)), Period.bounds(1 days, NOW));
        assertEq(policy.spent(OPERATION_ID, address(this), ACCOUNT, NOW), 250e6);
    }

    function test_aBuyPastTheDailyBudget() public {
        check(buy(NVDA, 100e6));
        check(buy(AAPL, 100e6));

        assertEq(check(buy(NVDA, 50e6 + 1)), FAILED);
    }

    function test_theBudgetStartsAgainTheNextUtcDay() public {
        check(buy(NVDA, 100e6));
        check(buy(AAPL, 100e6));
        uint256 tomorrow = (NOW / 1 days + 1) * 1 days;

        assertEq(policy.checkUserOpPolicy(OPERATION_ID, operation(buy(NVDA, 100e6), tomorrow)), Period.bounds(1 days, tomorrow));
        assertEq(policy.spent(OPERATION_ID, address(this), ACCOUNT, tomorrow), 100e6);
    }

    function test_aBuyWithoutAStatedTime() public {
        ERC4337.PackedUserOperation memory op = operation(buy(NVDA, 50e6), NOW);
        op.callData = abi.encodeWithSelector(UserOpCalls.EXECUTE, bytes32(uint256(1) << 248), abi.encode(buy(NVDA, 50e6)));

        assertEq(policy.checkUserOpPolicy(OPERATION_ID, op), FAILED);
    }

    // Roles ---------------------------------------------------------------------------------------------------------

    function test_anAllowedCallWithoutValuePasses() public view {
        assertEq(policy.checkAction(ACTION_ID, ACCOUNT, ROUTER, 0, ""), 0);
    }

    function test_anAllowedCallWithValueFails() public view {
        assertEq(policy.checkAction(ACTION_ID, ACCOUNT, ROUTER, 1, ""), FAILED);
    }

    function test_anOperationCheckedUnderTheActionsConfiguration() public {
        assertEq(policy.checkUserOpPolicy(ACTION_ID, operation(buy(NVDA, 50e6), NOW)), FAILED);
    }

    function test_aCheckForAnAccountWithoutAConfiguration() public {
        vm.expectRevert(abi.encodeWithSelector(IPolicy.PolicyNotInitialized.selector, ACTION_ID, address(this), address(0xBEEF)));
        policy.checkAction(ACTION_ID, address(0xBEEF), ROUTER, 0, "");
    }

    function test_aConfigurationWithAnUnknownRole() public {
        vm.expectRevert(abi.encodeWithSelector(AerodromeTradePolicy.InvalidRole.selector, 7));
        policy.initializeWithMultiplexer(ACCOUNT, ACTION_ID, abi.encode(uint8(7)));
    }

    function test_reportsBothPolicyKinds() public view {
        assertTrue(policy.supportsInterface(0x01ffc9a7));
        assertTrue(policy.supportsInterface(type(IPolicy).interfaceId));
    }
}
