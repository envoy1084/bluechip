// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @title SequencerUptimeStub
/// @notice Chainlink's L2 sequencer uptime feed in shape, for a chain that has none: always up (answer 0), and up since
/// long before `TradeGuard`'s grace period.
contract SequencerUptimeStub {
    /// @notice When the sequencer "came up": 14 November 2023.
    uint256 public constant STARTED_AT = 1_700_000_000;

    function decimals() external pure returns (uint8) {
        return 0;
    }

    function description() external pure returns (string memory) {
        return "L2 Sequencer Uptime Status Feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestRoundData() external pure returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 0, STARTED_AT, STARTED_AT, 1);
    }

    function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 0, STARTED_AT, STARTED_AT, 1);
    }
}
