// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {IActionPolicy, IPolicy} from "namera/policies/interfaces/IPolicy.sol";

import {RecoveryDelayPolicy} from "../src/RecoveryDelayPolicy.sol";

/// @dev The test contract plays Smart Sessions (the multiplexer); `ACCOUNT` asks for and cancels its own requests. A
/// recovery adds one passkey after 48 hours.
contract RecoveryDelayPolicyTest is Test {
    address internal constant ACCOUNT = address(0xACC);
    address internal constant VALIDATOR = address(0x7A1);
    bytes32 internal constant CONFIG = keccak256("recovery");
    uint256 internal constant DELAY = 48 hours;
    uint256 internal constant NOW = 1_800_000_000;
    uint256 internal constant FAILED = 1;

    RecoveryDelayPolicy internal policy = new RecoveryDelayPolicy();
    bytes internal addPasskey = abi.encodeWithSignature("addPasskey((bytes32,bytes32,bool,bytes32))", 1, 2, true, 3);

    function setUp() public {
        vm.warp(NOW);
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG, abi.encode(DELAY));
    }

    function hashes(bytes memory data) internal view returns (bytes32[] memory list) {
        list = new bytes32[](1);
        list[0] = policy.callHash(VALIDATOR, data);
    }

    function requestAsAccount(bytes memory data) internal {
        bytes32[] memory list = hashes(data);
        vm.prank(ACCOUNT);
        policy.request(list);
    }

    function check(bytes memory data) internal returns (uint256) {
        return policy.checkAction(CONFIG, ACCOUNT, VALIDATOR, 0, data);
    }

    // Configuration --------------------------------------------------------------------------------------------------

    function test_supportsTheActionPolicyInterface() public view {
        assertTrue(policy.supportsInterface(type(IActionPolicy).interfaceId));
        assertTrue(policy.supportsInterface(type(IPolicy).interfaceId));
    }

    function test_refusesADelayUnderADay() public {
        vm.expectRevert(abi.encodeWithSelector(RecoveryDelayPolicy.InvalidDelay.selector, 1 days - 1));
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG, abi.encode(1 days - 1));
    }

    function test_acceptsADelayOfExactlyADay() public {
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG, abi.encode(1 days));
        requestAsAccount(addPasskey);
        assertEq(check(addPasskey), (NOW + 1 days) << 208);
    }

    function test_refusesADelayTooLongToAddToATime() public {
        uint256 delay = uint256(type(uint32).max) + 1;
        vm.expectRevert(abi.encodeWithSelector(RecoveryDelayPolicy.InvalidDelay.selector, delay));
        policy.initializeWithMultiplexer(ACCOUNT, CONFIG, abi.encode(delay));
    }

    function test_revertsForAnAccountWithoutAConfiguration() public {
        vm.expectRevert(
            abi.encodeWithSelector(IPolicy.PolicyNotInitialized.selector, CONFIG, address(this), address(0xB0B))
        );
        policy.checkAction(CONFIG, address(0xB0B), VALIDATOR, 0, addPasskey);
    }

    function test_revertsForAnotherMultiplexer() public {
        requestAsAccount(addPasskey);
        vm.prank(address(0xBAD));
        vm.expectRevert(abi.encodeWithSelector(IPolicy.PolicyNotInitialized.selector, CONFIG, address(0xBAD), ACCOUNT));
        policy.checkAction(CONFIG, ACCOUNT, VALIDATOR, 0, addPasskey);
        assertEq(policy.requestedAt(ACCOUNT, policy.callHash(VALIDATOR, addPasskey)), NOW);
    }

    // Requests -------------------------------------------------------------------------------------------------------

    function test_refusesACallNobodyAskedFor() public {
        assertEq(check(addPasskey), FAILED);
    }

    function test_aRequestedCallIsValidOnlyAfterTheDelay() public {
        requestAsAccount(addPasskey);
        assertEq(check(addPasskey), (NOW + DELAY) << 208);
    }

    function test_theDueTimeCountsFromTheRequest() public {
        vm.warp(NOW + 5 hours);
        requestAsAccount(addPasskey);
        assertEq(check(addPasskey), (NOW + 5 hours + DELAY) << 208);
    }

    function test_askingAgainStartsTheWaitAgain() public {
        requestAsAccount(addPasskey);
        vm.warp(NOW + 40 hours);
        requestAsAccount(addPasskey);
        assertEq(check(addPasskey), (NOW + 40 hours + DELAY) << 208);
    }

    function test_aRequestIsUsedOnce() public {
        requestAsAccount(addPasskey);
        check(addPasskey);
        assertEq(check(addPasskey), FAILED);
        assertEq(policy.requestedAt(ACCOUNT, policy.callHash(VALIDATOR, addPasskey)), 0);
    }

    function test_aRequestCoversOnlyItsExactCall() public {
        requestAsAccount(addPasskey);
        bytes memory other = abi.encodeWithSignature("addPasskey((bytes32,bytes32,bool,bytes32))", 9, 2, true, 3);
        assertEq(check(other), FAILED);
    }

    function test_aRequestCoversOnlyItsTarget() public {
        requestAsAccount(addPasskey);
        assertEq(policy.checkAction(CONFIG, ACCOUNT, address(0xD0D), 0, addPasskey), FAILED);
    }

    function test_refusesACallSendingValue() public {
        requestAsAccount(addPasskey);
        assertEq(policy.checkAction(CONFIG, ACCOUNT, VALIDATOR, 1, addPasskey), FAILED);
    }

    function test_anotherAccountsRequestDoesNotCount() public {
        bytes32[] memory list = hashes(addPasskey);
        vm.prank(address(0xB0B));
        policy.request(list);
        assertEq(check(addPasskey), FAILED);
    }

    function test_requestsEachCallOfABatch() public {
        bytes memory removePasskey = abi.encodeWithSignature("removePasskey(bytes32)", bytes32(uint256(7)));
        bytes32[] memory both = new bytes32[](2);
        both[0] = policy.callHash(VALIDATOR, addPasskey);
        both[1] = policy.callHash(VALIDATOR, removePasskey);
        vm.prank(ACCOUNT);
        policy.request(both);
        assertEq(check(addPasskey), (NOW + DELAY) << 208);
        assertEq(check(removePasskey), (NOW + DELAY) << 208);
    }

    function test_emitsTheRequest() public {
        bytes32[] memory list = hashes(addPasskey);
        vm.expectEmit(address(policy));
        emit RecoveryDelayPolicy.RecoveryRequested(ACCOUNT, list[0]);
        vm.prank(ACCOUNT);
        policy.request(list);
    }

    // Cancelling -----------------------------------------------------------------------------------------------------

    function test_aCancelledRequestNoLongerCounts() public {
        requestAsAccount(addPasskey);
        bytes32[] memory list = hashes(addPasskey);
        vm.prank(ACCOUNT);
        policy.cancel(list);
        assertEq(check(addPasskey), FAILED);
    }

    function test_cancellingWhatWasNeverAskedReverts() public {
        bytes32[] memory list = hashes(addPasskey);
        vm.prank(ACCOUNT);
        vm.expectRevert(abi.encodeWithSelector(RecoveryDelayPolicy.NotRequested.selector, list[0]));
        policy.cancel(list);
    }

    function test_onlyTheAccountCancelsItsRequest() public {
        requestAsAccount(addPasskey);
        bytes32[] memory list = hashes(addPasskey);
        vm.prank(address(0xB0B));
        vm.expectRevert(abi.encodeWithSelector(RecoveryDelayPolicy.NotRequested.selector, list[0]));
        policy.cancel(list);
        assertEq(policy.requestedAt(ACCOUNT, list[0]), NOW);
    }

    function test_emitsTheCancellation() public {
        requestAsAccount(addPasskey);
        bytes32[] memory list = hashes(addPasskey);
        vm.expectEmit(address(policy));
        emit RecoveryDelayPolicy.RecoveryCancelled(ACCOUNT, list[0]);
        vm.prank(ACCOUNT);
        policy.cancel(list);
    }
}
