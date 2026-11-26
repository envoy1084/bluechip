import { AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { assert, describe, it } from "@effect/vitest"
import {
  type AgentFilter,
  featuredAgents,
  filterCounts,
  listedAgent,
  matches,
  shows,
  sortAgents
} from "../../../../../src/features/agents/model/agentList.ts"
import { agent } from "../../../../fixtures/Agents.ts"

const NOW = new Date("2026-11-26T12:00:00Z")

const NAMES: Readonly<Record<string, string>> = { NVDA: "Nvidia", AAPL: "Apple" }
const nameOf = (symbol: StockSymbol) => NAMES[symbol] ?? symbol

const spent = (used: bigint) =>
  new AgentUsage({ policies: [new PolicyUsage({ policy: "trade", unit: "usd", used, limit: BigInt(250_000_000) })] })

const USED_UP = spent(BigInt(250_000_000))

describe("listedAgent", () => {
  it("a running agent with a trade waiting needs your approval", () => {
    assert.strictEqual(listedAgent(agent("active"), NOW, { awaiting: 1 }).state, "needs-approval")
  })

  it("an agent done for today with a trade waiting needs your approval", () => {
    assert.strictEqual(listedAgent(agent("active"), NOW, { usage: USED_UP, awaiting: 2 }).state, "needs-approval")
  })

  it("a paused agent with a trade waiting stays paused", () => {
    assert.strictEqual(listedAgent(agent("active", { paused: true }), NOW, { awaiting: 1 }).state, "paused")
  })

  it("a running agent with nothing waiting is active", () => {
    assert.deepStrictEqual(listedAgent(agent("active"), NOW), {
      agent: agent("active"),
      state: "active",
      usage: undefined,
      lastTradeAt: undefined,
      awaiting: 0
    })
  })
})

describe("shows", () => {
  it.each<{ name: string; listed: ReturnType<typeof listedAgent>; expected: ReadonlyArray<AgentFilter> }>([
    { name: "an active agent", listed: listedAgent(agent("active"), NOW), expected: ["all", "active"] },
    {
      name: "one done for today",
      listed: listedAgent(agent("active"), NOW, { usage: USED_UP }),
      expected: ["all", "active"]
    },
    {
      name: "one waiting for your approval",
      listed: listedAgent(agent("active"), NOW, { awaiting: 1 }),
      expected: ["all", "active", "attention"]
    },
    { name: "a change on its way", listed: listedAgent(agent("updating"), NOW), expected: ["all", "active"] },
    { name: "a removal on its way", listed: listedAgent(agent("removing"), NOW), expected: ["all", "active"] },
    {
      name: "a paused agent",
      listed: listedAgent(agent("active", { paused: true }), NOW),
      expected: ["all", "paused"]
    },
    { name: "a draft", listed: listedAgent(agent("draft"), NOW), expected: ["all", "drafts"] },
    { name: "a first lock on its way", listed: listedAgent(agent("locking"), NOW), expected: ["all", "drafts"] },
    {
      name: "one that ran out",
      listed: listedAgent(agent("expired"), NOW),
      expected: ["all", "attention", "expired"]
    },
    {
      name: "one past its lock not yet marked expired",
      listed: listedAgent(agent("active", { lockedUntil: "2026-11-25T00:00:00Z" }), NOW),
      expected: ["all", "attention", "expired"]
    }
  ])("$name", ({ expected, listed }) => {
    const filters: ReadonlyArray<AgentFilter> = ["all", "active", "attention", "paused", "drafts", "expired"]

    assert.deepStrictEqual(filters.filter((filter) => shows(listed, filter)), expected)
  })
})

describe("filterCounts", () => {
  it("counts each filter's agents", () => {
    const listed = [
      listedAgent(agent("active"), NOW),
      listedAgent(agent("active"), NOW, { awaiting: 1 }),
      listedAgent(agent("draft"), NOW),
      listedAgent(agent("expired"), NOW)
    ]

    assert.deepStrictEqual(filterCounts(listed), {
      all: 4,
      active: 2,
      attention: 2,
      paused: 0,
      drafts: 1,
      expired: 1
    })
  })

  it("no agents: every count is 0", () => {
    assert.deepStrictEqual(filterCounts([]), { all: 0, active: 0, attention: 0, paused: 0, drafts: 0, expired: 0 })
  })
})

describe("matches", () => {
  it.each<{ name: string; query: string; expected: boolean }>([
    { name: "no query", query: "", expected: true },
    { name: "only spaces", query: "   ", expected: true },
    { name: "part of its name, in another case", query: "PICK", expected: true },
    { name: "a stock's symbol", query: "aapl", expected: true },
    { name: "a stock's name", query: "apple", expected: true },
    { name: "with spaces around it", query: "  nvidia ", expected: true },
    { name: "a stock it doesn't trade", query: "tesla", expected: false }
  ])("$name: $expected", ({ expected, query }) => {
    assert.strictEqual(matches(agent("active"), query, nameOf), expected)
  })
})

describe("sortAgents", () => {
  const alpha = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3a")
  const beta = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3b")
  const gamma = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3c")
  const listed = [
    listedAgent(agent("active", { id: beta, name: "Beta", createdAt: "2026-11-10T10:00:00Z" }), NOW, {
      usage: spent(BigInt(40_000_000)),
      lastTradeAt: new Date("2026-11-25T09:00:00Z")
    }),
    listedAgent(agent("draft", { id: gamma, name: "Gamma", createdAt: "2026-11-26T08:00:00Z" }), NOW, {
      lastTradeAt: null
    }),
    listedAgent(agent("active", { id: alpha, name: "Alpha", createdAt: "2026-11-01T10:00:00Z" }), NOW, {
      usage: spent(BigInt(90_000_000)),
      lastTradeAt: new Date("2026-11-26T11:00:00Z")
    })
  ]

  it("recent activity: the latest trade first, one that never traded by when it was made", () => {
    assert.deepStrictEqual(sortAgents(listed, "recent").map((each) => each.agent.name), ["Alpha", "Gamma", "Beta"])
  })

  it("name: A to Z", () => {
    assert.deepStrictEqual(sortAgents(listed, "name").map((each) => each.agent.name), ["Alpha", "Beta", "Gamma"])
  })

  it("spent today: the most first, none last", () => {
    assert.deepStrictEqual(sortAgents(listed, "spent").map((each) => each.agent.name), ["Alpha", "Beta", "Gamma"])
  })

  it("spent today: a tie goes by name", () => {
    const tied = [
      listedAgent(agent("active", { id: beta, name: "Beta" }), NOW, { usage: spent(BigInt(0)) }),
      listedAgent(agent("draft", { id: alpha, name: "Alpha" }), NOW)
    ]

    assert.deepStrictEqual(sortAgents(tied, "spent").map((each) => each.agent.name), ["Alpha", "Beta"])
  })
})

describe("featuredAgents", () => {
  const ids = ["a", "b", "c", "d", "e", "f"].map((letter) => AgentId.make(`agent_01jd8v4t5m6n7a8q9r0s1t2v3${letter}`))
  const trading = (id: number, name: string, lastTradeAt: string) =>
    listedAgent(agent("active", { id: ids[id]!, name }), NOW, { lastTradeAt: new Date(lastTradeAt) })

  it("waiting for you first, then trading by latest trade, then paused, drafts and those that ran out", () => {
    const listed = [
      listedAgent(agent("expired", { id: ids[0]!, name: "Ran out" }), NOW),
      listedAgent(agent("draft", { id: ids[1]!, name: "Draft" }), NOW),
      trading(2, "Older trade", "2026-11-24T10:00:00Z"),
      listedAgent(agent("active", { id: ids[3]!, name: "Paused", paused: true }), NOW),
      trading(4, "Newer trade", "2026-11-26T10:00:00Z"),
      listedAgent(agent("active", { id: ids[5]!, name: "Asking" }), NOW, { awaiting: 1 })
    ]

    assert.deepStrictEqual(
      featuredAgents(listed, 10).map((each) => each.agent.name),
      ["Asking", "Newer trade", "Older trade", "Paused", "Draft", "Ran out"]
    )
  })

  it("no more than the count", () => {
    const listed = [trading(0, "One", "2026-11-26T10:00:00Z"), trading(1, "Two", "2026-11-25T10:00:00Z")]

    assert.deepStrictEqual(featuredAgents(listed, 1).map((each) => each.agent.name), ["One"])
  })

  it("never a removed agent", () => {
    const listed = [listedAgent(agent("removed", { id: ids[0]! }), NOW)]

    assert.deepStrictEqual(featuredAgents(listed, 4), [])
  })
})
