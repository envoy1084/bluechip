import { AgentId, AutomationId, RecoveryKeyId, RecoveryRequestId } from "@bluechip/domain/Ids"
import { RecoveryKey, RecoveryRequest, type RecoveryStatus } from "@bluechip/domain/recovery/Recovery"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { type NeedsFacts, needsYou } from "../../../../../src/features/home/model/needsYou.ts"
import { agent } from "../../../../fixtures/Agents.ts"

const NOW = new Date("2026-11-27T12:00:00Z")
const PICKER = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3a")
const KEEPER = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3b")
const WEEKLY = AutomationId.make("automation_01jd8v4t5m6n7a8q9r0s1t2v3a")
const SPLIT = AutomationId.make("automation_01jd8v4t5m6n7a8q9r0s1t2v3b")

const KEY = new RecoveryKey({
  id: RecoveryKeyId.make("recoverykey_01jd8v4t5m6n7a8q9r0s1t2v3a"),
  label: "YubiKey",
  status: "active",
  createdAt: DateTime.makeUnsafe("2026-10-01T10:00:00Z")
})

const recovering = (status: RecoveryStatus, executableAt: string | null) =>
  new RecoveryRequest({
    id: RecoveryRequestId.make("recovery_01jd8v4t5m6n7a8q9r0s1t2v3a"),
    status,
    newPasskey: null,
    requestedAt: DateTime.makeUnsafe("2026-11-27T10:00:00Z"),
    executableAt: executableAt === null ? null : DateTime.makeUnsafe(executableAt),
    cancelledAt: null,
    cancelledFrom: null,
    executedAt: null
  })

// Nothing needs you: a trading agent with weeks left, a recovery key, no cash sitting still.
const calm: NeedsFacts = {
  approvals: [],
  agents: [agent("active", { id: PICKER, name: "Tech picker", lockedUntil: "2027-01-20T00:00:00Z" })],
  automations: [],
  recovery: { key: KEY, request: null },
  cash: 0n,
  settled: true
}

const titles = (facts: NeedsFacts) => needsYou(facts, NOW, "UTC").map((need) => need.title)

