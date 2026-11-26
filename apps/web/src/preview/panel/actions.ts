// Every panel action, for the store to play saved ones again.
import type { ActionDef } from "../store.ts"
import { ACCOUNT_ACTIONS } from "./actions/account.ts"
import { AGENTS_ACTIONS } from "./actions/agents.ts"
import { ASSISTANT_ACTIONS } from "./actions/assistant.ts"
import { MARKET_ACTIONS } from "./actions/market.ts"

export const ACTIONS: ReadonlyArray<ActionDef> = [
  ...ACCOUNT_ACTIONS,
  ...MARKET_ACTIONS,
  ...AGENTS_ACTIONS,
  ...ASSISTANT_ACTIONS
]
