// The made-up market: every stock bluechip lists with a plausible price, today's move, Chainlink's reference and a
// smooth history, generated the same way on every load (seeded by the stock), so a chart doesn't change on reload.
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import type { HistoryRange, StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import type { Cast } from "../cast.ts"

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** How many daily closes back the longest chart goes (about three years). */
export const HISTORY_DAYS = 1_100

interface StockProfile {
  /** The previous close, in dollars per token. */
  readonly close: number
  /** Today's move in the mixed market, as a fraction. */
  readonly change: number
  /** What the stock was worth three years ago, as a fraction of today's close. */
  readonly start: number
  /** Daily volatility. */
  readonly vol: number
}

const PROFILES: Readonly<Record<StockSymbol, StockProfile>> = {
  AAPL: { close: 238.42, change: 0.0124, start: 0.71, vol: 0.014 },
  AMZN: { close: 214.07, change: -0.0087, start: 0.64, vol: 0.017 },
  ANT: { close: 412.9, change: 0.0451, start: 0.22, vol: 0.031 },
  CRCL: { close: 118.36, change: -0.0612, start: 0.95, vol: 0.038 },
  GOOGL: { close: 166.21, change: -0.0143, start: 0.82, vol: 0.016 },
  INTC: { close: 24.63, change: 0.0019, start: 1.42, vol: 0.022 },
  META: { close: 612.55, change: 0.0218, start: 0.48, vol: 0.019 },
  MSFT: { close: 438.12, change: 0.0062, start: 0.77, vol: 0.013 },
  MSTR: { close: 352.8, change: -0.0331, start: 0.31, vol: 0.041 },
  NVDA: { close: 148.3, change: 0.0297, start: 0.19, vol: 0.027 },
  SNDK: { close: 72.18, change: 0.0004, start: 1.05, vol: 0.029 },
  SPCX: { close: 186.4, change: 0.0089, start: 0.58, vol: 0.021 },
  TSLA: { close: 241.6, change: -0.0254, start: 0.88, vol: 0.033 }
}

/** The day's move the panel picks: each stock its own way, all up a lot, nothing, or all down a lot. */
export type DayMove = "mixed" | "bigUp" | "flat" | "bigDown"

/** A listed stock as the preview knows it. */
export interface Listing {
  readonly symbol: StockSymbol
  readonly name: string
  readonly token: string
  readonly pool: string
  readonly logoUrl: string | null
}

export const LISTINGS: ReadonlyArray<Listing> = baseDeployment.stocks.map((stock) => ({
  symbol: stock.symbol as StockSymbol,
  name: stock.name,
  token: stock.token,
  pool: stock.pool?.address ?? stock.token,
  logoUrl: stock.logoUrl
}))

/** A stock's name, "NVIDIA". */
export const nameOf = (symbol: StockSymbol): string =>
  LISTINGS.find((listing) => listing.symbol === symbol)?.name ?? symbol

/** Dollars to a token price (USD × 1e8). */
export const toPrice = (dollars: number): Price => Price.make(BigInt(Math.max(0, Math.round(dollars * 1e8))))

/** A random number generator seeded by `seed`: the same sequence on every load. */
export const seeded = (seed: string): () => number => {
  let hash = 2_166_136_261
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 16_777_619)
  let state = hash >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

const gaussian = (random: () => number) => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())

/**
 * Daily closes from three years ago to the previous close, oldest first: a random walk pinned at its start, at what
 * the cast paid for the stock (around when it bought it) and at the previous close, so a holding's chart and its cost
 * agree.
 */
const dailyCloses = (symbol: StockSymbol, cast: Cast): ReadonlyArray<number> => {
  const profile = PROFILES[symbol]
  const random = seeded(`${symbol} daily`)
  const holding = cast.holdings.find((candidate) => candidate.symbol === symbol)
  const anchorDay = HISTORY_DAYS - (cast.scenario === "heavy" ? 70 : cast.scenario === "starter" ? 1 : 14)
  const anchors: ReadonlyArray<readonly [number, number]> = [
    [0, profile.close * profile.start],
    ...(holding === undefined ? [] : [[anchorDay, holding.costPerShare] as const]),
    [HISTORY_DAYS, profile.close]
  ]

  const closes: Array<number> = []
  for (let segment = 0; segment < anchors.length - 1; segment++) {
    const [fromDay, fromPrice] = anchors[segment]!
    const [toDay, toPrice] = anchors[segment + 1]!
    const steps = toDay - fromDay
    const walk = [0]
    for (let step = 1; step <= steps; step++) walk.push(walk[step - 1]! + gaussian(random) * profile.vol)

    // A Brownian bridge: the walk, bent so it ends where the next anchor is.
    const gap = Math.log(toPrice) - Math.log(fromPrice) - walk[steps]!
    for (let step = segment === 0 ? 0 : 1; step <= steps; step++) {
      closes.push(fromPrice * Math.exp(walk[step]! + (gap * step) / steps))
    }
  }
  return closes
}

