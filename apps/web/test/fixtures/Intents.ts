// Intents as the API returns them.
import { IntentId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import { AGENT_ID } from "./Agents.ts"

export const INTENT_ID = IntentId.make("intent_01jd8v4t5m6n7a8q9r0s1t2v3w")

/** A $50 Nvidia buy through the fixture agent, asked at `createdAt`. */
export const nvidiaBuy = (createdAt: string): Intent =>
  new Intent({
    id: INTENT_ID,
    agentId: AGENT_ID,
    source: "assistant",
    executor: "agent",
    leg: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } },
    reason: "You asked for $50 of Nvidia.",
    status: "needsApproval",
    decision: null,
    tradeId: null,
    expiresAt: null,
    createdAt: DateTime.makeUnsafe(createdAt),
    updatedAt: DateTime.makeUnsafe(createdAt)
  })
