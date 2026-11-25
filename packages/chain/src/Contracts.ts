/**
 * Contract addresses on Base mainnet; the local fork has the same ones. Sources: `research/reports/02` and `07`
 * (onchain reads, 2026-11-23).
 *
 * @since 0.0.0
 */
import type { Address } from "viem"

/**
 * Circle's USDC (6 decimals).
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const usdc: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

/**
 * ERC-4337 EntryPoint v0.7, the one Kernel 3.3 and Namera use.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const entryPoint07: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

/**
 * A stock bluechip trades: its B20 token (8 decimals) and its Chainlink total-return price feed.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Stock {
  readonly symbol: string
  readonly token: Address
  readonly feed: Address
}

/**
 * The ten Coinbase tokenized stocks on Base.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const stocks: ReadonlyArray<Stock> = [
  {
    symbol: "AAPL",
    token: "0xb200000000000000000000C2e324d24d7eEcd1fb",
    feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988"
  },
  {
    symbol: "AMZN",
    token: "0xb200000000000000000000d9192b6B456483C2E8",
    feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295"
  },
  {
    symbol: "GOOGL",
    token: "0xb2000000000000000000002D0BA3164cc74f58B7",
    feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"
  },
  {
    symbol: "META",
    token: "0xb2000000000000000000008bC8786B856E61707C",
    feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D"
  },
  {
    symbol: "MSFT",
    token: "0xB200000000000000000000Ab99cFa739E253872B",
    feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"
  },
  {
    symbol: "MSTR",
    token: "0xb2000000000000000000004884b426556b92883d",
    feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a"
  },
  {
    symbol: "NVDA",
    token: "0xb20000000000000000000078ee7ce2fE4908108C",
    feed: "0x04689a41629776563E6822F76f2e57D148d28513"
  },
  {
    symbol: "SNDK",
    token: "0xb200000000000000000000397293Cb8cda9a10c5",
    feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA"
  },
  {
    symbol: "SPCX",
    token: "0xb2000000000000000000007b9fcbd005511aCBd5",
    feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68"
  },
  {
    symbol: "TSLA",
    token: "0xb2000000000000000000001e800a7f5189430cD0",
    feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"
  }
]
