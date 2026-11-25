// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ExecutionPolicyBase} from "namera/hooks/ExecutionPolicyBase.sol";
import {PolicyStorage} from "namera/policies/lib/PolicyStorage.sol";

import {GuardRules} from "./lib/GuardRules.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

interface IAggregator {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @title TradeGuard
/// @notice bluechip's execution policy for an agent's session, run by Namera's SessionHook around each operation:
/// it measures what the operation did to the account's balances and refuses it (reverting) unless the trade was at
/// a fair price against Chainlink, within the agent's sizes, left the portfolio within its caps, kept a Rebalancer
/// on course, and stayed within the agent's weekly slippage budget (`GuardRules`).
/// @dev Configuration (`abi.encode(Config)`, every stock the agent values with its feed, signed by the owner when
/// the agent is locked: no admin key) is written in enable mode during validation, so it uses Namera's
/// `PolicyStorage`, associated with the account. The slippage ledger is written during execution.
contract TradeGuard is ExecutionPolicyBase {
    using PolicyStorage for PolicyStorage.Layout;

    /// @notice A stock the agent's portfolio is valued over: its token, Chainlink feed, whether the agent may trade
    /// it, and its target (Rebalancer).
    struct Market {
        address token;
        address feed;
        bool allowed;
        uint16 targetBps;
    }

    /// @notice An agent's configuration.
    struct Config {
        GuardRules.Settings settings;
        Market[] markets;
    }

    /// @notice Base's sequencer was down, or came back less than the grace period ago: prices can't be trusted.
    error SequencerDown();

    address public immutable USDC;
    /// @notice Chainlink's L2 sequencer uptime feed (answer 0 while up, `startedAt` when that last changed).
    address public immutable SEQUENCER_FEED;
    uint256 public immutable SEQUENCER_GRACE;

    PolicyStorage.Layout internal $;
    /// @dev Each session's slippage ledger per account: the loss (low 128 bits) and when it was written.
    mapping(bytes32 key => mapping(address account => uint256 ledger)) internal $ledgers;

    uint256 private constant SETTINGS_WORDS = 2;

    // Deployed only by `contracts deploy`, with Base's addresses: the CREATE2 address fixes them.
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address usdc, address sequencerFeed, uint256 sequencerGrace) {
        USDC = usdc;
        SEQUENCER_FEED = sequencerFeed;
        SEQUENCER_GRACE = sequencerGrace;
    }

    /// @notice What `account` has lost to prices, as of when it was last written, under `id` set by `multiplexer`.
    function ledger(bytes32 id, address multiplexer, address account)
        external
        view
        returns (uint256 used, uint256 updatedAt)
    {
        uint256 word = $ledgers[PolicyStorage.configKey(id, multiplexer)][account];
        // The low 128 bits are the loss.
        // forge-lint: disable-next-line(unsafe-typecast)
        return (uint128(word), word >> 128);
    }

    /// @dev Stored as words after `PolicyStorage`'s length, so a check reads only what it needs: the settings in two
    /// (`_packSettings`), then two per market, its token with whether the agent may trade it (bit 160) and its target
    /// (bits 168 to 183), and its feed. The init data stays `abi.encode(Config)`, whose decoding checks every bound.
    function _configure(bytes32 id, address multiplexer, address account, bytes calldata initData) internal override {
        Config memory config = abi.decode(initData, (Config));
        uint256[] memory words = new uint256[](SETTINGS_WORDS + 2 * config.markets.length);
        (words[0], words[1]) = _packSettings(config.settings);
        for (uint256 i = 0; i < config.markets.length; ++i) {
            Market memory market = config.markets[i];
            words[SETTINGS_WORDS + 2 * i] =
                uint256(uint160(market.token)) | (market.allowed ? 1 << 160 : 0) | uint256(market.targetBps) << 168;
            words[SETTINGS_WORDS + 2 * i + 1] = uint256(uint160(market.feed));
        }
        $.write(PolicyStorage.configKey(id, multiplexer), account, abi.encodePacked(words));
    }

    /// @dev The account's balances before the calls: cash, then each market's stock.
    function _preCheck(bytes32 id, address multiplexer, address account, bytes calldata)
        internal
        view
        override
        returns (bytes memory context)
    {
        bytes32 key = PolicyStorage.configKey(id, multiplexer);
        uint256 stored = uint256($.words[key][account]);
        if (stored == 0) revert PolicyNotInitialized(id, multiplexer, account);
        uint256 count = ((stored - 1) / 32 - SETTINGS_WORDS) / 2;

        uint256[] memory balances = new uint256[](count + 1);
        balances[0] = IERC20Balance(USDC).balanceOf(account);
        for (uint256 i = 0; i < count; ++i) {
            balances[i + 1] = IERC20Balance(_address(_word(key, account, SETTINGS_WORDS + 2 * i))).balanceOf(account);
        }
        return abi.encode(balances);
    }

