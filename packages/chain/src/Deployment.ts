/**
 * What bluechip uses on one network: its chain, USDC, the entry point, the exchange, the stocks and their feeds,
 * bluechip's own policies, the explorer, and on paper the operator. Code reads addresses from a network's
 * {@link Deployment} (`ChainDeployment`), never from module constants; the ABIs are the same everywhere.
 *
 * @since 0.0.0
 */
import type { Address } from "viem"
import type { base, baseSepolia } from "viem/chains"
import type { Network } from "./Network.ts"

/**
 * A stock bluechip trades: its token (8 decimals) and its Chainlink-shaped total-return price feed (8 decimals, US
 * equity hours 24/5). Its symbol, name and logo are the same on every network.
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
  /** Its USDC pool in the network's exchange, with its tick spacing; `null` when it has none to trade in. */
  readonly pool: { readonly address: Address; readonly tickSpacing: number } | null
  /** The company's logo as Coinbase publishes it for the token (its tokenized-stocks API); `null` when it has none. */
  readonly logoUrl: string | null
}

/**
 * The exchange the stocks trade in, with Aerodrome Slipstream's interfaces: the factory that knows the pools, the swap
 * router and the quoter (`quoteExactInputSingleV3`, called with `eth_call`).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Exchange {
  readonly factory: Address
  readonly router: Address
  readonly quoter: Address
}

/**
 * bluechip's onchain policies and the rules `TradeGuard` runs, as `contracts build` (Base) or `contracts deploy`
 * (another network) placed them.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Policies {
  readonly aerodromeTradePolicy: Address
  readonly tradeGuard: Address
  readonly recoveryDelayPolicy: Address
  readonly tradeSizeRule: Address
  readonly fairPriceRule: Address
  readonly stockCapRule: Address
  readonly cashReserveRule: Address
  readonly rebalanceRule: Address
  readonly stopLossFloorRule: Address
  readonly slippageBudgetRule: Address
}

/**
 * One network's deployment. `local` is Base's (the devnet copies Base at the same addresses); `paper` is set on the
 * paper network, where bluechip's operator mints test money and writes the feeds (through `feedWriter`).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Deployment {
  readonly network: Network
  readonly chain: typeof base | typeof baseSepolia
  readonly chainId: number
  /** USDC (6 decimals): Circle's on Base, bluechip's test USDC on paper. */
  readonly usdc: Address
  /** ERC-4337 EntryPoint v0.7, the one Kernel 3.3 and Namera use. */
  readonly entryPoint: Address
  /** Chainlink's L2 sequencer uptime feed (a stub that is always up on paper). */
  readonly sequencerFeed: Address
  readonly exchange: Exchange
  /** Every stock, in the order `TradeGuard` values them (the same symbols, in the same order, on every network). */
  readonly stocks: ReadonlyArray<Stock>
  readonly policies: Policies
  /**
   * The block explorer's base URL (`<url>/tx/<hash>`, `<url>/token/<address>`). The local chain links to BaseScan,
   * as its addresses are Base's.
   */
  readonly explorerUrl: string
  readonly paper: { readonly operator: Address; readonly feedWriter: Address } | null
}
