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
 * A stock bluechip trades: its B20 token (8 decimals) and its Chainlink total-return price feed (8 decimals, US
 * equity hours 24/5, 0.5% deviation or 24 h heartbeat).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Stock {
  readonly symbol: string
  readonly name: string
  readonly token: Address
  readonly feed: Address
}

/**
 * Every Coinbase tokenized stock on Base with a Chainlink NAV feed: Coinbase's NAV feed list
 * (`GET https://api.coinbase.com/v1/tokenized-stocks/nav-feeds`) joined with its token list
 * (`GET https://api.coinbase.com/v1/tokenized-stocks`), checked against Chainlink's Base feed directory on
 * 2026-11-25. Of 415 listed tokens, these 14 have a feed. COINc has a feed but no supply yet and is not in Coinbase's
 * token list.
 *
 * @stability unstable
 * @category addresses
 * @since 0.0.0
 */
export const stocks: ReadonlyArray<Stock> = [
  {
    symbol: "AAPL",
    name: "Apple",
    token: "0xb200000000000000000000C2e324d24d7eEcd1fb",
    feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988"
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    token: "0xb200000000000000000000d9192b6B456483C2E8",
    feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295"
  },
  {
    symbol: "ANT",
    name: "Anthropic",
    token: "0xb20000000000000000000016e38FD364d271Ba28",
    feed: "0xeEDc7412E991a3F2BD693eb2aC7fB0F27d4660dA"
  },
  {
    symbol: "COIN",
    name: "Coinbase",
    token: "0xb200000000000000000000c85a31389D71F3ecfb",
    feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7"
  },
  {
    symbol: "CRCL",
    name: "Circle",
    token: "0xB20000000000000000000019f6E7C675b73C2e4D",
    feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33"
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    token: "0xb2000000000000000000002D0BA3164cc74f58B7",
    feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"
  },
  {
    symbol: "INTC",
    name: "Intel",
    token: "0xB2000000000000000000004AFF16039bA04bdFBc",
    feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB"
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    token: "0xb2000000000000000000008bC8786B856E61707C",
    feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D"
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    token: "0xB200000000000000000000Ab99cFa739E253872B",
    feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"
  },
  {
    symbol: "MSTR",
    name: "Strategy",
    token: "0xb2000000000000000000004884b426556b92883d",
    feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a"
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "0xb20000000000000000000078ee7ce2fE4908108C",
    feed: "0x04689a41629776563E6822F76f2e57D148d28513"
  },
  {
    symbol: "SNDK",
    name: "Sandisk",
    token: "0xb200000000000000000000397293Cb8cda9a10c5",
    feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA"
  },
  {
    symbol: "SPCX",
    name: "SpaceX",
    token: "0xb2000000000000000000007b9fcbd005511aCBd5",
    feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68"
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "0xb2000000000000000000001e800a7f5189430cD0",
    feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"
  }
]
