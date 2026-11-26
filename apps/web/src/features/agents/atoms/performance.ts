import type { AgentId } from "@bluechip/domain/Ids"
import * as Atom from "effect/reactivity/Atom"
import {
  BluechipApiClient,
  intentsReactivityKey,
  liveReactivityKey,
  portfolioReactivityKey
} from "../../../lib/api/client.ts"

/** What an agent contributed, from the ledger; refetched when its trades fill or are decided. */
export const agentPerformanceAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("performance", "agent", {
    params: { id },
    reactivityKeys: [portfolioReactivityKey, intentsReactivityKey, liveReactivityKey]
  })
)
