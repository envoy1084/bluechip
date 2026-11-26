// Memories as the memory page lists them: three confirmed (a limit, a fact, a preference) and one guess waiting.
import { Memory } from "@bluechip/domain/assistant/Memory"
import { MemoryId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"

const AT = DateTime.makeUnsafe("2026-11-20T10:00:00Z")

const base = {
  agentId: null,
  source: "said",
  confidence: 1,
  note: null,
  messageId: null,
  confirmedAt: AT,
  createdAt: AT,
  lastUsedAt: null,
  uses: 0
} as const

export const TESLA = new Memory({
  ...base,
  id: MemoryId.make("memory_01jd8v4t5m6n7a8q9r0s1t2v30"),
  kind: "constraint",
  text: "You never want Tesla."
})

export const LISBON = new Memory({
  ...base,
  id: MemoryId.make("memory_01jd8v4t5m6n7a8q9r0s1t2v31"),
  kind: "fact",
  text: "You live in Lisbon."
})

export const CHIPS = new Memory({
  ...base,
  id: MemoryId.make("memory_01jd8v4t5m6n7a8q9r0s1t2v32"),
  kind: "preference",
  text: "You like chip makers."
})

export const GUESS = new Memory({
  ...base,
  id: MemoryId.make("memory_01jd8v4t5m6n7a8q9r0s1t2v33"),
  kind: "fact",
  source: "inferred",
  confidence: 0.6,
  text: "You work nights.",
  confirmedAt: null
})
