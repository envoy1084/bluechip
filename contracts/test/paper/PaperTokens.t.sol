// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Ownable} from "solady/auth/Ownable.sol";

import {MintableToken} from "../../src/paper/MintableToken.sol";
import {PaperMarket} from "./PaperMarket.sol";

contract PaperTokensTest is PaperMarket {
    function test_testUsdcReadsLikeUsdc() public view {
        assertEq(usdc.name(), "Test USDC");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
    }

    function test_aTestStockReadsLikeACoinbaseStockToken() public view {
        assertEq(nvda.name(), "NVIDIA");
        assertEq(nvda.symbol(), "NVDA");
        assertEq(nvda.decimals(), 8);
        assertEq(nvda.multiplier(), 1e18);
        assertEq(nvda.scaledBalanceOf(TRADER), 10e8);
    }

    function test_theOwnerMints() public {
        vm.prank(OPERATOR);
        usdc.mint(address(0xBEEF), 1000e6);
        assertEq(usdc.balanceOf(address(0xBEEF)), 1000e6);
    }

    function test_aMinterMints() public {
        vm.prank(address(nvdaPool));
        nvda.mint(address(0xBEEF), 1e8);
        assertEq(nvda.balanceOf(address(0xBEEF)), 1e8);
    }

    function test_anyoneElseCantMint() public {
        vm.prank(TRADER);
        vm.expectRevert(MintableToken.NotMinter.selector);
        usdc.mint(TRADER, 1e6);
    }

    function test_aPoolCantMintAnotherPoolsStock() public {
        vm.prank(address(nvdaPool));
        vm.expectRevert(MintableToken.NotMinter.selector);
        aapl.mint(address(0xBEEF), 1e8);
    }

    function test_aRemovedMinterCantMint() public {
        vm.prank(OPERATOR);
        usdc.setMinter(address(nvdaPool), false);

        vm.prank(address(nvdaPool));
        vm.expectRevert(MintableToken.NotMinter.selector);
        usdc.mint(address(0xBEEF), 1e6);
    }

    function test_onlyTheOwnerSetsMinters() public {
        vm.prank(TRADER);
        vm.expectRevert(Ownable.Unauthorized.selector);
        usdc.setMinter(TRADER, true);
    }
}
