import { AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { assert, describe, it } from "@effect/vitest"
import {
  countdown,
  dayGone,
  nextReset,
  shownLimits,
  standingOf,
  todayRoom
} from "../../../../../src/features/agents/model/usage.ts"

const DOLLAR = BigInt(1_000_000)

const budget = (used: number, limit: number | null) =>
  new PolicyUsage({
    policy: "trade",
    unit: "usd",
    used: BigInt(used) * DOLLAR,
    limit: limit === null ? null : BigInt(limit) * DOLLAR
  })

const trades = (used: number, limit: number) =>
  new PolicyUsage({ policy: "tradesPerDay", unit: "count", used: BigInt(used), limit: BigInt(limit) })

const slippage = new PolicyUsage({ policy: "slippageBudget", unit: "usd", used: BigInt(3) * DOLLAR, limit: null })

const gas = new PolicyUsage({ policy: "gasBudget", unit: "usd", used: DOLLAR, limit: DOLLAR })

describe("shownLimits", () => {
  it("leaves out gas and a sell-only agent's budget of $0", () => {
    const usage = new AgentUsage({ policies: [budget(0, 0), trades(1, 5), gas, slippage] })

    assert.deepStrictEqual(shownLimits(usage).map((counted) => counted.policy), ["tradesPerDay", "slippageBudget"])
  })

  it("keeps a daily budget with a limit", () => {
    const usage = new AgentUsage({ policies: [budget(10, 500)] })

    assert.deepStrictEqual(shownLimits(usage).map((counted) => counted.policy), ["trade"])
  })
})

describe("standingOf", () => {
  it.each([
    { name: "nothing used", used: 0, limit: 500 as number | null, expected: "room" },
    { name: "just under 80%", used: 399, limit: 500, expected: "room" },
    { name: "80%", used: 400, limit: 500, expected: "nearly" },
    { name: "just under all", used: 499, limit: 500, expected: "nearly" },
    { name: "all of it", used: 500, limit: 500, expected: "used" },
    { name: "over it", used: 600, limit: 500, expected: "used" },
    { name: "no limit", used: 120, limit: null, expected: "open" },
    { name: "a limit of $0", used: 0, limit: 0, expected: "open" }
  ])("$name: $expected", ({ expected, limit, used }) => {
    assert.strictEqual(standingOf(budget(used, limit)), expected)
  })
})

describe("nextReset", () => {
  it("midday: the coming midnight UTC", () => {
    assert.deepStrictEqual(nextReset(new Date("2026-11-26T12:00:00Z")), new Date("2026-11-27T00:00:00Z"))
  })

  it("on midnight: the next one", () => {
    assert.deepStrictEqual(nextReset(new Date("2026-11-27T00:00:00Z")), new Date("2026-11-28T00:00:00Z"))
  })

  it("the last day of the month", () => {
    assert.deepStrictEqual(nextReset(new Date("2026-11-30T23:00:00Z")), new Date("2026-12-01T00:00:00Z"))
  })
})

describe("dayGone", () => {
  it.each([
    { at: "2026-11-26T00:00:00Z", expected: 0 },
    { at: "2026-11-26T12:00:00Z", expected: 0.5 },
    { at: "2026-11-26T18:00:00Z", expected: 0.75 }
  ])("$at: $expected", ({ at, expected }) => {
    assert.strictEqual(dayGone(new Date(at)), expected)
  })
})

describe("countdown", () => {
  it.each([
    { at: "2026-11-26T18:17:47Z", expected: "5:42:13" },
    { at: "2026-11-26T23:59:51Z", expected: "0:00:09" },
    { at: "2026-11-26T23:59:50.500Z", expected: "0:00:10" },
    { at: "2026-11-26T00:00:00Z", expected: "24:00:00" }
  ])("$at: $expected", ({ at, expected }) => {
    assert.strictEqual(countdown(new Date(at)), expected)
  })
})

describe("todayRoom", () => {
  const MIDDAY = new Date("2026-11-26T12:00:00Z")

  it("room under its budget and its trades", () => {
    const usage = new AgentUsage({ policies: [budget(180, 500), trades(2, 5), slippage] })

    assert.deepStrictEqual(todayRoom(usage, "Weekly buyer", new Date("2026-11-26T10:04:48Z")), {
      standing: "room",
      headline: "$320 left to spend today",
      detail: "Weekly buyer has spent $180 of its $500 budget and made 2 of its 5 trades, with 42% of the day gone."
    })
  })

  it("nearly used: the worst of its limits", () => {
    const usage = new AgentUsage({ policies: [budget(100, 500), trades(4, 5)] })

    assert.strictEqual(todayRoom(usage, "Weekly buyer", MIDDAY).standing, "nearly")
  })

  it("a budget alone", () => {
    const usage = new AgentUsage({ policies: [budget(420, 500)] })

    assert.deepStrictEqual(todayRoom(usage, "Weekly buyer", MIDDAY), {
      standing: "nearly",
      headline: "$80 left to spend today",
      detail: "Weekly buyer has spent $420 of its $500 budget, with 50% of the day gone."
    })
  })

  it("trades alone", () => {
    const usage = new AgentUsage({ policies: [budget(0, 0), trades(4, 5)] })

    assert.deepStrictEqual(todayRoom(usage, "Index keeper", MIDDAY), {
      standing: "nearly",
      headline: "1 trade left today",
      detail: "Index keeper has made 4 of its 5 trades, with 50% of the day gone."
    })
  })

  it("its budget used up", () => {
    const usage = new AgentUsage({ policies: [budget(500, 500), trades(2, 5)] })

    assert.deepStrictEqual(todayRoom(usage, "Weekly buyer", MIDDAY), {
      standing: "used",
      headline: "Done for today",
      detail: "Weekly buyer used all of today's $500 budget, so it waits for midnight UTC."
    })
  })

  it("its trades used up", () => {
    const usage = new AgentUsage({ policies: [budget(100, 500), trades(5, 5)] })

    assert.deepStrictEqual(todayRoom(usage, "Weekly buyer", MIDDAY), {
      standing: "used",
      headline: "Done for today",
      detail: "Weekly buyer made all 5 trades it may today, so it waits for midnight UTC."
    })
  })

  it("gas used up doesn't count: bluechip watches it", () => {
    const usage = new AgentUsage({ policies: [budget(0, 500), gas] })

    assert.strictEqual(todayRoom(usage, "Weekly buyer", MIDDAY).standing, "room")
  })

  it("no daily limits", () => {
    const usage = new AgentUsage({ policies: [budget(0, 0), slippage] })

    assert.deepStrictEqual(todayRoom(usage, "Stop-loss guard", MIDDAY), {
      standing: "open",
      headline: "No daily limits",
      detail: "Nothing caps what Stop-loss guard spends or how many trades it makes in a day."
    })
  })
})
