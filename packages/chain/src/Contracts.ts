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
  /**
   * Its deepest USDC pool in Aerodrome's Slipstream (MetaDEX factory), all at tick spacing 10; `null` when it has
   * none to trade in. Found by scanning the factory's tick spacings on 2026-11-25; a fork test re-checks each.
   */
  readonly pool: { readonly address: Address; readonly tickSpacing: number } | null
  /** The company's logo as Coinbase publishes it for the token (its tokenized-stocks API); `null` when it has none. */
  readonly logoUrl: string | null
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
    feed: "0x787f13dEa48Db0897CbCDD985de77809D837F988",
    pool: { address: "0xF5FCB9CDAFcE67d50AfEf298F88E709d2B946BA6", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/873819f4b14efe44b94abecbc8e8864d2998163abd0ca55b449ee6eb07d0d94c.png"
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    token: "0xb200000000000000000000d9192b6B456483C2E8",
    feed: "0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295",
    pool: { address: "0x532e0F46d1e528507FC9454d5847C231f23bDDf6", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/06d3c2cac2c89e3a8bc4b2fe40ff259f104b55244321dea400e44b22f215896b.png"
  },
  {
    symbol: "ANT",
    name: "Anthropic",
    token: "0xb20000000000000000000016e38FD364d271Ba28",
    feed: "0xeEDc7412E991a3F2BD693eb2aC7fB0F27d4660dA",
    pool: { address: "0x599C4225FE90214795a0be228D20d7680f8CED15", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/8ab0b05f5367f9125e4c94b1c792d6c31c784dddeb42a3fcbf93b242e8f8645d.png"
  },
  {
    symbol: "COIN",
    name: "Coinbase",
    token: "0xb200000000000000000000c85a31389D71F3ecfb",
    feed: "0x408e44f504A7371a345F03a73dDC96A4b48e8aa7",
    pool: null,
    logoUrl: null
  },
  {
    symbol: "CRCL",
    name: "Circle",
    token: "0xB20000000000000000000019f6E7C675b73C2e4D",
    feed: "0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33",
    pool: { address: "0x294666AD6a415E8C33Af801225c04079BB4f1133", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/f217835f2637739f460cc9335a59ec96011c1b9510a40cee3243aeef50eb7a45.png"
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    token: "0xb2000000000000000000002D0BA3164cc74f58B7",
    feed: "0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2",
    pool: { address: "0x16c70F04C3080a127486Cdf5a4C33c066bBF47C3", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/0e80e31df40f7c42b49a3c7f6d23c6351625d73f235aeb69006ddee9221702b0.png"
  },
  {
    symbol: "INTC",
    name: "Intel",
    token: "0xB2000000000000000000004AFF16039bA04bdFBc",
    feed: "0xAB657C39bac0D5886250D70849e2E3E008F2EECB",
    pool: { address: "0x3D384288fA79B51De882B06B617aB7989CcAd4f3", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/cc2d84b704e34b83b5fc1f3b0e89c67e5ccc9142e666a50a5cbde261cf09e2aa.png"
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    token: "0xb2000000000000000000008bC8786B856E61707C",
    feed: "0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D",
    pool: { address: "0xd072410fa13D242e1d53721Bcf7AF02e3455DC96", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/1cedbfb3caee9498470945ff5041715b8c90921d904b3567a43bc4df82069e66.png"
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    token: "0xB200000000000000000000Ab99cFa739E253872B",
    feed: "0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c",
    pool: { address: "0x2740C0faAb738F6e346e545fDE02aEF9B1A01ee7", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/e90930ade985016f48816c6bd9fd1e8274b28507f4833881b3a16c77c2a3e2e7.png"
  },
  {
    symbol: "MSTR",
    name: "Strategy",
    token: "0xb2000000000000000000004884b426556b92883d",
    feed: "0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a",
    pool: { address: "0x66DCd42E6314B287110922AE36cB2a8bdEECc153", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/496024423dd795f8b547ffa0668f12a1e6bf09af247534754546a1a6661c7969.png"
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "0xb20000000000000000000078ee7ce2fE4908108C",
    feed: "0x04689a41629776563E6822F76f2e57D148d28513",
    pool: { address: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/1fee9b7a44e800d438dd9d96c3283e05784c925c2c871a48ff735950740b551a.png"
  },
  {
    symbol: "SNDK",
    name: "Sandisk",
    token: "0xb200000000000000000000397293Cb8cda9a10c5",
    feed: "0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA",
    pool: { address: "0x2836e062a3fe75943a7F4A552E2365b98E414E75", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/495de6bc9902690826d533b9506494890f59d611d10f04231c00936f659bb0cb.png"
  },
  {
    symbol: "SPCX",
    name: "SpaceX",
    token: "0xb2000000000000000000007b9fcbd005511aCBd5",
    feed: "0x6A634B235903C4ad6376892180d6fF8612e3Fa68",
    pool: { address: "0x880dB7Dda4407D99508574E680d067D1164B3cFE", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/79fa65beabbe27c7b84a38b8f67a492793a0c203a5312c8feddc23e4b7c66b79.png"
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "0xb2000000000000000000001e800a7f5189430cD0",
    feed: "0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4",
    pool: { address: "0x7A33000372f3F028f074182CCb9d16cBEEfBF920", tickSpacing: 10 },
    logoUrl:
      "https://metadata.coinbase.com/equity_icons/a3b67028295d0e9fa3182c867b8a9afed5ebcbd8c012de3a46e160ae5e490980.png"
  }
]
