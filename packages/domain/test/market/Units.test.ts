import { Quote, ReferencePrice } from "@bluechip/domain/market/Market"
import { bpsBetween, lessBps, Price, priceOf, Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"

const nvdaPrice = Price.make(15203644218n) // $152.03644218

describe("Units", () => {
  it("values shares at a price, rounding down", () => {
    // 0.65626105 NVDA × $152.03644218 = $99.7756…, so 99.775595 USDC (never rounded up).
    assert.strictEqual(valueOf(Shares.make(65626105n), nvdaPrice), 99775595n)
    assert.strictEqual(valueOf(Shares.make(100000000n), Price.make(100000000n)), 1000000n)
  })

  it("buys whole units of shares, rounding down", () => {
    assert.strictEqual(sharesFor(Usdc.make(100000000n), nvdaPrice), 65773704n)
    assert.strictEqual(sharesFor(Usdc.make(1n), Price.make(0n)), 0n)
  })

  it("never creates value: buying then valuing returns at most what was spent", () => {
    for (const usdc of [1n, 999n, 100000000n, 123456789012n]) {
      for (const price of [1n, 15203644218n, 99999999999n]) {
        const back = valueOf(sharesFor(Usdc.make(usdc), Price.make(price)), Price.make(price))
        assert.isTrue(back <= usdc, `${usdc} at ${price} came back as ${back}`)
      }
    }
  })

  it("prices a trade per share", () => {
    // 100 USDC for 0.65626105 NVDA is $152.38 per share.
    assert.strictEqual(priceOf(Usdc.make(100000000n), Shares.make(65626105n)), 15237838662n)
  })

  it("measures gaps in basis points and applies slippage", () => {
    assert.strictEqual(bpsBetween(15237838662n, nvdaPrice), 22)
    assert.strictEqual(bpsBetween(99n, 100n), -100)
    assert.strictEqual(lessBps(1000000n, 50), 995000n)
  })

  it("sends amounts as exact integers in JSON", () => {
    const at = DateTime.makeUnsafe("2026-11-24T15:00:00Z")
    const quote = new Quote({
      symbol: "NVDA",
      side: "buy",
      usdc: Usdc.make(100000000n),
      shares: Shares.make(65626105n),
      price: Price.make(15237838662n),
      reference: new ReferencePrice({ symbol: "NVDA", price: nvdaPrice, updatedAt: at, status: "live" }),
      gapBps: 22,
      minimumOut: 65297974n,
      pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC" as never,
      quotedAt: at,
      expiresAt: at
    })
    const json = Schema.encodeSync(Schema.toCodecJson(Quote))(quote)
    const back = Schema.decodeUnknownSync(Schema.toCodecJson(Quote))(JSON.parse(JSON.stringify(json)))
    assert.strictEqual(back.shares, 65626105n)
    assert.strictEqual(back.minimumOut, 65297974n)
  })
})
