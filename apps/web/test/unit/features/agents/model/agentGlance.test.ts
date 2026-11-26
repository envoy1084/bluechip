import { Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { type Glance, glanceOf, tradesWord } from "../../../../../src/features/agents/model/agentGlance.ts"
import { listedAgent } from "../../../../../src/features/agents/model/agentList.ts"
import { agent, PICKER } from "../../../../fixtures/Agents.ts"

const NOW = new Date("2026-11-26T12:00:00Z")

describe("tradesWord", () => {
  it("a stock picker buys and sells", () => {
    assert.strictEqual(tradesWord(agent("active")), "Buys and sells")
  })

  it("a weekly buyer only buys", () => {
    assert.strictEqual(
      tradesWord({ spec: draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] }) }),
      "Only buys"
    )
  })
})

describe("glanceOf", () => {
  it.each<{ name: string; listed: ReturnType<typeof listedAgent>; expected: Glance }>([
    {
      name: "a draft",
      listed: listedAgent(agent("draft"), NOW),
      expected: { _tag: "line", text: "Lock its rules with Face ID to start it", tone: "quiet" }
    },
    {
      name: "a first lock on its way",
      listed: listedAgent(agent("locking"), NOW),
      expected: { _tag: "line", text: "Its rules are on their way to Base", tone: "quiet" }
    },
    {
      name: "a change on its way",
      listed: listedAgent(agent("updating"), NOW),
      expected: { _tag: "line", text: "Its new rules are on their way to Base", tone: "quiet" }
    },
    {
      name: "a renewal on its way: the same rules again",
      listed: listedAgent(new Agent({ ...agent("updating"), pendingSpec: PICKER }), NOW),
      expected: { _tag: "line", text: "Its renewal is on its way to Base", tone: "quiet" }
    },
    {
      name: "a removal on its way",
      listed: listedAgent(agent("removing"), NOW),
      expected: { _tag: "line", text: "Its removal is on its way to Base", tone: "quiet" }
    },
    {
      name: "one that ran out",
      listed: listedAgent(agent("expired", { lockedUntil: "2026-10-27T00:00:00Z" }), NOW),
      expected: { _tag: "line", text: "Ran out on 27 Oct", tone: "quiet" }
    },
    {
      name: "a paused agent",
      listed: listedAgent(agent("active", { paused: true }), NOW),
      expected: { _tag: "line", text: "Won't trade until you resume it", tone: "quiet" }
    },
    {
      name: "one trade waiting for you",
      listed: listedAgent(agent("active"), NOW, { awaiting: 1 }),
      expected: { _tag: "line", text: "1 trade waits for your approval", tone: "attention" }
    },
    {
      name: "two trades waiting for you",
      listed: listedAgent(agent("active"), NOW, { awaiting: 2 }),
      expected: { _tag: "line", text: "2 trades wait for your approval", tone: "attention" }
    },
    {
      name: "done for today",
      listed: listedAgent(agent("active"), NOW, {
        usage: new AgentUsage({
          policies: [
            new PolicyUsage({ policy: "trade", unit: "usd", used: BigInt(250_000_000), limit: BigInt(250_000_000) })
          ]
        })
      }),
      expected: { _tag: "line", text: "Starts again at 00:00 your time, midnight UTC", tone: "quiet" }
    },
    {
      name: "an active agent with a daily budget",
      listed: listedAgent(agent("active"), NOW, {
        usage: new AgentUsage({
          policies: [
            new PolicyUsage({ policy: "trade", unit: "usd", used: BigInt(40_000_000), limit: BigInt(250_000_000) })
          ]
        })
      }),
      expected: {
        _tag: "budget",
        used: BigInt(40_000_000),
        limit: BigInt(250_000_000),
        text: "$40 of $250 today"
      }
    },
    {
      name: "a sell-only agent with trades per day",
      listed: listedAgent(agent("active"), NOW, {
        usage: new AgentUsage({
          policies: [
            new PolicyUsage({ policy: "trade", unit: "usd", used: BigInt(0), limit: BigInt(0) }),
            new PolicyUsage({ policy: "tradesPerDay", unit: "count", used: BigInt(1), limit: BigInt(3) })
          ]
        })
      }),
      expected: { _tag: "line", text: "1 of 3 trades today", tone: "quiet" }
    },
    {
      name: "an active agent while its usage loads",
      listed: listedAgent(agent("active"), NOW),
      expected: { _tag: "line", text: "Trading within its limits", tone: "quiet" }
    }
  ])("$name", ({ expected, listed }) => {
    assert.deepStrictEqual(glanceOf(listed), expected)
  })
})
