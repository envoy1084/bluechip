import { type Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { assert, describe, it } from "@effect/vitest"
import { agentDot, agentState, hasSession, limitLine } from "../../../../../src/features/agents/model/agentState.ts"
import { agent } from "../../../../fixtures/Agents.ts"

const NOW = new Date("2026-11-26T12:00:00Z")

const usage = (used: bigint, limit: bigint | null) =>
  new AgentUsage({ policies: [new PolicyUsage({ policy: "trade", unit: "usd", used, limit })] })

describe("hasSession", () => {
  it.each<{ status: Agent["status"]; expected: boolean }>([
    { status: "draft", expected: false },
    { status: "locking", expected: false },
    { status: "active", expected: true },
    { status: "updating", expected: true },
    { status: "removing", expected: true },
    { status: "expired", expected: false },
    { status: "removed", expected: false }
  ])("$status: $expected", ({ expected, status }) => {
    assert.strictEqual(hasSession(agent(status)), expected)
  })
})

describe("agentState", () => {
  it("a removed agent", () => {
    assert.strictEqual(agentState(agent("removed"), NOW), "removed")
  })

  it("a draft not locked yet", () => {
    assert.strictEqual(agentState(agent("draft"), NOW), "unlocked")
  })

  it.each<{ status: "locking" | "updating" | "removing" }>([
    { status: "locking" },
    { status: "updating" },
    { status: "removing" }
  ])("$status: on its way to Base", ({ status }) => {
    assert.strictEqual(agentState(agent(status), NOW), "sending")
  })

  it("marked expired by bluechip", () => {
    assert.strictEqual(agentState(agent("expired", { lockedUntil: "2026-11-25T00:00:00Z" }), NOW), "expired")
  })

  it("marked expired and paused: expired, since renewing comes first", () => {
    assert.strictEqual(agentState(agent("expired", { paused: true }), NOW), "expired")
  })

  it("paused, even past its end", () => {
    assert.strictEqual(
      agentState(agent("active", { paused: true, lockedUntil: "2026-11-01T00:00:00Z" }), NOW),
      "paused"
    )
  })

  it("its session ends now: expired", () => {
    assert.strictEqual(agentState(agent("active", { lockedUntil: "2026-11-26T12:00:00Z" }), NOW), "expired")
  })

  it("its session ends a moment from now: active", () => {
    assert.strictEqual(agentState(agent("active", { lockedUntil: "2026-11-26T12:00:00.001Z" }), NOW), "active")
  })

  it("no end: active", () => {
    assert.strictEqual(agentState(agent("active", { lockedUntil: null }), NOW), "active")
  })

  it("today's budget used up: stopped", () => {
    assert.strictEqual(agentState(agent("active"), NOW, usage(250_000_000n, 250_000_000n)), "stopped")
  })

  it("just under today's budget: active", () => {
    assert.strictEqual(agentState(agent("active"), NOW, usage(249_999_999n, 250_000_000n)), "active")
  })

  it("a sell-only agent's budget of 0 never stops it", () => {
    assert.strictEqual(agentState(agent("active"), NOW, usage(0n, 0n)), "active")
  })

  it("a counted policy without a limit never stops it", () => {
    assert.strictEqual(agentState(agent("active"), NOW, usage(500_000_000n, null)), "active")
  })
})

describe("agentDot", () => {
  it.each<{ state: Parameters<typeof agentDot>[0]; expected: string }>([
    { state: "unlocked", expected: "idle" },
    { state: "sending", expected: "waiting" },
    { state: "active", expected: "active" },
    { state: "paused", expected: "paused" },
    { state: "stopped", expected: "idle" },
    { state: "expired", expected: "idle" }
  ])("$state: $expected", ({ expected, state }) => {
    assert.strictEqual(agentDot(state), expected)
  })
})

// The project runs in UTC (vitest.config.ts), so the viewer's midnight is midnight UTC here.
describe("limitLine", () => {
  it.each<{ name: string; policy: PolicyUsage; expected: string | null }>([
    {
      name: "today's budget used up",
      policy: new PolicyUsage({ policy: "trade", unit: "usd", used: 100_000_000n, limit: 100_000_000n }),
      expected: "Used today's $100 budget. Starts again at 00:00 your time, midnight UTC."
    },
    {
      name: "every trade of the day made",
      policy: new PolicyUsage({ policy: "tradesPerDay", unit: "count", used: 12n, limit: 12n }),
      expected: "Made all 12 of today's trades. Starts again at 00:00 your time, midnight UTC."
    },
    {
      name: "today's gas used up",
      policy: new PolicyUsage({ policy: "gasBudget", unit: "wei", used: 5n, limit: 5n }),
      expected: "Used today's gas budget. Starts again at 00:00 your time, midnight UTC."
    },
    {
      name: "just under every limit",
      policy: new PolicyUsage({ policy: "trade", unit: "usd", used: 99_999_999n, limit: 100_000_000n }),
      expected: null
    }
  ])("$name", ({ expected, policy }) => {
    assert.strictEqual(limitLine(new AgentUsage({ policies: [policy] }), NOW), expected)
  })
})
