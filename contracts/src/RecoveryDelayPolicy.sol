// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {IActionPolicy} from "namera/policies/interfaces/IPolicy.sol";
import {PolicyBase, VALIDATION_FAILED} from "namera/policies/lib/PolicyBase.sol";

/// @title RecoveryDelayPolicy
/// @notice bluechip's account recovery delay. A recovery key's session may change the account's owners only with a
/// call the account asked for, by its hash, at least the configured delay before, and that nobody cancelled since.
/// During the wait the account (any owner, or a key allowed to cancel) can cancel the request.
/// @dev An action policy (init data `abi.encode(uint256 delay)`) on each owner change the recovery session may make.
/// Validation can't read the clock (ERC-7562), so `checkAction` returns the request's due time as ERC-4337
/// `validAfter` and the EntryPoint refuses the operation before it. Each request is consumed when an operation uses
/// it, so a recovery can't be replayed later. Requests are keyed `callHash => account`, associated with the account.
// slither-disable-next-line missing-inheritance
contract RecoveryDelayPolicy is PolicyBase, IActionPolicy {
    /// @notice The shortest delay a recovery may have.
    uint256 public constant MIN_DELAY = 1 days;

    /// @dev ERC-4337 validation data keeps `validAfter` in its top 48 bits.
    uint256 private constant VALID_AFTER_SHIFT = 208;

    mapping(bytes32 callHash => mapping(address account => uint256 requestedAt)) internal $requests;

    event RecoveryRequested(address indexed account, bytes32 indexed callHash);
    event RecoveryCancelled(address indexed account, bytes32 indexed callHash);
    event RecoveryUsed(address indexed account, bytes32 indexed callHash);

    /// @notice The configured delay is under `MIN_DELAY`, or too long to add to a time.
    error InvalidDelay(uint256 delay);
    /// @notice There is no request for this call to cancel.
    error NotRequested(bytes32 callHash);

    /// @notice Asks for the calls `callHashes` (`callHash(target, data)`) on behalf of the calling account; each may be
    /// made once its delay has passed. Asking again starts the wait again.
    function request(bytes32[] calldata callHashes) external {
        uint256 length = callHashes.length;
        for (uint256 i; i < length; ++i) {
            $requests[callHashes[i]][msg.sender] = block.timestamp;
            emit RecoveryRequested(msg.sender, callHashes[i]);
        }
    }

    /// @notice Cancels the calling account's requests for `callHashes`.
    function cancel(bytes32[] calldata callHashes) external {
        uint256 length = callHashes.length;
        for (uint256 i; i < length; ++i) {
            if ($requests[callHashes[i]][msg.sender] == 0) revert NotRequested(callHashes[i]);
            delete $requests[callHashes[i]][msg.sender];
            emit RecoveryCancelled(msg.sender, callHashes[i]);
        }
    }

    /// @notice When `account` asked for the call `hash`, or 0 when it has no such request.
    function requestedAt(address account, bytes32 hash) external view returns (uint256) {
        return $requests[hash][account];
    }

    /// @notice The hash a request names a call by: its target and calldata.
    function callHash(address target, bytes calldata data) public pure returns (bytes32) {
        return keccak256(abi.encode(target, data));
    }

    /// @inheritdoc IActionPolicy
    function checkAction(bytes32 id, address account, address target, uint256 value, bytes calldata data)
        external
        returns (uint256)
    {
        uint256 delay = _wordAt(_config(id, account), 0);
        if (value != 0) return VALIDATION_FAILED;

        bytes32 hash = callHash(target, data);
        uint256 at = $requests[hash][account];
        if (at == 0) return VALIDATION_FAILED;

        delete $requests[hash][account];
        // No external call precedes this: the lint reads the internal `callHash` call as one.
        // forge-lint: disable-next-line(reentrancy-events)
        emit RecoveryUsed(account, hash);
        return (at + delay) << VALID_AFTER_SHIFT;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId;
    }

    function _pack(bytes calldata initData) internal pure override returns (bytes memory) {
        uint256 delay = abi.decode(initData, (uint256));
        if (delay < MIN_DELAY || delay > type(uint32).max) revert InvalidDelay(delay);
        return abi.encode(delay);
    }
}
