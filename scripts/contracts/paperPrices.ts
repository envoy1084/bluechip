// Each paper feed's first price: the stock's latest trade on Alpaca, or, for a stock Alpaca doesn't list (Anthropic,
// SpaceX) or when it can't be reached, the last price Chainlink's feed on Base has.
import { aggregatorAbi } from "@bluechip/chain/Abis"
import type { Address, PublicClient, Transport } from "viem"
import type { base } from "viem/chains"

/** A seed price at the feeds' 8 decimals, and where it came from. */
interface SeedPrice {
  readonly price: bigint
  readonly source: "alpaca" | "base"
}

/** Alpaca's market data keys. */
interface AlpacaKeys {
  readonly keyId: string
  readonly secret: string
}

const alpacaPrices = async (symbols: ReadonlyArray<string>, keys: AlpacaKeys) => {
  const url = new URL("https://data.alpaca.markets/v2/stocks/snapshots")
  url.searchParams.set("symbols", symbols.join(","))
  url.searchParams.set("feed", "iex")
  const response = await fetch(url, { headers: { "APCA-API-KEY-ID": keys.keyId, "APCA-API-SECRET-KEY": keys.secret } })
  if (!response.ok) throw new Error(`contracts: Alpaca answered ${response.status}`)

  const body = await response.json() as Record<string, { readonly latestTrade?: { readonly p: number } | null }>
  return new Map(
    Object.entries(body).flatMap(([symbol, snapshot]) =>
      snapshot.latestTrade == null ? [] : [[symbol, BigInt(Math.round(snapshot.latestTrade.p * 1e8))] as const]
    )
  )
}

/**
 * Every stock's seed price, with why Alpaca gave none when it failed; fails only when neither Alpaca nor Base's feed
 * has a price.
 */
export const seedPrices = async (
  stocks: ReadonlyArray<{ readonly symbol: string; readonly baseFeed: Address }>,
  sources: { readonly alpaca: AlpacaKeys | undefined; readonly base: PublicClient<Transport, typeof base> }
): Promise<{ readonly prices: ReadonlyMap<string, SeedPrice>; readonly alpacaFailure: string | undefined }> => {
  let alpacaFailure: string | undefined = sources.alpaca === undefined ? "no Alpaca keys" : undefined
  const alpaca = sources.alpaca === undefined
    ? new Map<string, bigint>()
    : await alpacaPrices(stocks.map((stock) => stock.symbol), sources.alpaca).catch((error: unknown) => {
      alpacaFailure = String(error)
      return new Map<string, bigint>()
    })

  const prices = new Map<string, SeedPrice>()
  for (const stock of stocks) {
    const traded = alpaca.get(stock.symbol)
    if (traded !== undefined && traded > BigInt(0)) {
      prices.set(stock.symbol, { price: traded, source: "alpaca" })
      continue
    }
    const [, answer] = await sources.base.readContract({
      address: stock.baseFeed,
      abi: aggregatorAbi,
      functionName: "latestRoundData"
    })
    if (answer <= BigInt(0)) throw new Error(`contracts: no seed price for ${stock.symbol}`)
    prices.set(stock.symbol, { price: answer, source: "base" })
  }
  return { prices, alpacaFailure }
}
