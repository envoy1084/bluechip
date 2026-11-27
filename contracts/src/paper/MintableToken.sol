// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Ownable} from "solady/auth/Ownable.sol";
import {ERC20} from "solady/tokens/ERC20.sol";

/// @title MintableToken
/// @notice Paper's test tokens: ERC-20s worth nothing that their owner (bluechip's operator) and the minters it names
/// (the paper exchange's pools) mint.
abstract contract MintableToken is ERC20, Ownable {
    /// @notice Whether `minter` may mint, besides the owner.
    mapping(address minter => bool allowed) public isMinter;

    /// @notice `minter` was allowed to mint, or no longer is.
    event MinterSet(address indexed minter, bool allowed);

    /// @notice The caller is neither the owner nor a minter.
    error NotMinter();

    constructor(address owner_) {
        _initializeOwner(owner_);
    }

    /// @notice Allows `minter` to mint, or stops it.
    function setMinter(address minter, bool allowed) external onlyOwner {
        // Both lints misread Solady's `onlyOwner` (an assembly read) as a call: the event follows the write.
        // forge-lint: disable-next-line(missing-events-access-control)
        isMinter[minter] = allowed;
        // forge-lint: disable-next-line(reentrancy-events)
        emit MinterSet(minter, allowed);
    }

    /// @notice Mints `amount` to `to`.
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner() && !isMinter[msg.sender]) revert NotMinter();
        _mint(to, amount);
    }
}
