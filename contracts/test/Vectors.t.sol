// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

import {TradeShape} from "../src/lib/TradeShape.sol";
import {GuardPipeline} from "./utils/GuardInput.sol";
import {RulesHarness} from "./utils/Mocks.sol";

/// @notice bluechip's agent-rule vectors (`test/vectors.json`, a fixture): `TradeGuard`'s checks and rules and
/// `AerodromeTradePolicy`'s call shapes each give the recorded answer.
contract VectorsTest is Test {
    RulesHarness internal rules = new RulesHarness();
    GuardPipeline internal guard = new GuardPipeline();

    function test_everyGuardVector() public view {
        string memory json = vm.readFile("test/vectors.json");
        uint256 count = _length(json, ".guard");
        assertGt(count, 0);

        for (uint256 i; i < count; ++i) {
            string memory path = string.concat(".guard[", vm.toString(i), "]");
            string memory name = vm.parseJsonString(json, string.concat(path, ".name"));
            bytes memory input = vm.parseJsonBytes(json, string.concat(path, ".input"));
            bytes memory expected = vm.parseJsonBytes(json, string.concat(path, ".error"));

            try guard.checkEncoded(input) {
                assertEq(expected.length, 0, string.concat(name, ": passed, but should revert"));
            } catch (bytes memory reason) {
                assertEq(expected.length, 4, string.concat(name, ": reverted, but should pass"));
                assertEq(bytes4(reason), bytes4(expected), name);
            }
        }
    }

    function test_everyShapeVector() public view {
        string memory json = vm.readFile("test/vectors.json");
        address account = vm.parseJsonAddress(json, ".account");
        address usdc = vm.parseJsonAddress(json, ".usdc");
        address router = vm.parseJsonAddress(json, ".router");
        uint256 count = _length(json, ".shape");
        assertGt(count, 0);

        for (uint256 i; i < count; ++i) {
            string memory path = string.concat(".shape[", vm.toString(i), "]");
            string memory name = vm.parseJsonString(json, string.concat(path, ".name"));
            TradeShape.Settings memory settings =
                abi.decode(vm.parseJsonBytes(json, string.concat(path, ".settings")), (TradeShape.Settings));
            UserOpCalls.Call[] memory calls =
                abi.decode(vm.parseJsonBytes(json, string.concat(path, ".calls")), (UserOpCalls.Call[]));

            (bool ok, uint256 buys) = rules.shape(settings, calls, account, usdc, router);

            assertEq(ok, vm.parseJsonBool(json, string.concat(path, ".ok")), name);
            assertEq(buys, vm.parseJsonUint(json, string.concat(path, ".buys")), name);
        }
    }

    function _length(string memory json, string memory key) internal view returns (uint256 count) {
        while (vm.keyExistsJson(json, string.concat(key, "[", vm.toString(count), "]"))) ++count;
    }
}
