// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

/// @notice A Chainlink price feed whose price and age the devnet sets by writing storage: slot 0 holds the answer
/// (8 decimals, as Coinbase's stock feeds), slot 1 when it was last updated.
contract MockFeed {
    int256 internal answer;
    uint256 internal updatedAt;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "bluechip devnet feed";
    }

    function version() external pure returns (uint256) {
        return 4;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
