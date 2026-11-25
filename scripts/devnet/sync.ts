// `pnpm dev` on the devnet: the server's market prices (from Alpaca) copied into the devnet's Chainlink feeds and
// pools, so quotes, the fair-price check and the reference line behave as they would on Base, with no RPC.
import { stocks } from "@bluechip/chain/Contracts"
import { movePool, rpc, setFeed } from "@bluechip/devnet/Controls"

/** A stock as `GET /api/market/stocks` answers it: its symbol and the market's token price, if there is one. */
export interface ListedStock {
  readonly symbol: string
  readonly price: { readonly price: string } | null
}

/** What one feed should read: its stock, the price (USD per token, 8 decimals) and when it updated (Unix seconds). */
export interface FeedUpdate {
  readonly symbol: string
  readonly price: bigint
  readonly updatedAt: number
}

/** The feeds' new answers: every stock the market prices, updated now, or 30 hours ago while prices are paused. */
export const feedUpdates = (
  listed: ReadonlyArray<ListedStock>,
  session: string,
  now: number
): ReadonlyArray<FeedUpdate> =>
  listed.flatMap((stock) =>
    stock.price === null ? [] : [{
      symbol: stock.symbol,
      price: BigInt(stock.price.price),
      // While prices are paused (weekends, holidays) Chainlink's feeds hold their last price: report it as 30 hours
      // old, which the server reads as paused, not stale.
      updatedAt: session === "paused" ? now - 30 * 60 * 60 : now
    }]
  )

/** Copies the server at `apiUrl`'s market prices into the devnet at `rpcUrl`: each feed, then each pool. */
export const syncPrices = async (options: { readonly apiUrl: string; readonly rpcUrl: string }) => {
  const get = async (path: string) => {
    const response = await fetch(`${options.apiUrl}${path}`)
    if (!response.ok) throw new Error(`${path} answered ${response.status}`)
    return await response.json()
  }

  const status = await get("/api/market/status") as { readonly session: string }
  const listed = await get("/api/market/stocks") as ReadonlyArray<ListedStock>
  const node = rpc(options.rpcUrl)

  for (const update of feedUpdates(listed, status.session, Math.floor(Date.now() / 1000))) {
    const stock = stocks.find((candidate) => candidate.symbol === update.symbol)
    if (stock === undefined) continue
    await setFeed(node, stock.feed, update.price, update.updatedAt)
    await movePool(node, stock, update.price)
  }
}
