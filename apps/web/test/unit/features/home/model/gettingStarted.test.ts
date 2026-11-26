import { AgentId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import {
  nextStep,
  type SetupFacts,
  setupSteps,
  stageOf
} from "../../../../../src/features/home/model/gettingStarted.ts"

const NOW = new Date("2026-11-27T12:00:00Z")
const DRAFT = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3a")
const PICKER = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3b")

const nothing: SetupFacts = {
  hasMoney: false,
  agents: [],
  agentTraded: false,
  hasAutomation: false,
  hasRecoveryKey: false,
  signedUpAt: new Date("2026-11-27T10:00:00Z")
}

const done = (facts: SetupFacts) => setupSteps(facts).map((step) => [step.id, step.done])

describe("setupSteps", () => {
  it("nothing done: every step left, in order", () => {
    assert.deepStrictEqual(done(nothing), [
      ["cash", false],
      ["agent", false],
      ["trade", false],
      ["automation", false],
      ["recovery", false]
    ])
  })

  it("everything done", () => {
    const facts: SetupFacts = {
      ...nothing,
      hasMoney: true,
      agents: [{ id: PICKER, name: "Tech picker", status: "active" }],
      agentTraded: true,
      hasAutomation: true,
      hasRecoveryKey: true
    }

    assert.deepStrictEqual(done(facts), [
      ["cash", true],
      ["agent", true],
      ["trade", true],
      ["automation", true],
      ["recovery", true]
    ])
  })

  it("a draft alone isn't a first agent: the step offers to finish it", () => {
    const agent = setupSteps({ ...nothing, agents: [{ id: DRAFT, name: "Amazon idea", status: "draft" }] })[1]

    assert.deepStrictEqual(agent, {
      id: "agent",
      title: "Create your first agent",
      detail: "Amazon idea is a draft. Lock its rules with Face ID to start it.",
      done: false,
      agentId: DRAFT
    })
  })

  it("an agent on its way to Base counts, and its first trade waits for it", () => {
    const steps = setupSteps({ ...nothing, agents: [{ id: PICKER, name: "Tech picker", status: "locking" }] })

    assert.deepStrictEqual([steps[1]?.done, steps[2]?.agentId], [true, PICKER])
  })

  it("a removed agent still counts as made, but has no trade to wait for", () => {
    const steps = setupSteps({ ...nothing, agents: [{ id: PICKER, name: "Tech picker", status: "removed" }] })

    assert.deepStrictEqual([steps[1]?.done, steps[2]?.agentId], [true, undefined])
  })
})

describe("nextStep", () => {
  it("the first step left", () => {
    assert.strictEqual(nextStep(setupSteps({ ...nothing, hasMoney: true, hasRecoveryKey: true }))?.id, "agent")
  })

  it("none once all are done", () => {
    assert.strictEqual(nextStep([]), undefined)
  })
})

describe("stageOf", () => {
  const settledIn: SetupFacts = {
    ...nothing,
    hasMoney: true,
    agents: [{ id: PICKER, name: "Tech picker", status: "active" }],
    agentTraded: true,
    hasAutomation: true,
    signedUpAt: new Date("2026-09-01T10:00:00Z")
  }

  it.each<{ name: string; facts: SetupFacts; expected: ReturnType<typeof stageOf> }>([
    { name: "no money and no agents: welcome", facts: nothing, expected: "welcome" },
    {
      name: "only removed agents and no money: welcome",
      facts: { ...nothing, agents: [{ id: PICKER, name: "Tech picker", status: "removed" }] },
      expected: "welcome"
    },
    { name: "money in, no agent: getting started", facts: { ...nothing, hasMoney: true }, expected: "starting" },
    {
      name: "a draft and no money: getting started",
      facts: { ...nothing, agents: [{ id: DRAFT, name: "Amazon idea", status: "draft" }] },
      expected: "starting"
    },
    {
      name: "a recovery key left, signed up 29 days ago: getting started",
      facts: { ...settledIn, signedUpAt: new Date("2026-10-29T13:00:00Z") },
      expected: "starting"
    },
    {
      name: "a recovery key left, signed up 30 days ago: settled",
      facts: { ...settledIn, signedUpAt: new Date("2026-10-28T12:00:00Z") },
      expected: "settled"
    },
    {
      name: "an old account whose agent never traded: still getting started",
      facts: { ...settledIn, agentTraded: false },
      expected: "starting"
    },
    {
      name: "every step done, signed up today: settled",
      facts: { ...settledIn, hasRecoveryKey: true, signedUpAt: NOW },
      expected: "settled"
    }
  ])("$name", ({ expected, facts }) => {
    assert.strictEqual(stageOf(facts, NOW), expected)
  })
})
