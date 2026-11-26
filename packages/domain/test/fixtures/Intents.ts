// Intents as the API returns them, at any status.
import { AgentId, IntentId } from "@bluechip/domain/Ids"
import { type Decision, Intent, type IntentStatus } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"

export const INTENT_ID = IntentId.make("intent_01jd8v4t5m6n7a8q9r0s1t2v3w")
export const AGENT_ID = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3w")

/** A $50 Nvidia buy through {@link AGENT_ID}, from the assistant, at `status`. */
export const nvidiaBuy = (status: IntentStatus, decision: Decision | null = null): Intent =>
  new Intent({
    id: INTENT_ID,
    agentId: AGENT_ID,
    source: "assistant",
    executor: "agent",
    leg: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } },
    reason: "You asked for $50 of Nvidia.",
    status,
    decision,
    tradeId: null,
    expiresAt: null,
    createdAt: DateTime.makeUnsafe("2026-11-26T10:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-11-26T10:00:00Z")
  })
