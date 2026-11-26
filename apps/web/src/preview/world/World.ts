// The made-up world: one slice per part of the app, each built from the scenario's cast at the moment the tab opened.
import { type AccountSlice, makeAccount } from "./account.ts"
import { type AgentsSlice, makeAgents } from "./agents.ts"
import { type AssistantSlice, makeAssistant } from "./assistant.ts"
import type { Cast } from "./cast.ts"
import { makeMarket, type MarketSlice } from "./market.ts"

export interface World {
  readonly cast: Cast
  /** When the tab opened: every made-up time counts back from it. */
  readonly now: Date
  readonly account: AccountSlice
  readonly market: MarketSlice
  readonly agents: AgentsSlice
  readonly assistant: AssistantSlice
}

/** The world of `cast` as of `now`. */
export const makeWorld = (cast: Cast, now: Date): World => {
  // The agents' journals and usage are told from the market's trades, so every page counts the same ones.
  const market = makeMarket(cast, now)
  return {
    cast,
    now,
    account: makeAccount(cast, now),
    market,
    agents: makeAgents(cast, now, market),
    assistant: makeAssistant(cast, now)
  }
}
