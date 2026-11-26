import { AgentId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

describe("typeId", () => {
  it.each([
    { name: "an id bluechip makes (UUIDv7)", id: "agent_01kb0y2m4ses9tjk6dn3gq0f8v", valid: true },
    { name: "version 1, the lowest", id: "agent_01jd8v4t5m2n7a8q9r0s1t2v3w", valid: true },
    { name: "version 8, the highest", id: "agent_01jd8v4t5mhn7a8q9r0s1t2v3w", valid: true },
    { name: "version 0: no UUID", id: "agent_01jd8v4t5m0n7a8q9r0s1t2v3w", valid: false },
    { name: "version 9: no UUID", id: "agent_01jd8v4t5mjn7a8q9r0s1t2v3w", valid: false },
    { name: "a variant other than RFC 9562's", id: "agent_01jd8v4t5m6n7p8q9r0s1t2v3w", valid: false },
    { name: "a suffix past 128 bits", id: "agent_81jd8v4t5m6n7a8q9r0s1t2v3w", valid: false },
    { name: "another entity's prefix", id: "intent_01jd8v4t5m6n7a8q9r0s1t2v3w", valid: false },
    { name: "not a TypeID", id: "not-an-agent", valid: false }
  ])("$name", ({ id, valid }) => {
    assert.strictEqual(Schema.is(AgentId)(id), valid)
  })
})
