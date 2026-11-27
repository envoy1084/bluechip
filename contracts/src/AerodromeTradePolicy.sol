// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {IUserOpPolicy} from "namera/policies/interfaces/IPolicy.sol";
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
/// @dev The session's user operation policy (init data `abi.encode(TradeShape.Settings, bytes32 agent)`): it checks
/// every call of every operation, so the session lets calls through Namera's `AllowPolicy` as its fallback action
/// instead of an action policy per call, which would only repeat this check and cost a session entry per stock.
/// Storage is Namera's `PolicyStorage`, associated with the account (ERC-7562), packed (`_pack`); the daily budget
/// charges the period of the agent's stated time, as Namera's `LimitPolicy` does, and returns its bounds. The day's
/// counter is keyed by the agent (`agent`, the same in every session of one agent) rather than the session, so a
/// renewal's new session starts from what the agent already spent today; keyed by the multiplexer too, so no other
/// caller can charge it.
// slither-disable-next-line missing-inheritance
contract AerodromeTradePolicy is PolicyBase, IUserOpPolicy {
    /// @notice One UTC day: the daily budget's period.
    uint256 public constant DAY = 1 days;

    /// @dev Counters keep a period index above a 208-bit amount, as `LimitPolicy`.
    uint256 private constant AMOUNT_BITS = 208;
    uint256 private constant AMOUNT_MASK = (1 << AMOUNT_BITS) - 1;
    bytes32 private constant DAILY_BUYS = keccak256("bluechip.daily-buys");

    /// @dev The most per buy and the daily budget share a word with the mode: each fits in 124 bits (about 2 * 10^31
    /// dollars).
    uint256 private constant LIMIT_BITS = 124;

    address public immutable USDC;
    address public immutable ROUTER;

    /// @notice A configured limit doesn't fit in its 124 bits.
    error LimitTooLarge();

    // Deployed only by `contracts deploy`, with Base's addresses: the CREATE2 address fixes them.
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address usdc, address router) {
        USDC = usdc;
        ROUTER = router;
    }

    /// @inheritdoc IUserOpPolicy
    function checkUserOpPolicy(bytes32 id, ERC4337.PackedUserOperation calldata userOp) external returns (uint256) {
        bytes memory packed = _config(id, userOp.sender);
        TradeShape.Settings memory settings = _settings(packed);

        UserOpCalls.Call[] memory calls = UserOpCalls.decode(userOp.callData, userOp.sender);
        (bool ok, uint256 buys) = TradeShape.check(settings, calls, userOp.sender, USDC, ROUTER);
        if (!ok) return VALIDATION_FAILED;

        return _chargeDay(bytes32(_wordAt(packed, 1)), userOp, buys, settings.dailyBudget);
    }

    /// @notice What `account`'s agent has spent on buys in the UTC day containing `time`, in any of its sessions,
    /// read through the configuration `id` that `multiplexer` set. Lets bluechip show what's left of an agent's budget.
    function spent(bytes32 id, address multiplexer, address account, uint256 time) external view returns (uint256) {
        (bool exists, bytes memory packed) = PolicyStorage.read($, PolicyStorage.configKey(id, multiplexer), account);
        if (!exists) return 0;
        bytes32 counter = _dayCounter(bytes32(_wordAt(packed, 1)), multiplexer);
        (uint256 latest, uint256 used) = _unpack(_counterOf(counter, account));
        return latest == Period.index(DAY, time) ? used : 0;
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(IUserOpPolicy).interfaceId;
    }

    /// @dev One word of settings (the mode, the most per buy from bit 8, the daily budget from bit 132), the agent, then
    /// one per market (its token, and its tick spacing from bit 160).
    function _pack(bytes calldata initData) internal pure override returns (bytes memory packed) {
        (TradeShape.Settings memory settings, bytes32 agent) = abi.decode(initData, (TradeShape.Settings, bytes32));
        if (settings.maxUsdcIn >> LIMIT_BITS != 0 || settings.dailyBudget >> LIMIT_BITS != 0) revert LimitTooLarge();

        packed = new bytes(32 * (2 + settings.markets.length));
        _setWordAt(
            packed,
            0,
            uint256(settings.mode) | uint256(settings.maxUsdcIn) << 8 | uint256(settings.dailyBudget)
                << (8 + LIMIT_BITS)
        );
        _setWordAt(packed, 1, uint256(agent));
        for (uint256 i = 0; i < settings.markets.length; ++i) {
            TradeShape.Market memory market = settings.markets[i];
            // The tick spacing's 24 bits as they are, sign included; `_settings` reads them back as an int24.
            // forge-lint: disable-next-line(unsafe-typecast)
            _setWordAt(packed, 2 + i, uint256(uint160(market.token)) | uint256(uint24(market.tickSpacing)) << 160);
        }
    }

    // Each field is cut back to the width `_pack` gave it.
    // forge-lint: disable-start(unsafe-typecast)
    /// @dev The settings `_pack` stored.
    function _settings(bytes memory packed) internal pure returns (TradeShape.Settings memory settings) {
        uint256 head = _wordAt(packed, 0);
        settings.mode = uint8(head);
        settings.maxUsdcIn = uint128((head >> 8) & ((1 << LIMIT_BITS) - 1));
        settings.dailyBudget = uint128(head >> (8 + LIMIT_BITS));

        settings.markets = new TradeShape.Market[](packed.length / 32 - 2);
        for (uint256 i = 0; i < settings.markets.length; ++i) {
            uint256 word = _wordAt(packed, 2 + i);
            settings.markets[i] = TradeShape.Market(address(uint160(word)), int24(uint24(word >> 160)));
        }
    }

    // forge-lint: disable-end(unsafe-typecast)

    /// @dev Charges `buys` to `agent`'s day of its stated time, failing past `budget` or without a stated time.
    function _chargeDay(bytes32 agent, ERC4337.PackedUserOperation calldata userOp, uint256 buys, uint256 budget)
        private
        returns (uint256)
    {
        if (buys == 0) return VALIDATION_SUCCESS;

        (bool hasTime, uint256 time) = UserOpCalls.timestamp(userOp.callData);
        if (!hasTime) return VALIDATION_FAILED;

        bytes32 counter = _dayCounter(agent, msg.sender);
        uint256 index = Period.index(DAY, time);
        (uint256 latest, uint256 used) = _unpack(_counterOf(counter, userOp.sender));
        // A later day already charged can't be the EntryPoint's present; it would reject the operation's bounds.
        if (latest > index) return VALIDATION_FAILED;
        if (latest < index) used = 0;
        if (used > budget || buys > budget - used) return VALIDATION_FAILED;

        _setCounter(counter, userOp.sender, (index << AMOUNT_BITS) | (used + buys));
        return Period.bounds(DAY, time);
    }

    function _dayCounter(bytes32 agent, address multiplexer) private pure returns (bytes32) {
        return keccak256(abi.encode(PolicyStorage.configKey(agent, multiplexer), DAILY_BUYS, DAY));
    }

    function _unpack(uint256 word) private pure returns (uint256 index, uint256 used) {
        return (word >> AMOUNT_BITS, word & AMOUNT_MASK);
    }
}
