// What the chat's result cards are built from: specs with the limits a test names, a portfolio, and tool rows with
// results encoded as the server stores them.
import { Address, IntentId } from "@bluechip/domain/Ids"
import { Intent, type IntentStatus, type Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { MarketPrice, ReferencePrice, Stock } from "@bluechip/domain/market/Market"
import { Bps, Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { AgentSpec, type PolicyEntry } from "@bluechip/domain/policies/AgentSpec"
import { Holding, Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import type { BluechipTurn, ShownCard, ToolRow } from "../../src/features/assistant/model/thread.ts"
import { nvidiaBuy } from "./Intents.ts"

export const AS_OF = "2026-11-26T15:00:00Z"

/** A spec of exactly `policies`. */
export const specOf = (policies: ReadonlyArray<PolicyEntry>): AgentSpec => new AgentSpec({ policies })

/** Whole dollars in USDC units. */
export const usd = (dollars: number): Usdc => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))

/** A holding worth `dollars`, priced at `price` dollars a share (its weight of a $1,000 portfolio). */
export const holdingOf = (symbol: StockSymbol, dollars: number, price: number): Holding =>
  new Holding({
    symbol,
    shares: Shares.make(BigInt(Math.round(dollars / price * 1e8))),
    price: new MarketPrice({
      symbol,
      price: Price.make(BigInt(Math.round(price * 1e8))),
      tradedAt: DateTime.makeUnsafe(AS_OF),
      previousClose: null
    }),
    value: usd(dollars),
    weightBps: Bps.make(Math.round(dollars * 10)),
    change24h: null
  })

/** A portfolio of `cash` dollars and `holdings`, up `change` dollars since the previous close, read at `asOf`. */
export const portfolioOf = (
  cash: number,
  holdings: ReadonlyArray<Holding>,
  change = 0,
  asOf: string = AS_OF
): Portfolio => {
  const invested = holdings.reduce((sum, holding) => sum + holding.value, BigInt(0))
  return new Portfolio({
    cash: usd(cash),
    invested: Usdc.make(invested),
    value: Usdc.make(invested + usd(cash)),
    holdings,
    change24h: BigInt(Math.round(change * 1_000_000)),
    asOf: DateTime.makeUnsafe(asOf)
  })
}

/** A value as a tool's result is stored: JSON from its success schema. */
export const encoded = <A>(schema: Schema.Codec<A, unknown>, value: A): unknown =>
  Schema.encodeUnknownSync(Schema.toCodecJson(schema))(value)

/** A tool row of `name` at `state`, with what it returned and was asked. */
export const toolRow = (
  id: string,
  name: string,
  state: ToolRow["state"],
  result: unknown = null,
  params: unknown = {}
): ToolRow => ({ id, name, state, summary: null, params, result })

/** A finished turn with `tools` and `cards`. */
export const turnOf = (tools: ReadonlyArray<ToolRow>, cards: ReadonlyArray<ShownCard> = []): BluechipTurn => ({
  _tag: "Bluechip",
  id: "turn-1",
  tools,
  text: "",
  cards,
  status: "done",
  error: null
})

/** The fixture agent's trade of `leg` at `status`, with its own id `n`. */
export const legIntent = (n: number, leg: Leg, status: IntentStatus = "proposed"): Intent =>
  new Intent({ ...nvidiaBuy(AS_OF), id: IntentId.make(`intent_01jd8v4t5m6n7a8q9r0s1t2v${n}w`), leg, status })

export const buyOf = (symbol: StockSymbol, dollars: number): Leg => ({
  symbol,
  side: "buy",
  amount: { usdc: usd(dollars) }
})

export const sellOf = (symbol: StockSymbol, shares: number): Leg => ({
  symbol,
  side: "sell",
  amount: { shares: Shares.make(BigInt(Math.round(shares * 1e8))) }
})

/** A stock at `price` dollars, up 1.52% and Chainlink's price the same; `price: null` for one without a price. */
export const stockOf = (symbol: StockSymbol, name: string, price: number | null): Stock => {
  const at = DateTime.makeUnsafe(AS_OF)
  const units = price === null ? null : Price.make(BigInt(Math.round(price * 1e8)))
  return new Stock({
    symbol,
    name,
    token: Address.make("0x2f8c0000000000000000000000000000000a11ce"),
    tradable: true,
    logoUrl: null,
    price: units === null ? null : new MarketPrice({ symbol, price: units, tradedAt: at, previousClose: null }),
    reference: units === null ? null : new ReferencePrice({ symbol, price: units, updatedAt: at, status: "live" }),
    change24h: units === null ? null : Bps.make(152)
  })
}