/** A stock's price now: its previous close, today's move and the panel's nudges. */
export interface LivePrice {
  readonly symbol: StockSymbol
  /** Dollars per token. */
  price: number
  readonly previousClose: number
  tradedAt: number
  /** Chainlink's price, dollars per token. */
  reference: number
  referenceAt: number
}

/** Today's move of `symbol` under `move`. */
export const changeOf = (symbol: StockSymbol, move: DayMove): number => {
  const spread = (seeded(`${symbol} move`)() - 0.5) * 0.03
  switch (move) {
    case "mixed":
      return PROFILES[symbol].change
    case "bigUp":
      return 0.075 + spread
    case "flat":
      return spread / 30
    case "bigDown":
      return -0.075 + spread
  }
}

/** Every stock's price at `now`, after `move`. */
export const livePrices = (move: DayMove, now: number): Map<StockSymbol, LivePrice> =>
  new Map(LISTINGS.map(({ symbol }) => {
    const previousClose = PROFILES[symbol].close
    const price = previousClose * (1 + changeOf(symbol, move))
    const reference = price * (1 + (seeded(`${symbol} reference`)() - 0.5) * 0.0012)
    return [symbol, { symbol, price, previousClose, tradedAt: now - 4_000, reference, referenceAt: now - 38_000 }]
  }))

/** The price history of every stock, and a stock's price at any moment of it. */
export interface PriceBook {
  readonly closes: ReadonlyMap<StockSymbol, ReadonlyArray<number>>
  /** When the history's last daily close was: a day before the tab opened. */
  readonly lastCloseAt: number
}

export const makePriceBook = (cast: Cast, now: number): PriceBook => ({
  closes: new Map(LISTINGS.map(({ symbol }) => [symbol, dailyCloses(symbol, cast)])),
  lastCloseAt: now - DAY
})

// A wiggle that is zero at both ends of a segment, so the path between two closes passes through them.
const wiggle = (symbol: StockSymbol, segment: number, fraction: number) => {
  const random = seeded(`${symbol} ${segment}`)
  let sum = 0
  for (let harmonic = 1; harmonic <= 3; harmonic++) {
    sum += Math.sin(2 * Math.PI * (harmonic * fraction + random())) / harmonic
  }
  return sum * Math.sin(Math.PI * fraction)
}

/** What `symbol` cost at `at` (dollars): between two daily closes, a smooth path through both; after the last, on to today's price. */
export const priceAt = (book: PriceBook, live: LivePrice, at: number): number => {
  const closes = book.closes.get(live.symbol)!
  const day = HISTORY_DAYS - (book.lastCloseAt - at) / DAY
  if (day <= 0) return closes[0]!

  const segment = Math.floor(day)
  if (segment > HISTORY_DAYS) return live.price

  const fraction = day - segment
  const from = closes[segment]!
  const to = segment === HISTORY_DAYS ? live.price : closes[segment + 1]!
  const amplitude = PROFILES[live.symbol].vol * 0.45
  return Math.exp(
    Math.log(from) + (Math.log(to) - Math.log(from)) * fraction + amplitude * wiggle(live.symbol, segment, fraction)
  )
}

const RANGES: Readonly<Record<HistoryRange, { readonly span: number; readonly step: number }>> = {
  "1D": { span: DAY, step: 5 * 60_000 },
  "1W": { span: 7 * DAY, step: 40 * 60_000 },
  "1M": { span: 30 * DAY, step: 3 * HOUR },
  "3M": { span: 90 * DAY, step: DAY },
  "ALL": { span: HISTORY_DAYS * DAY, step: 4 * DAY }
}

/** A chart of `range` ending at `now`: 90 to 290 points, the last one today's price. */
export const historyOf = (
  book: PriceBook,
  live: LivePrice,
  range: HistoryRange,
  now: number
): ReadonlyArray<{ readonly at: number; readonly price: number }> => {
  const { span, step } = RANGES[range]
  const points: Array<{ at: number; price: number }> = []
  for (let at = now - span; at < now; at += step) points.push({ at, price: priceAt(book, live, at) })
  points.push({ at: now, price: live.price })
  return points
}
