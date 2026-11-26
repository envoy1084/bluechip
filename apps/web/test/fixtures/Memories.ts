// A memory as the memory page lists it: something you said, confirmed.
import { Memory } from "@bluechip/domain/assistant/Memory"
import { MemoryId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"

export const MEMORY = new Memory({
  id: MemoryId.make("memory_01jd8v4t5m6n7a8q9r0s1t2v3w"),
  agentId: null,
  kind: "constraint",
  text: "You never want Tesla.",
  source: "said",
  confidence: 1,
  note: null,
  messageId: null,
  confirmedAt: DateTime.makeUnsafe("2026-11-20T10:00:00Z"),
  createdAt: DateTime.makeUnsafe("2026-11-20T10:00:00Z"),
  lastUsedAt: null,
  uses: 0
})
