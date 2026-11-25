import { costMicros, isSpent, type TokenUsage } from "@bluechip/domain/assistant/Budget"
import { assert, describe, it } from "@effect/vitest"

const none: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

describe("costMicros", () => {
  it.each<{ name: string; model: string; usage: TokenUsage; expected: number }>([
    { name: "nothing used costs nothing", model: "claude-sonnet-5-5", usage: none, expected: 0 },
    {
      name: "a million input tokens on Sonnet: $2",
      model: "claude-sonnet-5-5",
      usage: { ...none, inputTokens: 1_000_000 },
      expected: 2_000_000
    },
    {
      name: "a million output tokens on Sonnet: $10",
      model: "claude-sonnet-5-5",
      usage: { ...none, outputTokens: 1_000_000 },
      expected: 10_000_000
    },
    {
      name: "a million cached tokens read on Sonnet: 20 cents",
      model: "claude-sonnet-5-5",
      usage: { ...none, cacheReadTokens: 1_000_000 },
      expected: 200_000
    },
    {
      name: "a million tokens written to the cache on Sonnet: $2.50",
      model: "claude-sonnet-5-5",
      usage: { ...none, cacheWriteTokens: 1_000_000 },
      expected: 2_500_000
    },
    {
      name: "a thousand tokens each way on Haiku",
      model: "claude-haiku-5-5",
      usage: { ...none, inputTokens: 1000, outputTokens: 1000 },
      expected: 600
    },
    {
      name: "one token on Haiku rounds up to a micro-dollar",
      model: "claude-haiku-5-5",
      usage: { ...none, inputTokens: 1 },
      expected: 1
    },
    {
      name: "an unknown model is charged as Sonnet",
      model: "claude-future-9",
      usage: { ...none, inputTokens: 1_000_000 },
      expected: 2_000_000
    }
  ])("$name", ({ expected, model, usage }) => {
    assert.strictEqual(costMicros(model, usage), expected)
  })
})

describe("isSpent", () => {
  it.each([
    { name: "a micro-dollar under the limit", costMicros: 999_999, expected: false },
    { name: "at the limit", costMicros: 1_000_000, expected: true },
    { name: "over the limit", costMicros: 1_000_001, expected: true }
  ])("$name", ({ costMicros, expected }) => {
    assert.strictEqual(isSpent({ costMicros, limitMicros: 1_000_000 }), expected)
  })
})
