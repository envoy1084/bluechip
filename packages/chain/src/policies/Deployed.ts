/**
 * bluechip's onchain policies: their addresses and ABIs. Written by `node scripts/bin.ts contracts build` from the
 * Foundry build in `contracts/`; do not edit.
 *
 * @since 0.0.0
 */
import type { Address } from "viem"

/**
 * `AerodromeTradePolicy` (`bluechip.aerodrome-trade-policy`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const aerodromeTradePolicy: Address = "0x3FdF29585d00d26240da3c45168Cad0148Ac9073"

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
    "name": "DAY",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
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
  { "type": "error", "name": "LimitTooLarge", "inputs": [] },
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
 * `TradeGuard` (`bluechip.trade-guard`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const tradeGuard: Address = "0x6131C37391279FFD3831dB2F89C10C29D52fc57D"

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
    "name": "packMarkets",
    "inputs": [{
      "name": "markets",
      "type": "tuple[]",
      "internalType": "struct TradeGuard.Market[]",
      "components": [{ "name": "token", "type": "address", "internalType": "address" }, {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      }, { "name": "allowed", "type": "bool", "internalType": "bool" }]
    }],
    "outputs": [{ "name": "words", "type": "uint256[]", "internalType": "uint256[]" }],
    "stateMutability": "pure"
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
  { "type": "error", "name": "NoCashSide", "inputs": [] },
  {
    "type": "error",
    "name": "NotAllowedStock",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
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
    "name": "WrongDirection",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "NoCashSide", "inputs": [] },
  {
    "type": "error",
    "name": "NotAllowedStock",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
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
    "name": "WrongDirection",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  }
] as const

/**
 * `TradeSizeRule` (`bluechip.trade-size-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const tradeSizeRule: Address = "0x240274AB59bd003C39eDf22542910EA9BBc3121e"

/**
 * `TradeSizeRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const tradeSizeRuleAbi = [{
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "pure"
}, {
  "type": "error",
  "name": "OverTradeSize",
  "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
}, {
  "type": "error",
  "name": "TooSmall",
  "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
}] as const

/**
 * `FairPriceRule` (`bluechip.fair-price-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const fairPriceRule: Address = "0x8482F4E90a5101422044e1D54D45AF72A75d28e3"

/**
 * `FairPriceRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const fairPriceRuleAbi = [{
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "pure"
}, { "type": "error", "name": "UnfairPrice", "inputs": [] }] as const

/**
 * `StockCapRule` (`bluechip.stock-cap-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const stockCapRule: Address = "0x6Ec294E0c7D091E57c67Cf4dE4f0965170Ff61DA"

/**
 * `StockCapRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const stockCapRuleAbi = [{
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "pure"
}, {
  "type": "error",
  "name": "OverStockCap",
  "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
}] as const

/**
 * `CashReserveRule` (`bluechip.cash-reserve-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const cashReserveRule: Address = "0x1A9aB2684e08C8fAd79D6014eeeFe874AC67E701"

/**
 * `CashReserveRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const cashReserveRuleAbi = [{
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "pure"
}, { "type": "error", "name": "UnderCashReserve", "inputs": [] }] as const

/**
 * `RebalanceRule` (`bluechip.rebalance-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const rebalanceRule: Address = "0xf7859d6DC9265D229F4F38e3d022bAf6a02B923E"

/**
 * `RebalanceRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const rebalanceRuleAbi = [
  {
    "type": "function",
    "name": "check",
    "inputs": [
      {
        "name": "valuation",
        "type": "tuple",
        "internalType": "struct Valuation",
        "components": [
          { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
          { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
          {
            "name": "holdings",
            "type": "tuple[]",
            "internalType": "struct Holding[]",
            "components": [
              { "name": "index", "type": "uint256", "internalType": "uint256" },
              { "name": "token", "type": "address", "internalType": "address" },
              { "name": "before", "type": "uint256", "internalType": "uint256" },
              { "name": "afterward", "type": "uint256", "internalType": "uint256" },
              { "name": "price", "type": "uint256", "internalType": "uint256" }
            ]
          },
          { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
          { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
          { "name": "lost", "type": "uint256", "internalType": "uint256" },
          { "name": "traded", "type": "uint256", "internalType": "uint256" },
          { "name": "paused", "type": "bool", "internalType": "bool" },
          { "name": "time", "type": "uint256", "internalType": "uint256" }
        ]
      },
      { "name": "config", "type": "bytes", "internalType": "bytes" },
      { "name": "", "type": "bytes32", "internalType": "bytes32" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  { "type": "error", "name": "LosesValue", "inputs": [] },
  { "type": "error", "name": "NoProgress", "inputs": [] },
  { "type": "error", "name": "NotNeeded", "inputs": [] },
  {
    "type": "error",
    "name": "Overshoots",
    "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "TargetsMismatch", "inputs": [] },
  { "type": "error", "name": "WrongWay", "inputs": [{ "name": "asset", "type": "address", "internalType": "address" }] }
] as const

/**
 * `StopLossFloorRule` (`bluechip.stop-loss-floor-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const stopLossFloorRule: Address = "0x40303065601832aED92bB4fad1d6425631ddD47e"

/**
 * `StopLossFloorRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const stopLossFloorRuleAbi = [{
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "pure"
}, {
  "type": "error",
  "name": "AboveFloor",
  "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
}, { "type": "error", "name": "FloorsMismatch", "inputs": [] }] as const

/**
 * `SlippageBudgetRule` (`bluechip.slippage-budget-rule`): its address on Base and the devnet.
 *
 * @stability unstable
 * @category contracts
 * @since 0.0.0
 */