    function _postCheck(bytes32 id, address multiplexer, address account, bytes calldata context) internal override {
        uint256[] memory before = abi.decode(context, (uint256[]));
        _checkSequencer();

        bytes32 key = PolicyStorage.configKey(id, multiplexer);
        uint256 ledgerWord = $ledgers[key][account];
        GuardRules.Input memory input = GuardRules.Input({
            settings: _unpackSettings(_word(key, account, 0), _word(key, account, 1)),
            cashBefore: before[0],
            cashAfter: IERC20Balance(USDC).balanceOf(account),
            stocks: new GuardRules.Stock[](before.length - 1),
            // forge-lint: disable-next-line(unsafe-typecast)
            slippageUsed: uint128(ledgerWord),
            slippageUpdatedAt: ledgerWord >> 128,
            time: block.timestamp
        });

        for (uint256 i = 0; i < input.stocks.length; ++i) {
            uint256 market = _word(key, account, SETTINGS_WORDS + 2 * i);
            GuardRules.Stock memory stock = input.stocks[i];
            stock.token = _address(market);
            stock.allowed = (market >> 160) & 1 == 1;
            // forge-lint: disable-next-line(unsafe-typecast)
            stock.targetBps = uint16(market >> 168);
            stock.balanceBefore = before[i + 1];
            stock.balanceAfter = IERC20Balance(stock.token).balanceOf(account);
            // Only what the portfolio holds is valued, so a portfolio of two stocks reads two feeds.
            if (stock.balanceBefore != 0 || stock.balanceAfter != 0) {
                address feed = _address(_word(key, account, SETTINGS_WORDS + 2 * i + 1));
                // forge-lint: disable-next-line(unused-return)
                (, stock.price,, stock.updatedAt,) = IAggregator(feed).latestRoundData();
            }
        }

        (bool traded, uint256 used) = GuardRules.check(input);
        if (traded) $ledgers[key][account] = (block.timestamp << 128) | used;
    }

    function _word(bytes32 key, address account, uint256 index) private view returns (uint256) {
        return uint256($.words[bytes32(uint256(key) + 1 + index)][account]);
    }

    function _address(uint256 word) private pure returns (address) {
        // The low 160 bits are the address.
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(uint160(word));
    }

    /// @dev The settings in two words: the trade sizes, then every other field, 256 bits in all.
    function _packSettings(GuardRules.Settings memory s) internal pure returns (uint256 sizes, uint256 rest) {
        sizes = uint256(s.minTradeUsd) | uint256(s.maxTradeUsd) << 128;
        rest = uint256(s.mode) | (s.tradeWhilePaused ? 1 << 8 : 0) | uint256(s.collarBps) << 16
            | uint256(s.pausedCollarBps) << 32 | uint256(s.liveAge) << 48 | uint256(s.pausedAge) << 80
            | uint256(s.maxInOneStockBps) << 112 | uint256(s.cashReserveBps) << 128 | uint256(s.weeklySlippageBps)
            << 144 | uint256(s.slippageWindow) << 160 | uint256(s.bandBps) << 192 | uint256(s.overshootBps) << 208
            | uint256(s.progressBps) << 224 | uint256(s.cashTargetBps) << 240;
    }

    // Each field is cut back to the width `_packSettings` gave it.
    // forge-lint: disable-start(unsafe-typecast)
    function _unpackSettings(uint256 sizes, uint256 rest) internal pure returns (GuardRules.Settings memory s) {
        s.minTradeUsd = uint128(sizes);
        s.maxTradeUsd = uint128(sizes >> 128);
        s.mode = uint8(rest);
        s.tradeWhilePaused = (rest >> 8) & 1 == 1;
        s.collarBps = uint16(rest >> 16);
        s.pausedCollarBps = uint16(rest >> 32);
        s.liveAge = uint32(rest >> 48);
        s.pausedAge = uint32(rest >> 80);
        s.maxInOneStockBps = uint16(rest >> 112);
        s.cashReserveBps = uint16(rest >> 128);
        s.weeklySlippageBps = uint16(rest >> 144);
        s.slippageWindow = uint32(rest >> 160);
        s.bandBps = uint16(rest >> 192);
        s.overshootBps = uint16(rest >> 208);
        s.progressBps = uint16(rest >> 224);
        s.cashTargetBps = uint16(rest >> 240);
    }
    // forge-lint: disable-end(unsafe-typecast)

    function _checkSequencer() private view {
        // forge-lint: disable-next-line(unused-return)
        (, int256 answer, uint256 startedAt,,) = IAggregator(SEQUENCER_FEED).latestRoundData();
        // The grace is an hour: a sequencer's few seconds of timestamp leeway don't matter.
        // forge-lint: disable-next-line(block-timestamp)
        if (answer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE) revert SequencerDown();
    }
}
