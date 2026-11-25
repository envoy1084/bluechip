/**
 * A ticker chip's colors, taken from the company's own brand: a top-to-bottom gradient and the text on it. Every pair
 * keeps the text at WCAG AA (4.5:1) against both ends of the gradient.
 */
export interface TickerColors {
  readonly top: string
  /** The gradient's bottom, also the stock's solid color in charts and allocation bars. */
  readonly bottom: string
  readonly text: string
}

export interface Ticker {
  /** The stock's market symbol, shown in Doto on the chip. */
  readonly symbol: string
  readonly name: string
  readonly colors: TickerColors
}

/** The stocks bluechip trades, by symbol. */
export const TICKERS: ReadonlyArray<Ticker> = [
  { symbol: "AAPL", name: "Apple", colors: { top: "#3a3a3c", bottom: "#1d1d1f", text: "#ffffff" } },
  // Amazon's squid ink with its smile orange as the text.
  { symbol: "AMZN", name: "Amazon", colors: { top: "#303f52", bottom: "#232f3e", text: "#ff9900" } },
  { symbol: "ANT", name: "Anthropic", colors: { top: "#e08a6d", bottom: "#d97757", text: "#141413" } },
  // Circle's navy with the mint of its ring mark.
  { symbol: "CRCL", name: "Circle", colors: { top: "#1d2b4f", bottom: "#0f1a33", text: "#8ff0dd" } },
  // Google blue is too light for white text at AA, so it carries navy.
  { symbol: "GOOGL", name: "Alphabet", colors: { top: "#5a95f5", bottom: "#4285f4", text: "#061a40" } },
  { symbol: "INTC", name: "Intel", colors: { top: "#0071c5", bottom: "#0068b5", text: "#ffffff" } },
  { symbol: "META", name: "Meta", colors: { top: "#0866ff", bottom: "#0052d6", text: "#ffffff" } },
  { symbol: "MSFT", name: "Microsoft", colors: { top: "#0078d4", bottom: "#0067b8", text: "#ffffff" } },
  { symbol: "MSTR", name: "Strategy", colors: { top: "#ff7a2f", bottom: "#fa660f", text: "#1f0a00" } },
  { symbol: "NVDA", name: "Nvidia", colors: { top: "#86c814", bottom: "#76b900", text: "#0c1a00" } },
  { symbol: "SNDK", name: "Sandisk", colors: { top: "#e01f26", bottom: "#b50e28", text: "#ffffff" } },
  { symbol: "SPCX", name: "SpaceX", colors: { top: "#1c1e22", bottom: "#000000", text: "#e6e9ee" } },
  // Tesla red, deepened a little so white text passes AA at the top of the gradient.
  { symbol: "TSLA", name: "Tesla", colors: { top: "#dc1f26", bottom: "#b8141a", text: "#ffffff" } }
]

/** Base Blue, for any symbol bluechip doesn't know. */
const BASE_BLUE: TickerColors = { top: "#4c76ff", bottom: "#2a5bff", text: "#ffffff" }

/** The stock for a market symbol, if bluechip trades it. */
export const findTicker = (symbol: string): Ticker | undefined => TICKERS.find((ticker) => ticker.symbol === symbol)

/** The chip colors for a symbol; anything bluechip doesn't trade is Base Blue. */
export const tickerColors = (symbol: string): TickerColors => findTicker(symbol)?.colors ?? BASE_BLUE
