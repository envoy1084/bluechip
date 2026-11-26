import { replay, unrealised } from "@bluechip/domain/ledger/Lots"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { closed, opened } from "../../fixtures/Lots.ts"

describe("replay", () => {
  it("no entries: no lots, nothing closed", () => {
    assert.deepStrictEqual(replay([]), { lots: [], closings: [] })
  })

  it("one buy: one open lot holding all it cost", () => {
    const result = replay([opened("t1", 100n, 1_000n, 1)])

    assert.deepStrictEqual(result, {
      lots: [{
        source: "t1",
        agentId: null,
        shares: 100n,
        cost: 1_000n,
        remaining: 100n,
        remainingCost: 1_000n,
        openedAt: 1,
        closedAt: null,
        flagged: false
      }],
      closings: []
    })
  })

  it("a partial sale: the lot keeps the rest of its cost, the sale realises the difference", () => {
    const result = replay([opened("t1", 100n, 1_000n, 1), closed("t2", 40n, 480n, 2, "agent_a")])

    assert.deepStrictEqual(result.lots.map((lot) => [lot.remaining, lot.remainingCost, lot.closedAt]), [[
      60n,
      600n,
      null
    ]])
    assert.deepStrictEqual(result.closings, [{
      lot: "t1",
      source: "t2",
      agentId: "agent_a",
      openedBy: null,
      shares: 40n,
      cost: 400n,
      proceeds: 480n,
      realised: 80n,
      at: 2,
      flagged: false
    }])
  })

  it("a sale of the whole lot closes it at the sale's time", () => {
    const result = replay([opened("t1", 100n, 1_000n, 1), closed("t2", 100n, 900n, 5)])

    assert.deepStrictEqual(result.lots.map((lot) => [lot.remaining, lot.remainingCost, lot.closedAt]), [[0n, 0n, 5]])
    assert.deepStrictEqual(result.closings.map((closing) => closing.realised), [-100n])
  })

  it("several lots, one sale inside the first: the later lots stay whole", () => {
    const result = replay([opened("t1", 100n, 1_000n, 1), opened("t2", 50n, 750n, 2), closed("t3", 30n, 360n, 3)])

    assert.deepStrictEqual(result.lots.map((lot) => [lot.source, lot.remaining, lot.remainingCost]), [
      ["t1", 70n, 700n],
      ["t2", 50n, 750n]
    ])
    assert.deepStrictEqual(result.closings.map((closing) => [closing.lot, closing.cost, closing.proceeds]), [
      ["t1", 300n, 360n]
    ])
  })

  it("a sale across lots: oldest first, proceeds split by shares", () => {
    const result = replay([
      opened("t1", 100n, 1_000n, 1, "agent_a"),
      opened("t2", 100n, 2_000n, 2, "agent_b"),
      closed("t3", 150n, 3_000n, 3)
    ])

    assert.deepStrictEqual(result.lots.map((lot) => [lot.source, lot.remaining, lot.remainingCost]), [
      ["t1", 0n, 0n],
      ["t2", 50n, 1_000n]
    ])
    assert.deepStrictEqual(
      result.closings.map((closing) => [closing.lot, closing.openedBy, closing.shares, closing.cost, closing.proceeds]),
      [["t1", "agent_a", 100n, 1_000n, 2_000n], ["t2", "agent_b", 50n, 1_000n, 1_000n]]
    )
  })

  it("rounding: a part's cost and proceeds round down, the remainder stays with the lot and the last part", () => {
    const result = replay([opened("t1", 3n, 100n, 1), opened("t2", 3n, 100n, 2), closed("t3", 4n, 101n, 3)])

    assert.deepStrictEqual(result.lots.map((lot) => [lot.remaining, lot.remainingCost]), [[0n, 0n], [2n, 67n]])
    assert.deepStrictEqual(result.closings.map((closing) => [closing.cost, closing.proceeds]), [[100n, 75n], [
      33n,
      26n
    ]])
  })

  it("rounding: two thirds sold one third at a time leave nothing of the cost behind", () => {
    const result = replay([opened("t1", 3n, 100n, 1), closed("t2", 1n, 40n, 2), closed("t3", 2n, 80n, 3)])

    assert.deepStrictEqual(result.closings.map((closing) => closing.cost), [33n, 67n])
    assert.deepStrictEqual(result.lots.map((lot) => lot.remainingCost), [0n])
  })

  it("a lot that cost nothing: the whole sale is profit", () => {
    const result = replay([opened("t1", 100n, 0n, 1), closed("t2", 100n, 500n, 2)])

    assert.deepStrictEqual(result.closings.map((closing) => [closing.cost, closing.realised]), [[0n, 500n]])
  })

  it("a sale of more than the lots hold: the rest closes at no cost, flagged", () => {
    const result = replay([opened("t1", 10n, 100n, 1), closed("t2", 15n, 300n, 2)])

    assert.deepStrictEqual(
      result.closings.map((closing) => [closing.lot, closing.shares, closing.cost, closing.proceeds, closing.flagged]),
      [
        ["t1", 10n, 100n, 200n, false],
        [null, 5n, 0n, 100n, true]
      ]
    )
  })

  it("a sale with no lots at all: everything closes at no cost, flagged", () => {
    const result = replay([closed("t1", 10n, 100n, 1)])

    assert.deepStrictEqual(result.closings.map((closing) => [closing.lot, closing.realised, closing.flagged]), [
      [null, 100n, true]
    ])
  })

  it("a flagged lot flags the closings that sell it", () => {
    const result = replay([{ ...opened("a1", 10n, 100n, 1), flagged: true }, closed("t2", 10n, 120n, 2)])

    assert.deepStrictEqual(result.closings.map((closing) => closing.flagged), [true])
  })

  it("the same entries twice give the same ledger", () => {
    const entries = [opened("t1", 100n, 1_000n, 1), closed("t2", 40n, 480n, 2)]

    assert.deepStrictEqual(replay(entries), replay(entries))
  })
})

describe("unrealised", () => {
  it.each([
    { name: "no lots", lots: [], price: 1_000_000_000n, expected: 0n },
    { name: "a gain", lots: [[100_000_000n, 10_000_000n]], price: 1_200_000_000n, expected: 2_000_000n },
    { name: "a loss", lots: [[100_000_000n, 10_000_000n]], price: 800_000_000n, expected: -2_000_000n },
    {
      name: "two lots",
      lots: [[100_000_000n, 10_000_000n], [50_000_000n, 6_000_000n]],
      price: 1_200_000_000n,
      expected: 2_000_000n
    },
    { name: "a closed lot counts nothing", lots: [[0n, 0n]], price: 1_200_000_000n, expected: 0n },
    { name: "value rounds down", lots: [[1n, 0n]], price: 1_200_000_000n, expected: 0n }
  ])("$name", ({ expected, lots, price }) => {
    const held = lots.map(([remaining, remainingCost]) => ({
      remaining: Shares.make(remaining!),
      remainingCost: Usdc.make(remainingCost!)
    }))

    assert.strictEqual(unrealised(held, Price.make(price)), expected)
  })
})
