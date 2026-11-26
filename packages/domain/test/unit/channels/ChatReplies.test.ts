import { agentStanding, chatAgents, chatPortfolio } from "@bluechip/domain/channels/ChatReplies"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

describe("chatPortfolio", () => {
  it("cash and two holdings", () => {
    assert.strictEqual(
      chatPortfolio({
        value: Usdc.make(1_250_500_000n),
        cash: Usdc.make(100_000_000n),
        holdings: [
          { symbol: "NVDA", shares: Shares.make(500_000_000n), value: Usdc.make(1_000_000_000n) },
          { symbol: "AAPL", shares: Shares.make(100_000_000n), value: Usdc.make(150_500_000n) }
        ] as never
      }, (symbol) => symbol === "NVDA" ? "NVIDIA" : "Apple"),
      "**Total value: $1,250.50**\nCash: $100.00\nNVIDIA: 5 shares, $1,000.00\nApple: 1 share, $150.50"
    )
  })

  it("cash only", () => {
    assert.strictEqual(
      chatPortfolio({ value: Usdc.make(0n), cash: Usdc.make(0n), holdings: [] }, () => ""),
      "**Total value: $0.00**\nCash: $0.00\nNo stocks yet."
    )
  })
})

describe("agentStanding", () => {
  it.each(
    [
      { status: "active", paused: false, expected: "trading" },
      { status: "active", paused: true, expected: "paused" },
      { status: "draft", paused: false, expected: "not locked yet" },
      { status: "locking", paused: false, expected: "locking on Base" },
      { status: "updating", paused: true, expected: "changing on Base" },
      { status: "removing", paused: false, expected: "being removed" },
      { status: "expired", paused: false, expected: "ended, renew it to keep it trading" },
      { status: "removed", paused: false, expected: "removed" }
    ] as const
  )("$status, paused $paused", ({ expected, paused, status }) => {
    assert.strictEqual(agentStanding({ status, paused }), expected)
  })
})

describe("chatAgents", () => {
  it("no agents", () => {
    assert.strictEqual(chatAgents([]), "You have no agents yet. Make one in bluechip, or ask me to draft one.")
  })

  it("removed agents are left out", () => {
    assert.strictEqual(
      chatAgents([
        { name: "Tech picker", status: "active", paused: false },
        { name: "Old", status: "removed", paused: false }
      ]),
      "**Your agents**\nTech picker: trading"
    )
  })
})
