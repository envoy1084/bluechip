import { Quote, ReferencePrice } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"

describe("Quote", () => {
  it("encodes amounts as exact integer strings in JSON", () => {
    const at = DateTime.makeUnsafe("2026-11-24T15:00:00Z")
    const quote = new Quote({
      symbol: "NVDA",
      side: "buy",
      usdc: Usdc.make(100_000_000n),
      shares: Shares.make(65_626_105n),
      price: Price.make(15_237_838_662n),
      reference: new ReferencePrice({
        symbol: "NVDA",
        price: Price.make(15_203_644_218n),
        updatedAt: at,
        status: "live"
      }),
      gapBps: 22,
      minimumOut: 65_297_974n,
      pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC" as never,
      quotedAt: at,
      expiresAt: at
    })

    const json = Schema.encodeSync(Schema.toCodecJson(Quote))(quote)

    assert.deepStrictEqual(json, {
      symbol: "NVDA",
      side: "buy",
      usdc: "100000000",
      shares: "65626105",
      price: "15237838662",
      reference: { symbol: "NVDA", price: "15203644218", updatedAt: "2026-11-24T15:00:00.000Z", status: "live" },
      gapBps: 22,
      minimumOut: "65297974",
      pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC",
      quotedAt: "2026-11-24T15:00:00.000Z",
      expiresAt: "2026-11-24T15:00:00.000Z"
    })
  })

  it("decodes its JSON back to the same quote", () => {
    const at = DateTime.makeUnsafe("2026-11-24T15:00:00Z")
    const json = {
      symbol: "NVDA",
      side: "buy",
      usdc: "100000000",
      shares: "65626105",
      price: "15237838662",
      reference: { symbol: "NVDA", price: "15203644218", updatedAt: "2026-11-24T15:00:00.000Z", status: "live" },
      gapBps: 22,
      minimumOut: "65297974",
      pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC",
      quotedAt: "2026-11-24T15:00:00.000Z",
      expiresAt: "2026-11-24T15:00:00.000Z"
    }

    const quote = Schema.decodeUnknownSync(Schema.toCodecJson(Quote))(json)

    assert.deepStrictEqual(
      quote,
      new Quote({
        symbol: "NVDA",
        side: "buy",
        usdc: Usdc.make(100_000_000n),
        shares: Shares.make(65_626_105n),
        price: Price.make(15_237_838_662n),
        reference: new ReferencePrice({
          symbol: "NVDA",
          price: Price.make(15_203_644_218n),
          updatedAt: at,
          status: "live"
        }),
        gapBps: 22,
        minimumOut: 65_297_974n,
        pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC" as never,
        quotedAt: at,
        expiresAt: at
      })
    )
  })
})
