import { linkCodeIn } from "@bluechip/domain/channels/Channel"
import { assert, describe, it } from "@effect/vitest"

describe("linkCodeIn", () => {
  it.each(
    [
      { text: "K7MQ2X9P", expected: "K7MQ2X9P" },
      { text: "/start K7MQ2X9P", expected: "K7MQ2X9P" },
      { text: "/start@bluechip_market_bot K7MQ2X9P", expected: "K7MQ2X9P" },
      { text: "  k7mq-2x9p ", expected: "K7MQ2X9P" },
      { text: "K7MQ2X9", expected: null },
      { text: "K7MQ2X9PQ", expected: null },
      { text: "K0MQ2X9P", expected: null },
      { text: "/start", expected: null },
      { text: "what's my balance?", expected: null }
    ] as const
  )("$text", ({ expected, text }) => {
    assert.strictEqual(linkCodeIn(text), expected)
  })
})
