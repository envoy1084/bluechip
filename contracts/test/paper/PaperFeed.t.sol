// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Ownable} from "solady/auth/Ownable.sol";

import {PaperFeed} from "../../src/paper/PaperFeed.sol";
import {PaperFeedWriter} from "../../src/paper/PaperFeedWriter.sol";
import {SequencerUptimeStub} from "../../src/paper/SequencerUptimeStub.sol";
import {PaperMarket} from "./PaperMarket.sol";

contract PaperFeedTest is PaperMarket {
    function test_aFeedReadsLikeAChainlinkStockFeed() public view {
        assertEq(nvdaFeed.decimals(), 8);
        assertEq(nvdaFeed.description(), "NVDA / USD");
        assertEq(nvdaFeed.version(), 4);
    }

    function test_theLatestRoundIsTheLastPush() public {
        vm.warp(NOW + 60);
        vm.prank(OPERATOR);
        writer.push(feeds(), answers(151e8, 199e8));

        (uint80 round, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredIn) =
            nvdaFeed.latestRoundData();
        assertEq(round, 2);
        assertEq(answer, 151e8);
        assertEq(startedAt, NOW + 60);
        assertEq(updatedAt, NOW + 60);
        assertEq(answeredIn, 2);
        (, int256 aaplAnswer,,,) = aaplFeed.latestRoundData();
        assertEq(aaplAnswer, 199e8);
    }

    function test_theLatestRoundReadsByItsId() public view {
        (uint80 round, int256 answer,, uint256 updatedAt,) = nvdaFeed.getRoundData(1);
        assertEq(round, 1);
        assertEq(answer, 150e8);
        assertEq(updatedAt, NOW);
    }

    function test_anEarlierRoundIsntKept() public {
        vm.prank(OPERATOR);
        writer.push(feeds(), answers(151e8, 199e8));

        vm.expectRevert(PaperFeed.NoDataPresent.selector);
        nvdaFeed.getRoundData(1);
    }

    function test_aFeedNeverWrittenHasNoRound() public {
        PaperFeed fresh = new PaperFeed(address(writer), "TSLA / USD");
        (uint80 round, int256 answer,, uint256 updatedAt,) = fresh.latestRoundData();
        assertEq(round, 0);
        assertEq(answer, 0);
        assertEq(updatedAt, 0);
    }

    function test_onlyTheOwnerPushes() public {
        vm.prank(TRADER);
        vm.expectRevert(Ownable.Unauthorized.selector);
        writer.push(feeds(), answers(1e8, 1e8));
    }

    function test_aFeedTrustsOnlyItsWriter() public {
        vm.prank(OPERATOR);
        vm.expectRevert(PaperFeed.NotWriter.selector);
        nvdaFeed.write(1e8);
    }

    function test_aPushOfMismatchedLengths() public {
        vm.prank(OPERATOR);
        vm.expectRevert(PaperFeedWriter.LengthMismatch.selector);
        writer.push(feeds(), new int256[](1));
    }

    function test_aZeroPriceIsRefused() public {
        vm.prank(OPERATOR);
        vm.expectRevert(PaperFeed.InvalidAnswer.selector);
        writer.push(feeds(), answers(150e8, 0));
    }

    function test_theSequencerIsAlwaysUpSinceLongAgo() public {
        SequencerUptimeStub sequencer = new SequencerUptimeStub();
        (, int256 answer, uint256 startedAt,,) = sequencer.latestRoundData();
        assertEq(answer, 0);
        assertEq(startedAt, 1_700_000_000);
    }
}
