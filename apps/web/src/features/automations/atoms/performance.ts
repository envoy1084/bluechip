import type { AutomationId } from "@bluechip/domain/Ids"
import * as Atom from "effect/reactivity/Atom"
import {
  automationsReactivityKey,
  BluechipApiClient,
  intentsReactivityKey,
  portfolioReactivityKey
} from "../../../lib/api/client.ts"

/** What an automation's runs did, from the ledger; refetched when it runs or its trades fill. */
export const automationPerformanceAtom = Atom.family((id: AutomationId) =>
  BluechipApiClient.query("performance", "automation", {
    params: { id },
    reactivityKeys: [automationsReactivityKey, intentsReactivityKey, portfolioReactivityKey]
  })
)