describe("needsYou", () => {
  it("nothing needs you", () => {
    assert.deepStrictEqual(needsYou(calm, NOW, "UTC"), [])
  })

  it("a recovery waiting out its delay", () => {
    assert.deepStrictEqual(
      needsYou({ ...calm, recovery: { key: KEY, request: recovering("waiting", "2026-11-29T10:00:00Z") } }, NOW, "UTC"),
      [{
        key: "recovery",
        tone: "urgent",
        title: "Your account is being recovered",
        detail: "If it isn't you, cancel it. It can take over on Sun 29 Nov at 10:00.",
        action: { _tag: "security" },
        actionLabel: "Review"
      }]
    )
  })

  it("a recovery on its way to Base", () => {
    const [need] = needsYou({ ...calm, recovery: { key: KEY, request: recovering("requesting", null) } }, NOW, "UTC")

    assert.strictEqual(need?.detail, "Its request is on its way to Base. If it isn't you, cancel it.")
  })

  it("a cancelled recovery needs nothing", () => {
    assert.deepStrictEqual(titles({ ...calm, recovery: { key: KEY, request: recovering("cancelled", null) } }), [])
  })

  it("one trade waiting, ending in 5 hours", () => {
    assert.deepStrictEqual(
      needsYou(
        {
          ...calm,
          approvals: [{ agentId: PICKER, expiresAt: DateTime.makeUnsafe("2026-11-27T17:00:00Z") }]
        },
        NOW,
        "UTC"
      ),
      [{
        key: "approvals",
        tone: "warn",
        title: "A trade waits for your Face ID",
        detail: "From Tech picker. It ends in 5 h.",
        action: { _tag: "approvals" },
        actionLabel: "Review"
      }]
    )
  })

  it("two trades from two agents, the first ending within the hour: urgent", () => {
    const [need] = needsYou(
      {
        ...calm,
        agents: [...calm.agents, agent("active", { id: KEEPER, name: "Index keeper" })],
        approvals: [
          { agentId: KEEPER, expiresAt: DateTime.makeUnsafe("2026-11-27T18:00:00Z") },
          { agentId: PICKER, expiresAt: DateTime.makeUnsafe("2026-11-27T12:40:00Z") }
        ]
      },
      NOW,
      "UTC"
    )

    assert.deepStrictEqual(
      [need?.tone, need?.title, need?.detail],
      ["urgent", "2 trades wait for your Face ID", "From Index keeper and Tech picker. The first ends in 40 min."]
    )
  })

  it("one automation needs a look: its reason, and the way to it", () => {
    assert.deepStrictEqual(
      needsYou(
        {
          ...calm,
          automations: [
            { automation: { id: WEEKLY, name: "Weekly Apple" }, attention: null },
            { automation: { id: SPLIT, name: "Monthly split" }, attention: "Its last run didn't go through." }
          ]
        },
        NOW,
        "UTC"
      ),
      [{
        key: "automations",
        tone: "warn",
        title: "Monthly split needs attention",
        detail: "Its last run didn't go through.",
        action: { _tag: "automation", automationId: SPLIT },
        actionLabel: "Look"
      }]
    )
  })

  it("two automations need a look: named together, leading to the list", () => {
    const [need] = needsYou(
      {
        ...calm,
        automations: [
          { automation: { id: WEEKLY, name: "Weekly Apple" }, attention: "Its agent is paused." },
          { automation: { id: SPLIT, name: "Monthly split" }, attention: "Its last run didn't go through." }
        ]
      },
      NOW,
      "UTC"
    )

    assert.deepStrictEqual([need?.title, need?.detail, need?.action], [
      "2 automations need attention",
      "Weekly Apple and Monthly split.",
      { _tag: "automations" }
    ])
  })

  it("an agent that ran out, and one whose session passed while still active", () => {
    assert.deepStrictEqual(
      titles({
        ...calm,
        agents: [
          ...calm.agents,
          agent("expired", { id: KEEPER, name: "Index keeper" }),
          agent("active", { name: "Old buyer", lockedUntil: "2026-11-27T11:00:00Z" })
        ]
      }),
      ["2 agents ran out"]
    )
  })

  it("an agent whose rules end within 3 days", () => {
    assert.deepStrictEqual(
      needsYou(
        {
          ...calm,
          agents: [agent("active", { id: PICKER, name: "Tech picker", lockedUntil: "2026-11-29T12:00:00Z" })]
        },
        NOW,
        "UTC"
      ),
      [{
        key: "endingSoon",
        tone: "info",
        title: "Tech picker's rules end in 2 days",
        detail: "Renew them with Face ID for another 90 days of trading.",
        action: { _tag: "agent", agentId: PICKER },
        actionLabel: "Renew"
      }]
    )
  })

  it("rules ending in 4 days aren't urgent yet", () => {
    assert.deepStrictEqual(
      titles({ ...calm, agents: [agent("active", { id: PICKER, lockedUntil: "2026-12-01T12:00:00Z" })] }),
      []
    )
  })

  it("a draft once settled in", () => {
    assert.deepStrictEqual(
      titles({ ...calm, agents: [...calm.agents, agent("draft", { id: KEEPER, name: "Amazon idea" })] }),
      ["Amazon idea isn't trading yet"]
    )
  })

  it("while getting started, a draft, idle cash and a missing key are the checklist's", () => {
    assert.deepStrictEqual(
      titles({
        ...calm,
        settled: false,
        cash: 500_000_000n,
        recovery: { key: null, request: null },
        agents: [agent("draft", { id: KEEPER, name: "Amazon idea" })]
      }),
      []
    )
  })

  it("cash with every agent paused", () => {
    assert.deepStrictEqual(
      needsYou(
        {
          ...calm,
          cash: 2_480_000_000n,
          agents: [agent("active", { id: PICKER, paused: true, lockedUntil: "2027-01-20T00:00:00Z" })]
        },
        NOW,
        "UTC"
      ),
      [{
        key: "idleCash",
        tone: "info",
        title: "$2,480.00 is sitting in cash",
        detail: "None of your agents can trade right now. Resume one, or start a new one.",
        action: { _tag: "agents" },
        actionLabel: "Agents"
      }]
    )
  })

  it("cash with no agents at all leads to a new one", () => {
    const [need] = needsYou({ ...calm, cash: 50_000_000n, agents: [] }, NOW, "UTC")

    assert.deepStrictEqual([need?.detail, need?.action], [
      "No agent trades for you yet. Start one to put it to work inside limits you set.",
      { _tag: "newAgent" }
    ])
  })

  it("under $10 of cash isn't worth a line", () => {
    assert.deepStrictEqual(titles({ ...calm, cash: 9_990_000n, agents: [] }), [])
  })

  it("no recovery key once settled in", () => {
    assert.deepStrictEqual(titles({ ...calm, recovery: { key: null, request: null } }), ["Add a recovery key"])
  })

  it("while the recovery loads, no line about the key", () => {
    assert.deepStrictEqual(titles({ ...calm, recovery: null }), [])
  })

  it("the most pressing first: a recovery, then trades waiting, then reminders", () => {
    assert.deepStrictEqual(
      titles({
        ...calm,
        recovery: { key: null, request: recovering("waiting", "2026-11-29T10:00:00Z") },
        approvals: [{ agentId: PICKER, expiresAt: null }],
        agents: [...calm.agents, agent("draft", { id: KEEPER, name: "Amazon idea" })]
      }),
      [
        "Your account is being recovered",
        "A trade waits for your Face ID",
        "Amazon idea isn't trading yet",
        "Add a recovery key"
      ]
    )
  })
})
