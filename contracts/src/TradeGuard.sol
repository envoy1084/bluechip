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

    function _configure(bytes32 id, address multiplexer, address account, bytes calldata initData) internal override {
        abi.decode(initData, (Config));
        $.write(PolicyStorage.configKey(id, multiplexer), account, initData);
    }

    /// @dev The account's balances before the calls, and the configuration, so `_postCheck` reads storage once.
    function _preCheck(bytes32 id, address multiplexer, address account, bytes calldata)
        internal
        view
        override
        returns (bytes memory context)
    {
        (bool exists, bytes memory packed) = $.read(PolicyStorage.configKey(id, multiplexer), account);
        if (!exists) revert PolicyNotInitialized(id, multiplexer, account);

        Config memory config = abi.decode(packed, (Config));
        return abi.encode(_balances(config, account), config);
    }

    function _postCheck(bytes32 id, address multiplexer, address account, bytes calldata context) internal override {
        (uint256[] memory before, Config memory config) = abi.decode(context, (uint256[], Config));
        uint256[] memory afterward = _balances(config, account);
        _checkSequencer();

        bytes32 key = PolicyStorage.configKey(id, multiplexer);
        uint256 word = $ledgers[key][account];
        GuardRules.Input memory input = GuardRules.Input({
            settings: config.settings,
            cashBefore: before[0],
            cashAfter: afterward[0],
            stocks: new GuardRules.Stock[](config.markets.length),
            // forge-lint: disable-next-line(unsafe-typecast)
            slippageUsed: uint128(word),
            slippageUpdatedAt: word >> 128,
            time: block.timestamp
        });

        for (uint256 i; i < config.markets.length; ++i) {
            Market memory market = config.markets[i];
            GuardRules.Stock memory stock = input.stocks[i];
            stock.token = market.token;
            stock.allowed = market.allowed;
            stock.targetBps = market.targetBps;
            stock.balanceBefore = before[i + 1];
            stock.balanceAfter = afterward[i + 1];
            // Only what the portfolio holds is valued, so a portfolio of two stocks reads two feeds.
            if (stock.balanceBefore != 0 || stock.balanceAfter != 0) {
                // forge-lint: disable-next-line(unused-return)
                (, stock.price,, stock.updatedAt,) = IAggregator(market.feed).latestRoundData();
            }
        }

        (bool traded, uint256 used) = GuardRules.check(input);
        if (traded) $ledgers[key][account] = (block.timestamp << 128) | used;
    }

    function _balances(Config memory config, address account) private view returns (uint256[] memory balances) {
        balances = new uint256[](config.markets.length + 1);
        balances[0] = IERC20Balance(USDC).balanceOf(account);
        for (uint256 i; i < config.markets.length; ++i) {
            balances[i + 1] = IERC20Balance(config.markets[i].token).balanceOf(account);
        }
    }

    function _checkSequencer() private view {
        // forge-lint: disable-next-line(unused-return)
        (, int256 answer, uint256 startedAt,,) = IAggregator(SEQUENCER_FEED).latestRoundData();
        // The grace is an hour: a sequencer's few seconds of timestamp leeway don't matter.
        // forge-lint: disable-next-line(block-timestamp)
        if (answer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE) revert SequencerDown();
    }
}
