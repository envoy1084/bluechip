import { Memory } from "@bluechip/domain/assistant/Memory"
import { systemPrompt } from "@bluechip/domain/assistant/SystemPrompt"
import { MemoryId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const AT = DateTime.makeUnsafe("2026-11-20T10:00:00Z")

describe("systemPrompt", () => {
  it("a confirmed memory is in it, with its id, as a note about the user", () => {
    const prompt = systemPrompt({
      today: "2026-11-26",
      agents: [],
      focus: null,
      memories: [
        new Memory({
          id: MemoryId.make("memory_01jd8v4t5m6n7p8q9r0s1t2v3w"),
          agentId: null,
          kind: "preference",
          text: "You avoid Tesla.",
          source: "said",
          confidence: 1,
          note: null,
          messageId: null,
          confirmedAt: AT,
          createdAt: AT,
          lastUsedAt: null
        })
      ]
    })

    assert.match(prompt, /- memory_01jd8v4t5m6n7p8q9r0s1t2v3w \(preference\): You avoid Tesla\./)
  })

  it("a memory waiting for the user's confirmation is left out", () => {
    const prompt = systemPrompt({
      today: "2026-11-26",
      agents: [],
      focus: null,
      memories: [
        new Memory({
          id: MemoryId.make("memory_01jd8v4t5m6n7p8q9r0s1t2v3w"),
          agentId: null,
          kind: "fact",
          text: "You live in Berlin.",
          source: "inferred",
          confidence: 0.6,
          note: null,
          messageId: null,
          confirmedAt: null,
          createdAt: AT,
          lastUsedAt: null
        })
      ]
    })

    assert.notInclude(prompt, "Berlin")
  })

  it("with nothing remembered and no agents, it says so", () => {
    const prompt = systemPrompt({ today: "2026-11-26", agents: [], focus: null, memories: [] })

    assert.include(prompt, "## The user's agents\nNone yet.")
  })

  it("it carries today's date", () => {
    const prompt = systemPrompt({ today: "2026-11-26", agents: [], focus: null, memories: [] })

    assert.include(prompt, "## Today\n2026-11-26 (UTC)")
  })
})
