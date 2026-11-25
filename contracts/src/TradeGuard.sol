// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ExecutionPolicyBase} from "namera/hooks/ExecutionPolicyBase.sol";
import {PolicyStorage} from "namera/policies/lib/PolicyStorage.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";

import {Outcome} from "./lib/Outcome.sol";
import {IOutcomeRule, Valuation} from "./rules/IOutcomeRule.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

interface IAggregator {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @title TradeGuard
/// @notice bluechip's execution policy for an agent's session, run by Namera's SessionHook around each operation. It
/// measures what the operation did to the account's balances, checks the moves (allowed stocks, the agent's
/// direction, paid for in USDC) and values the portfolio once at Chainlink's prices, then runs each rule the session
/// chose (`IOutcomeRule`): a rule's revert refuses the operation with the rule's own error.
/// @dev Configuration (`abi.encode(mode, prices, markets, rules)`, the fields of `Config`, signed by the owner when the agent is locked: no admin key) is kept in a
/// contract's code (SSTORE2), so each check reads it with one EXTCODECOPY instead of a cold storage read per word. That
/// deploys a contract when the session is configured, which ERC-7562 forbids during validation: TradeGuard is
/// configured only by an owner operation installing or updating the session (execution), never in enable mode.
contract TradeGuard is ExecutionPolicyBase {
    /// @notice A stock the portfolio is valued over: its token, Chainlink feed, and whether the agent may trade it.
    struct Market {
        address token;
        address feed;
        bool allowed;
    }

    /// @notice A rule to run after the moves and valuation, with its own configuration.
    struct Rule {
        address rule;
        bytes config;
    }

    /// @notice An agent's configuration: its direction (`Outcome.BUY` … `Outcome.REBALANCE`), price ages, the stocks
    /// valued (`packMarkets`: two words each, the token with whether the agent may trade it at bit 160, then the feed),
    /// and its rules in the order they run. Encoded as its four fields in a row, so a check that needs only the markets
    /// decodes only the first three.
    struct Config {
        uint8 mode;
        Outcome.Prices prices;
        uint256[] markets;
        Rule[] rules;
    }

    /// @notice Base's sequencer was down, or came back less than the grace period ago: prices can't be trusted.
    error SequencerDown();

    address public immutable USDC;
    /// @notice Chainlink's L2 sequencer uptime feed (answer 0 while up, `startedAt` when that last changed).
    address public immutable SEQUENCER_FEED;
    uint256 public immutable SEQUENCER_GRACE;

    /// @dev Where each session's configuration per account is kept (an SSTORE2 pointer).
    mapping(bytes32 key => mapping(address account => address pointer)) internal $configs;

    // Deployed only by `contracts deploy`, with Base's addresses: the CREATE2 address fixes them.
    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address usdc, address sequencerFeed, uint256 sequencerGrace) {
        USDC = usdc;
        SEQUENCER_FEED = sequencerFeed;
        SEQUENCER_GRACE = sequencerGrace;
    }

    /// @dev The init data is kept as it is, after checking it decodes.
    function _configure(bytes32 id, address multiplexer, address account, bytes calldata initData) internal override {
        abi.decode(initData, (uint8, Outcome.Prices, uint256[], Rule[]));
        $configs[PolicyStorage.configKey(id, multiplexer)][account] = SSTORE2.write(initData);
    }

    /// @dev The account's balances before the calls: cash, then each market's stock.
    function _preCheck(bytes32 id, address multiplexer, address account, bytes calldata)
        internal
        view
        override
        returns (bytes memory context)
    {
        (,, uint256[] memory markets) =
            abi.decode(_stored(id, multiplexer, account), (uint8, Outcome.Prices, uint256[]));
        uint256 count = markets.length / 2;
        uint256[] memory balances = new uint256[](count + 1);
        balances[0] = IERC20Balance(USDC).balanceOf(account);
        for (uint256 i = 0; i < count; ++i) {
            balances[i + 1] = IERC20Balance(_address(markets[2 * i])).balanceOf(account);
        }
        return abi.encode(balances);
    }

    function _postCheck(bytes32 id, address multiplexer, address account, bytes calldata context) internal override {
        uint256[] memory before = abi.decode(context, (uint256[]));
        _checkSequencer();

        Config memory config;
        (config.mode, config.prices, config.markets, config.rules) =
            abi.decode(_stored(id, multiplexer, account), (uint8, Outcome.Prices, uint256[], Rule[]));
        Outcome.Input memory input = Outcome.Input({
            mode: config.mode,
            prices: config.prices,
            cashBefore: before[0],
            cashAfter: IERC20Balance(USDC).balanceOf(account),
            stocks: new Outcome.Stock[](config.markets.length / 2),
            time: block.timestamp
        });
        for (uint256 i = 0; i < input.stocks.length; ++i) {
            uint256 market = config.markets[2 * i];
            Outcome.Stock memory stock = input.stocks[i];
            stock.token = _address(market);
            stock.allowed = (market >> 160) & 1 == 1;
            stock.before = before[i + 1];
            stock.afterward = IERC20Balance(stock.token).balanceOf(account);
            // Only what the portfolio holds is valued, so a portfolio of two stocks reads two feeds.
            if (stock.before != 0 || stock.afterward != 0) {
                // forge-lint: disable-next-line(unused-return)
                (, stock.price,, stock.updatedAt,) = IAggregator(_address(config.markets[2 * i + 1])).latestRoundData();
            }
        }

        (bool moved, Valuation memory valuation) = Outcome.value(input);
        if (!moved) return;

        bytes32 key = PolicyStorage.configKey(id, multiplexer);
        for (uint256 i = 0; i < config.rules.length; ++i) {
            IOutcomeRule(config.rules[i].rule).check(valuation, config.rules[i].config, key, account);
        }
    }

    function _stored(bytes32 id, address multiplexer, address account) private view returns (bytes memory) {
        address pointer = $configs[PolicyStorage.configKey(id, multiplexer)][account];
        if (pointer == address(0)) revert PolicyNotInitialized(id, multiplexer, account);
        return SSTORE2.read(pointer);
    }

    /// @notice The packed `Config.markets` for these stocks.
    function packMarkets(Market[] calldata markets) external pure returns (uint256[] memory words) {
        words = new uint256[](2 * markets.length);
        for (uint256 i = 0; i < markets.length; ++i) {
            words[2 * i] = uint256(uint160(markets[i].token)) | (markets[i].allowed ? 1 << 160 : 0);
            words[2 * i + 1] = uint256(uint160(markets[i].feed));
        }
    }

    function _address(uint256 word) private pure returns (address) {
        // The low 160 bits are the address.
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(uint160(word));
    }

    function _checkSequencer() private view {
        // forge-lint: disable-next-line(unused-return)
        (, int256 answer, uint256 startedAt,,) = IAggregator(SEQUENCER_FEED).latestRoundData();
        // The grace is an hour: a sequencer's few seconds of timestamp leeway don't matter.
        // forge-lint: disable-next-line(block-timestamp)
        if (answer != 0 || block.timestamp - startedAt <= SEQUENCER_GRACE) revert SequencerDown();
    }
}
