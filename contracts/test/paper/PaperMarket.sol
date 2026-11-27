// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {PaperFactory} from "../../src/paper/PaperFactory.sol";
import {PaperFeed} from "../../src/paper/PaperFeed.sol";
import {PaperFeedWriter} from "../../src/paper/PaperFeedWriter.sol";
import {PaperPool} from "../../src/paper/PaperPool.sol";
import {PaperQuoter} from "../../src/paper/PaperQuoter.sol";
import {PaperRouter} from "../../src/paper/PaperRouter.sol";
import {TestStock} from "../../src/paper/TestStock.sol";
import {TestUsdc} from "../../src/paper/TestUsdc.sol";

/// @dev Paper's market as the deploy sets it up, with the tokens at addresses ordered like Base's (USDC below NVDA,
/// so USDC is token0) and one stock below USDC (token1): NVDA at $150 and AAPL at $200, 0.03% fee, tick spacing 10.
abstract contract PaperMarket is Test {
    address internal constant OPERATOR = address(0x0FE);
    address internal constant TRADER = address(0x7AD);
    uint256 internal constant NOW = 1_800_000_000;
    int24 internal constant TICK_SPACING = 10;
    uint24 internal constant FEE = 300;

    TestUsdc internal usdc;
    TestStock internal nvda;
    TestStock internal aapl;
    PaperFeedWriter internal writer;
    PaperFeed internal nvdaFeed;
    PaperFeed internal aaplFeed;
    PaperFactory internal factory;
    PaperRouter internal router;
    PaperQuoter internal quoter;
    PaperPool internal nvdaPool;
    PaperPool internal aaplPool;

    function setUp() public virtual {
        vm.warp(NOW);
        usdc = TestUsdc(deploy("TestUsdc.sol:TestUsdc", abi.encode(OPERATOR), address(0x8300)));
        nvda = TestStock(deploy("TestStock.sol:TestStock", abi.encode(OPERATOR, "NVIDIA", "NVDA"), address(0xB200)));
        aapl = TestStock(deploy("TestStock.sol:TestStock", abi.encode(OPERATOR, "Apple", "AAPL"), address(0x0A00)));
        writer = new PaperFeedWriter(OPERATOR);
        nvdaFeed = new PaperFeed(address(writer), "NVDA / USD");
        aaplFeed = new PaperFeed(address(writer), "AAPL / USD");
        factory = new PaperFactory(OPERATOR, address(usdc));
        router = new PaperRouter(address(factory));
        quoter = new PaperQuoter();

        vm.startPrank(OPERATOR);
        nvdaPool = PaperPool(factory.createPool(address(nvda), address(nvdaFeed), TICK_SPACING, FEE));
        aaplPool = PaperPool(factory.createPool(address(aapl), address(aaplFeed), TICK_SPACING, FEE));
        usdc.setMinter(address(nvdaPool), true);
        usdc.setMinter(address(aaplPool), true);
        nvda.setMinter(address(nvdaPool), true);
        aapl.setMinter(address(aaplPool), true);
        writer.push(feeds(), answers(150e8, 200e8));
        usdc.mint(TRADER, 1_000_000e6);
        nvda.mint(TRADER, 10e8);
        vm.stopPrank();
    }

    function deploy(string memory artifact, bytes memory args, address at) internal returns (address) {
        deployCodeTo(artifact, args, at);
        return at;
    }

    function feeds() internal view returns (PaperFeed[] memory list) {
        list = new PaperFeed[](2);
        (list[0], list[1]) = (nvdaFeed, aaplFeed);
    }

    function answers(int256 nvdaAnswer, int256 aaplAnswer) internal pure returns (int256[] memory list) {
        list = new int256[](2);
        (list[0], list[1]) = (nvdaAnswer, aaplAnswer);
    }

    function params(address tokenIn, address tokenOut, uint256 amountIn, uint256 minimumOut)
        internal
        view
        returns (PaperRouter.ExactInputSingleParams memory)
    {
        return PaperRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            tickSpacing: TICK_SPACING,
            recipient: TRADER,
            deadline: block.timestamp + 120,
            amountIn: amountIn,
            amountOutMinimum: minimumOut,
            sqrtPriceLimitX96: 0
        });
    }

    /// @dev The trader's swap through the router, approving exactly what goes in.
    function trade(PaperRouter.ExactInputSingleParams memory p) internal returns (uint256) {
        vm.startPrank(TRADER);
        TestUsdc(p.tokenIn).approve(address(router), p.amountIn);
        uint256 amountOut = router.exactInputSingle(p);
        vm.stopPrank();
        return amountOut;
    }
}
