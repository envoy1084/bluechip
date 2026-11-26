// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {Holding, Valuation} from "../src/rules/IOutcomeRule.sol";
import {StopLossFloorRule} from "../src/rules/StopLossFloorRule.sol";

/// @dev A Stop-loss guard over three stocks, floors of $150 for NVDA, none for AAPL and $200 for TSLA, holding 5 NVDA
/// and 2 AAPL; each test sells or buys one of them.
contract StopLossFloorRuleTest is Test {
    StopLossFloorRule internal rule = new StopLossFloorRule();

    address internal constant NVDA = address(0xA1);
    address internal constant AAPL = address(0xA2);

    function floors() internal pure returns (bytes memory) {
        uint256[] memory prices = new uint256[](3);
        prices[0] = 150e8;
        prices[1] = 0;
        prices[2] = 200e8;
        return abi.encode(StopLossFloorRule.Config(prices));
    }

    /// @dev One stock moved from `before` to `afterward` shares at `price`, NVDA's index 0 or AAPL's 1.
    function moved(uint256 index, uint256 before, uint256 afterward, uint256 price)
        internal
        pure
        returns (Valuation memory valuation)
    {
        valuation.holdings = new Holding[](1);
        valuation.holdings[0] = Holding(index, index == 0 ? NVDA : AAPL, before, afterward, price);
    }

    function test_aSaleAtTheFloorPasses() public view {
        rule.check(moved(0, 5e8, 4e8, 150e8), floors(), 0, address(0));
    }

    function test_aSaleJustUnderTheFloorPasses() public view {
        rule.check(moved(0, 5e8, 4e8, 150e8 - 1), floors(), 0, address(0));
    }

    function test_aSaleJustAboveTheFloor() public {
        vm.expectRevert(abi.encodeWithSelector(StopLossFloorRule.AboveFloor.selector, NVDA));
        rule.check(moved(0, 5e8, 4e8, 150e8 + 1), floors(), 0, address(0));
    }

    function test_aSaleOfAStockWithNoFloor() public {
        vm.expectRevert(abi.encodeWithSelector(StopLossFloorRule.AboveFloor.selector, AAPL));
        rule.check(moved(1, 2e8, 1e8, 1), floors(), 0, address(0));
    }

    function test_aBuyAboveTheFloorPasses() public view {
        rule.check(moved(0, 5e8, 6e8, 500e8), floors(), 0, address(0));
    }

    function test_aStockHeldButNotSoldIsIgnored() public view {
        rule.check(moved(1, 2e8, 2e8, 500e8), floors(), 0, address(0));
    }

    function test_aSaleOfAStockWithoutAFloorConfigured() public {
        uint256[] memory prices = new uint256[](1);
        prices[0] = 150e8;

        vm.expectRevert(StopLossFloorRule.FloorsMismatch.selector);
        rule.check(moved(1, 2e8, 1e8, 100e8), abi.encode(StopLossFloorRule.Config(prices)), 0, address(0));
    }
}
