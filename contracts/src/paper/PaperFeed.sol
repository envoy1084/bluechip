// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @title PaperFeed
/// @notice A paper stock's price in Chainlink's `AggregatorV3Interface` shape (8 decimals, like Coinbase's stock
/// feeds), written only by its `PaperFeedWriter`. Each write is a new round; only the latest round is kept.
contract PaperFeed {
    /// @notice The only address that may write the price.
    address public immutable WRITER;

    uint80 internal _round;
    int256 internal _answer;
    uint256 internal _updatedAt;

    string internal _description;

    /// @notice The caller isn't the writer.
    error NotWriter();

    /// @notice A price must be above zero.
    error InvalidAnswer();

    /// @notice Only the latest round is kept (Chainlink's own message for a round it doesn't have).
    error NoDataPresent();

    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address writer, string memory description_) {
        WRITER = writer;
        _description = description_;
    }

    /// @notice Writes the price, as of now.
    function write(int256 answer) external {
        if (msg.sender != WRITER) revert NotWriter();
        if (answer <= 0) revert InvalidAnswer();
        ++_round;
        _answer = answer;
        _updatedAt = block.timestamp;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external view returns (string memory) {
        return _description;
    }

    function version() external pure returns (uint256) {
        return 4;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_round, _answer, _updatedAt, _updatedAt, _round);
    }

    function getRoundData(uint80 roundId)
        external
        view
        returns (uint80, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        if (roundId == 0 || roundId != _round) revert NoDataPresent();
        return (_round, _answer, _updatedAt, _updatedAt, _round);
    }
}
