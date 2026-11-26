import { Agent } from "@bluechip/domain/agents/Agent"
import { assert, describe, it } from "@effect/vitest"
import {
  type AgentMoment,
  agentMoment,
  type AgentSnapshot,
  momentText,
  snapshotOf
} from "../../../../../src/features/agents/model/agentMoment.ts"
import { agent, PICKER } from "../../../../fixtures/Agents.ts"

const at = (status: AgentSnapshot["status"], paused = false, renewing = false): AgentSnapshot => ({
  status,
  paused,
  renewing
})

describe("snapshotOf", () => {
  it("an agent with nothing on its way", () => {
    assert.deepStrictEqual(snapshotOf(agent("active", { paused: true })), at("active", true, false))
  })

  it("a renewal on its way: the same policies again", () => {
    const renewing = new Agent({ ...agent("updating"), pendingSpec: PICKER })
    assert.deepStrictEqual(snapshotOf(renewing), at("updating", false, true))
  })
})

describe("agentMoment", () => {
  it.each<{ name: string; before: AgentSnapshot; after: AgentSnapshot; expected: AgentMoment | null }>([
    { name: "a lock landed", before: at("locking"), after: at("active"), expected: "live" },
    { name: "a change landed", before: at("updating"), after: at("active"), expected: "changed" },
    { name: "a renewal landed", before: at("updating", false, true), after: at("active"), expected: "renewed" },
    { name: "resumed: instant, said in place", before: at("active", true), after: at("active", false), expected: null },
    { name: "paused: said in place", before: at("active"), after: at("active", true), expected: null },
    { name: "nothing changed", before: at("active"), after: at("active"), expected: null },
    { name: "a change that failed back to expired", before: at("updating"), after: at("expired"), expected: null },
    { name: "still on its way", before: at("active"), after: at("updating"), expected: null },
    { name: "removed", before: at("removing"), after: at("removed"), expected: null }
  ])("$name", ({ after, before, expected }) => {
    assert.strictEqual(agentMoment(before, after), expected)
  })
})

describe("momentText", () => {
  const nimbus = agent("active")

  it.each<{ moment: AgentMoment; title: string; description: string }>([
    { moment: "live", title: "Nvidia picker is live", description: "It trades inside its rules from now on." },
    { moment: "changed", title: "Nvidia picker's new rules are locked", description: "They apply to its next trade." },
    { moment: "renewed", title: "Nvidia picker is renewed", description: "Same rules, locked until 1 Dec." },
    {
      moment: "removed",
      title: "Nvidia picker was removed",
      description: "It can never trade again. Your stocks and cash stay yours."
    }
  ])("$moment", ({ description, moment, title }) => {
    assert.deepStrictEqual(momentText(moment, nimbus), { title, description })
  })

  it("a renewal with no end date", () => {
    assert.deepStrictEqual(momentText("renewed", { name: "Nimbus", lockedUntil: null }), {
      title: "Nimbus is renewed",
      description: "Same rules, new key."
    })
  })
})
