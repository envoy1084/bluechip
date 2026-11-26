import { assert, describe, it } from "@effect/vitest"
import { withdrawalOutcome } from "../../../../../src/features/funding/model/withdrawalOutcome.ts"

describe("withdrawalOutcome", () => {
  it("on its way", () => {
    assert.deepStrictEqual(withdrawalOutcome("pending", 150_000_000n, "0x12ab"), {
      tone: "pending",
      title: "Sending $150.00",
      description: "To 0x12ab. Base confirms it in a couple of seconds."
    })
  })

  it("confirmed", () => {
    assert.deepStrictEqual(withdrawalOutcome("confirmed", 150_000_000n, "0x12ab"), {
      tone: "success",
      title: "$150.00 sent",
      description: "The USDC is at 0x12ab on Base."
    })
  })

  it("failed", () => {
    assert.deepStrictEqual(withdrawalOutcome("failed", 150_000_000n, "0x12ab"), {
      tone: "failure",
      title: "Your withdrawal didn't go through",
      description: "Base didn't take it. Your cash is still in your account."
    })
  })
})
