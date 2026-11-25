// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IActionPolicy, IUserOpPolicy} from "namera/policies/interfaces/IPolicy.sol";
import {Period} from "namera/policies/lib/Period.sol";
import {PolicyBase, VALIDATION_FAILED, VALIDATION_SUCCESS} from "namera/policies/lib/PolicyBase.sol";
import {PolicyStorage} from "namera/policies/lib/PolicyStorage.sol";
import {UserOpCalls} from "namera/policies/lib/UserOpCalls.sol";

import {TradeShape} from "./lib/TradeShape.sol";

/// @title AerodromeTradePolicy
/// @notice bluechip's validation policy for an agent's session: the agent may only trade its stocks against USDC
/// through Aerodrome's router, in its direction, up to its size per buy and its USDC per UTC day, with exact
/// approvals and every output paid back to the account. A failing operation is dropped by the bundler and costs
/// nothing.
/// @dev Registered twice in a session: as the action policy of each allowed call (the router's swap and `approve` on
/// USDC and the agent's stocks, init data `abi.encode(ACTION)`), and as its user operation policy (init data
/// `abi.encode(OPERATION, TradeShape.Settings)`), which checks the whole batch. Storage is Namera's
/// `PolicyStorage`, associated with the account (ERC-7562); the daily budget charges the period of the agent's stated
/// time, as Namera's `LimitPolicy` does, and returns its bounds.
// slither-disable-next-line missing-inheritance
contract AerodromeTradePolicy is PolicyBase, IActionPolicy, IUserOpPolicy {
    uint8 public constant ACTION = 0;
    uint8 public constant OPERATION = 1;

    /// @notice One UTC day: the daily budget's period.
    uint256 public constant DAY = 1 days;

    /// @dev Counters keep a period index above a 208-bit amount, as `LimitPolicy`.
    uint256 private constant AMOUNT_BITS = 208;
    uint256 private constant AMOUNT_MASK = (1 << AMOUNT_BITS) - 1;
    bytes32 private constant DAILY_BUYS = keccak256("bluechip.daily-buys");

    address public immutable USDC;
    address public immutable ROUTER;

    error InvalidRole(uint8 role);

    constructor(address usdc, address router) {
        USDC = usdc;
        ROUTER = router;
    }

    /// @inheritdoc IActionPolicy
    function checkAction(bytes32 id, address account, address, uint256 value, bytes calldata)
        external
        view
        returns (uint256)
    {
        _config(id, account);
        return value == 0 ? VALIDATION_SUCCESS : VALIDATION_FAILED;
    }

    /// @inheritdoc IUserOpPolicy
    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp)
        external
        returns (uint256)
    {
        bytes memory packed = _config(id, userOp.sender);
        if (uint8(_wordAt(packed, 0)) != OPERATION) return VALIDATION_FAILED;
        (, TradeShape.Settings memory settings) = abi.decode(packed, (uint8, TradeShape.Settings));

        UserOpCalls.Call[] memory calls = UserOpCalls.decode(userOp.callData, userOp.sender);
        (bool ok, uint256 buys) = TradeShape.check(settings, calls, userOp.sender, USDC, ROUTER);
        if (!ok) return VALIDATION_FAILED;

        return _chargeDay(id, userOp, buys, settings.dailyBudget);
    }

    /// @notice What `account` has spent on buys in the UTC day containing `time`, under the configuration `id` that
    /// `multiplexer` set. Lets bluechip show what's left of an agent's budget.
    function spent(bytes32 id, address multiplexer, address account, uint256 time) external view returns (uint256) {
        (uint256 latest, uint256 used) = _unpack(_counterOf(_dayCounter(id, multiplexer), account));
        return latest == Period.index(DAY, time) ? used : 0;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IActionPolicy).interfaceId || interfaceId == type(IUserOpPolicy).interfaceId;
    }

    /// @dev Keeps the init data as it is, after checking it decodes for its role.
    function _pack(bytes calldata initData) internal pure override returns (bytes memory) {
        uint8 role = abi.decode(initData[:32], (uint8));
        if (role == ACTION) return abi.encode(ACTION);
        if (role != OPERATION) revert InvalidRole(role);
        abi.decode(initData, (uint8, TradeShape.Settings));
        return initData;
    }

    /// @dev Charges `buys` to the day of the agent's stated time, failing past `budget` or without a stated time.
    function _chargeDay(bytes32 id, ERC4337.PackedUserOperation calldata userOp, uint256 buys, uint256 budget)
        private
        returns (uint256)
    {
        if (buys == 0) return VALIDATION_SUCCESS;

        (bool hasTime, uint256 time) = UserOpCalls.timestamp(userOp.callData);
        if (!hasTime) return VALIDATION_FAILED;

        bytes32 counter = _dayCounter(id, msg.sender);
        uint256 index = Period.index(DAY, time);
        (uint256 latest, uint256 used) = _unpack(_counterOf(counter, userOp.sender));
        // A later day already charged can't be the EntryPoint's present; it would reject the operation's bounds.
        if (latest > index) return VALIDATION_FAILED;
        if (latest < index) used = 0;
        if (used > budget || buys > budget - used) return VALIDATION_FAILED;

        _setCounter(counter, userOp.sender, (index << AMOUNT_BITS) | (used + buys));
        return Period.bounds(DAY, time);
    }

    function _dayCounter(bytes32 id, address multiplexer) private pure returns (bytes32) {
        return keccak256(abi.encode(PolicyStorage.configKey(id, multiplexer), DAILY_BUYS, DAY));
    }

    function _unpack(uint256 word) private pure returns (uint256 index, uint256 used) {
        return (word >> AMOUNT_BITS, word & AMOUNT_MASK);
    }
}
