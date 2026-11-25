// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

interface ICLPool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data)
        external
        returns (uint256, uint256);
}

/// @notice Adds liquidity to a Slipstream pool from its own balances. The pool asks for payment through a callback
/// whose name differs between Slipstream versions but always starts with the two amounts owed, so the fallback pays.
contract PoolSeeder {
    address internal minting;

    function seed(address pool, int24 tickLower, int24 tickUpper, uint128 liquidity) external {
        minting = pool;
        ICLPool(pool).mint(address(this), tickLower, tickUpper, liquidity, "");
        minting = address(0);
    }

    fallback() external {
        require(msg.sender == minting, "PoolSeeder: not minting");
        (uint256 owed0, uint256 owed1) = abi.decode(msg.data[4:68], (uint256, uint256));
        if (owed0 > 0) require(IERC20(ICLPool(msg.sender).token0()).transfer(msg.sender, owed0));
        if (owed1 > 0) require(IERC20(ICLPool(msg.sender).token1()).transfer(msg.sender, owed1));
    }
}