export const slippageBudgetRule: Address = "0x1167EC36224BCd2FAce8502Bc7284a84b01bef4E"

/**
 * `SlippageBudgetRule`'s ABI.
 *
 * @stability unstable
 * @category abis
 * @since 0.0.0
 */
export const slippageBudgetRuleAbi = [{
  "type": "function",
  "name": "charge",
  "inputs": [{ "name": "used", "type": "uint256", "internalType": "uint256" }, {
    "name": "updatedAt",
    "type": "uint256",
    "internalType": "uint256"
  }, {
    "name": "valuation",
    "type": "tuple",
    "internalType": "struct Valuation",
    "components": [
      { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
      { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
      {
        "name": "holdings",
        "type": "tuple[]",
        "internalType": "struct Holding[]",
        "components": [
          { "name": "index", "type": "uint256", "internalType": "uint256" },
          { "name": "token", "type": "address", "internalType": "address" },
          { "name": "before", "type": "uint256", "internalType": "uint256" },
          { "name": "afterward", "type": "uint256", "internalType": "uint256" },
          { "name": "price", "type": "uint256", "internalType": "uint256" }
        ]
      },
      { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
      { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
      { "name": "lost", "type": "uint256", "internalType": "uint256" },
      { "name": "traded", "type": "uint256", "internalType": "uint256" },
      { "name": "paused", "type": "bool", "internalType": "bool" },
      { "name": "time", "type": "uint256", "internalType": "uint256" }
    ]
  }, {
    "name": "limits",
    "type": "tuple",
    "internalType": "struct SlippageBudgetRule.Config",
    "components": [{ "name": "budgetBps", "type": "uint16", "internalType": "uint16" }, {
      "name": "window",
      "type": "uint32",
      "internalType": "uint32"
    }]
  }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "pure"
}, {
  "type": "function",
  "name": "check",
  "inputs": [
    {
      "name": "valuation",
      "type": "tuple",
      "internalType": "struct Valuation",
      "components": [
        { "name": "cashBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "cashAfter", "type": "uint256", "internalType": "uint256" },
        {
          "name": "holdings",
          "type": "tuple[]",
          "internalType": "struct Holding[]",
          "components": [
            { "name": "index", "type": "uint256", "internalType": "uint256" },
            { "name": "token", "type": "address", "internalType": "address" },
            { "name": "before", "type": "uint256", "internalType": "uint256" },
            { "name": "afterward", "type": "uint256", "internalType": "uint256" },
            { "name": "price", "type": "uint256", "internalType": "uint256" }
          ]
        },
        { "name": "totalBefore", "type": "uint256", "internalType": "uint256" },
        { "name": "totalAfter", "type": "uint256", "internalType": "uint256" },
        { "name": "lost", "type": "uint256", "internalType": "uint256" },
        { "name": "traded", "type": "uint256", "internalType": "uint256" },
        { "name": "paused", "type": "bool", "internalType": "bool" },
        { "name": "time", "type": "uint256", "internalType": "uint256" }
      ]
    },
    { "name": "config", "type": "bytes", "internalType": "bytes" },
    { "name": "key", "type": "bytes32", "internalType": "bytes32" },
    { "name": "account", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "ledger",
  "inputs": [{ "name": "guard", "type": "address", "internalType": "address" }, {
    "name": "key",
    "type": "bytes32",
    "internalType": "bytes32"
  }, { "name": "account", "type": "address", "internalType": "address" }],
  "outputs": [{ "name": "used", "type": "uint256", "internalType": "uint256" }, {
    "name": "updatedAt",
    "type": "uint256",
    "internalType": "uint256"
  }],
  "stateMutability": "view"
}, { "type": "error", "name": "OverSlippageBudget", "inputs": [] }] as const
