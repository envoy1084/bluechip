/**
 * The `news` trigger: a story about some stocks, or mentioning a topic. Each story is its own window. What it leads
 * to asks you first unless the automation's settings let it act directly, because a story is untrusted text.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import { listNames } from "../../policies/Format.ts"
import { stockProblems } from "../AgentLimits.ts"
import { Field } from "../Entry.ts"
import * as Trigger from "../Trigger.ts"

/**
 * The stocks a story must be about, and the topics it may mention instead (words or phrases).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const NewsConfig = Schema.Struct({
  symbols: Schema.Array(StockSymbol),
  topics: Schema.Array(Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(40)))
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NewsConfig = typeof NewsConfig.Type

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const news = Trigger.make({
  type: "news",
  watcher: "news",
  marketHours: false,
  asks: true,
  title: "News",
  summary: "When there is a story about stocks or a topic you pick.",
  aliases: ["headlines", "announcement", "earnings news", "press release", "bad news"],
  examples: ["If there's material bad news on my chip stocks, ask me whether to sell"],
  config: NewsConfig,
  fields: {
    symbols: new Field({ label: "Stocks", unit: "stocks" }),
    topics: new Field({ label: "Topics", unit: "text" })
  },
  defaults: { symbols: ["NVDA"], topics: [] },
  check: (config, context) => [
    ...(config.symbols.length + config.topics.length === 0 ?
      [{ field: "symbols", message: "Pick a stock or a topic." }] :
      []),
    ...stockProblems("symbols", config.symbols, context)
  ],
  describe: (config, { name }) => {
    const about = [...config.symbols.map(name), ...config.topics.map((topic) => `"${topic}"`)]
    return `when there is news about ${listNames(about)}`
  }
})

/**
 * Whether a story fires a `news` automation: it is about one of its stocks, or its headline or summary mentions one
 * of its topics (ignoring case).
 *
 * @stability unstable
 * @category watching
 * @since 0.0.0
 */
export const matchesNews = (
  config: NewsConfig,
  story: { readonly symbols: ReadonlyArray<string>; readonly headline: string; readonly summary: string }
): boolean => {
  if (story.symbols.some((symbol) => (config.symbols as ReadonlyArray<string>).includes(symbol))) return true
  const text = `${story.headline} ${story.summary}`.toLowerCase()
  return config.topics.some((topic) => text.includes(topic.toLowerCase()))
}
