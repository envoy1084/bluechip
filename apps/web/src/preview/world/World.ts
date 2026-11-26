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
export const makeWorld = (cast: Cast, now: Date): World => ({
  cast,
  now,
  account: makeAccount(cast, now),
  market: makeMarket(cast, now),
  agents: makeAgents(cast, now),
  assistant: makeAssistant(cast, now)
})
