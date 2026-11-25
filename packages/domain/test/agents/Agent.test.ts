import { type AgentEvent, AgentName, type AgentStatus, transition } from "@bluechip/domain/agents/Agent"
import { assert, describe, it } from "@effect/vitest"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"

const sent = (action: "lock" | "update" | "remove"): AgentEvent => ({ _tag: "Sent", action })

describe("transition", () => {
  it.each<{ name: string; status: AgentStatus; event: AgentEvent; expected: Result.Result<AgentStatus, string> }>([
    { name: "draft, lock sent: locking", status: "draft", event: sent("lock"), expected: Result.succeed("locking") },
    {
      name: "draft, change sent: nothing locked to change",
      status: "draft",
      event: sent("update"),
      expected: Result.fail("a draft agent can't update")
    },
    {
      name: "draft, discarded: removed",
      status: "draft",
      event: { _tag: "Discarded" },
      expected: Result.succeed("removed")
    },
    {
      name: "locking, landed: active",
      status: "locking",
      event: { _tag: "Landed" },
      expected: Result.succeed("active")
    },
    {
      name: "locking, failed: back to draft",
      status: "locking",
      event: { _tag: "Failed" },
      expected: Result.succeed("draft")
    },
    {
      name: "locking, another lock sent",
      status: "locking",
      event: sent("lock"),
      expected: Result.fail("a locking agent can't lock")
    },
    {
      name: "active, change sent: updating",
      status: "active",
      event: sent("update"),
      expected: Result.succeed("updating")
    },
    {
      name: "active, removal sent: removing",
      status: "active",
      event: sent("remove"),
      expected: Result.succeed("removing")
    },
    {
      name: "active, locked again",
      status: "active",
      event: sent("lock"),
      expected: Result.fail("a active agent can't lock")
    },
    {
      name: "active, discarded: only drafts are",
      status: "active",
      event: { _tag: "Discarded" },
      expected: Result.fail("a active agent can't be discarded")
    },
    {
      name: "active, landed: nothing on its way",
      status: "active",
      event: { _tag: "Landed" },
      expected: Result.fail("a active agent has nothing landing")
    },
    {
      name: "updating, landed: active",
      status: "updating",
      event: { _tag: "Landed" },
      expected: Result.succeed("active")
    },
    {
      name: "updating, failed: active with its old limits",
      status: "updating",
      event: { _tag: "Failed" },
      expected: Result.succeed("active")
    },
    {
      name: "updating, removal sent: one operation at a time",
      status: "updating",
      event: sent("remove"),
      expected: Result.fail("a updating agent can't remove")
    },
    {
      name: "removing, landed: removed",
      status: "removing",
      event: { _tag: "Landed" },
      expected: Result.succeed("removed")
    },
    {
      name: "removing, failed: still active",
      status: "removing",
      event: { _tag: "Failed" },
      expected: Result.succeed("active")
    },
    {
      name: "removed, change sent",
      status: "removed",
      event: sent("update"),
      expected: Result.fail("a removed agent can't update")
    },
    {
      name: "removed, failed",
      status: "removed",
      event: { _tag: "Failed" },
      expected: Result.fail("a removed agent has nothing to fail")
    }
  ])("$name", ({ event, expected, status }) => {
    assert.deepStrictEqual(transition(status, event), expected)
  })
})

describe("AgentName", () => {
  it.each<{ name: string; input: string; valid: boolean }>([
    { name: "a name", input: "Tech picker", valid: true },
    { name: "one character", input: "A", valid: true },
    { name: "40 characters", input: "a".repeat(40), valid: true },
    { name: "41 characters", input: "a".repeat(41), valid: false },
    { name: "empty", input: "", valid: false },
    { name: "a leading space", input: " Tech picker", valid: false }
  ])("$name", ({ input, valid }) => {
    assert.strictEqual(Schema.is(AgentName)(input), valid)
  })
})
