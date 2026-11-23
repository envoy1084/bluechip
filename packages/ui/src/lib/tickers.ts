/** A ticker chip's color. Each of the 10 stocks keeps one tone everywhere; `blue` is Base Blue. */
export type TickerTone = "blue" | "yellow" | "green" | "pink" | "ink" | "cerulean" | "lilac" | "tan"

export interface Ticker {
  /** The stock's market symbol, shown in Doto on the chip. */
  readonly symbol: string
  /** The onchain token that tracks it. */
  readonly token: string
  readonly name: string
  readonly tone: TickerTone
}

/** The ten stocks bluechip trades, in the kit's order (KIT.TICKERS). */
export const TICKERS: ReadonlyArray<Ticker> = [
  { symbol: "NVDA", token: "NVDAc", name: "Nvidia", tone: "green" },
  { symbol: "AAPL", token: "AAPLc", name: "Apple", tone: "ink" },
  { symbol: "MSFT", token: "MSFTc", name: "Microsoft", tone: "cerulean" },
  { symbol: "META", token: "METAc", name: "Meta", tone: "blue" },
  { symbol: "TSLA", token: "TSLAc", name: "Tesla", tone: "pink" },
  { symbol: "GOOGL", token: "GOOGLc", name: "Alphabet", tone: "yellow" },
  { symbol: "AMZN", token: "AMZNc", name: "Amazon", tone: "tan" },
  { symbol: "MSTR", token: "MSTRc", name: "Strategy", tone: "lilac" },
  { symbol: "SNDK", token: "SNDKc", name: "Sandisk", tone: "blue" },
  { symbol: "SPCX", token: "SPCXc", name: "SpaceX", tone: "ink" }
]

/** The stock for a market symbol, if it is one of the ten. */
export const findTicker = (symbol: string): Ticker | undefined => TICKERS.find((ticker) => ticker.symbol === symbol)

/** The chip tone for a symbol; anything that is not one of the ten stocks (USDC included) is Base Blue. */
export const tickerTone = (symbol: string): TickerTone => findTicker(symbol)?.tone ?? "blue"
