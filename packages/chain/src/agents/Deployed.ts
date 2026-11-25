/**
 * bluechip's onchain policies: their addresses and ABIs. Written by `node scripts/bin.ts contracts build` from the
 * Foundry build in `contracts/`; do not edit.
 *
 * @since 0.0.0
 */
import type { Address } from "viem"

/**
 * `AerodromeTradePolicy` (`bluechip.aerodrome-trade-policy.v1`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const aerodromeTradePolicy: Address = "0x6a8Ff74F0D94dB667CcdeA596a4B2DA796Da1E55"

/**
 * `AerodromeTradePolicy`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const aerodromeTradePolicyAbi = [
  {
    "type": "constructor",
    "inputs": [{ "name": "usdc", "type": "address", "internalType": "address" }, {
      "name": "router",
      "type": "address",
      "internalType": "address"
    }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ACTION",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DAY",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "OPERATION",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ROUTER",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDC",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkAction",
    "inputs": [
      { "name": "id", "type": "bytes32", "internalType": "bytes32" },
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkUserOpPolicy",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "userOp",
      "type": "tuple",
      "internalType": "struct ERC4337.PackedUserOperation",
      "components": [
        { "name": "sender", "type": "address", "internalType": "address" },
        { "name": "nonce", "type": "uint256", "internalType": "uint256" },
        { "name": "initCode", "type": "bytes", "internalType": "bytes" },
        { "name": "callData", "type": "bytes", "internalType": "bytes" },
        { "name": "accountGasLimits", "type": "bytes32", "internalType": "bytes32" },
        { "name": "preVerificationGas", "type": "uint256", "internalType": "uint256" },
        { "name": "gasFees", "type": "bytes32", "internalType": "bytes32" },
        { "name": "paymasterAndData", "type": "bytes", "internalType": "bytes" },
        { "name": "signature", "type": "bytes", "internalType": "bytes" }
      ]
    }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initializeWithMultiplexer",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "configId",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "spent",
    "inputs": [
      { "name": "id", "type": "bytes32", "internalType": "bytes32" },
      { "name": "multiplexer", "type": "address", "internalType": "address" },
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "time", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [{ "name": "interfaceId", "type": "bytes4", "internalType": "bytes4" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "PolicySet",
    "inputs": [{ "name": "id", "type": "bytes32", "indexed": false, "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "account", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  { "type": "error", "name": "InvalidRole", "inputs": [{ "name": "role", "type": "uint8", "internalType": "uint8" }] },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "UnsupportedCallType",
    "inputs": [{ "name": "callType", "type": "bytes1", "internalType": "bytes1" }]
  }
] as const

/**
 * `TradeGuard` (`bluechip.trade-guard.v1`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const tradeGuard: Address = "0x9246C1e5448Cc76685a21BD4e9f56a449E9b9BdD"

/**
 * `TradeGuard`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const tradeGuardAbi = [
  {
    "type": "constructor",
    "inputs": [{ "name": "usdc", "type": "address", "internalType": "address" }, {
      "name": "sequencerFeed",
      "type": "address",
      "internalType": "address"
    }, { "name": "sequencerGrace", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "SEQUENCER_FEED",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SEQUENCER_GRACE",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDC",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initializeWithMultiplexer",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "id",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ledger",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "used", "type": "uint256", "internalType": "uint256" }, {
      "name": "updatedAt",
      "type": "uint256",
      "internalType": "uint256"
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "postCheck",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }, { "name": "context", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "preCheck",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }, { "name": "execData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [{ "name": "context", "type": "bytes", "internalType": "bytes" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [{ "name": "interfaceId", "type": "bytes4", "internalType": "bytes4" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "PolicySet",
    "inputs": [{ "name": "id", "type": "bytes32", "indexed": false, "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "account", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  { "type": "error", "name": "LosesValue", "inputs": [] },
  { "type": "error", "name": "NoCashSide", "inputs": [] },
  { "type": "error", "name": "NoProgress", "inputs": [] },
  {
    "type": "error",
    "name": "NotAllowedStock",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "NotNeeded", "inputs": [] },
  { "type": "error", "name": "OverSlippageBudget", "inputs": [] },
  {
    "type": "error",
    "name": "OverStockCap",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OverTradeSize",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "Overshoots",
    "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PausedTradingOff",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PricesStale",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "SequencerDown", "inputs": [] },
  {
    "type": "error",
    "name": "TooSmall",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "UnderCashReserve", "inputs": [] },
  { "type": "error", "name": "UnfairPrice", "inputs": [] },
  {
    "type": "error",
    "name": "WrongDirection",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "WrongWay",
    "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "LosesValue", "inputs": [] },
  { "type": "error", "name": "NoCashSide", "inputs": [] },
  { "type": "error", "name": "NoProgress", "inputs": [] },
  {
    "type": "error",
    "name": "NotAllowedStock",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "NotNeeded", "inputs": [] },
  { "type": "error", "name": "OverSlippageBudget", "inputs": [] },
  {
    "type": "error",
    "name": "OverStockCap",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OverTradeSize",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "Overshoots",
    "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PausedTradingOff",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PricesStale",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "TooSmall",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "UnderCashReserve", "inputs": [] },
  { "type": "error", "name": "UnfairPrice", "inputs": [] },
  {
    "type": "error",
    "name": "WrongDirection",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "WrongWay", "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }] }
] as const
