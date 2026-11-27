import { assert, describe, it } from "@effect/vitest"
import { eventUuid } from "../../../../src/modules/analytics/EventIds.ts"

describe("eventUuid", () => {
  it("the same fact and event: the same uuid", () => {
    assert.strictEqual(eventUuid("intent_01:filled", "intent_ended"), eventUuid("intent_01:filled", "intent_ended"))
  })

  // Python's `uuid.uuid5(UUID("6f1c2b0e-8a7d-4c3e-9b5f-1a2d3c4e5f60"), "trade_filled:trade_01")`: a change of
  // namespace or name would count every fact again.
  it("a UUIDv5 of the event and fact in bluechip's namespace", () => {
    assert.strictEqual(eventUuid("trade_01", "trade_filled"), "a93b37a8-e14f-57d0-b4f2-79f2bfe60d1b")
  })

  it("one fact told as two events: two uuids", () => {
    assert.notStrictEqual(
      eventUuid("intent_01:sending", "approval_signed"),
      eventUuid("intent_01:sending", "intent_ended")
    )
  })

  it("two facts told as one event: two uuids", () => {
    assert.notStrictEqual(eventUuid("trade_01", "trade_filled"), eventUuid("trade_02", "trade_filled"))
  })
})
