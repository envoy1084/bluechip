import { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../src/platform/live/LiveEvents.ts"

const ada = "user_01jd000000000000000000000a" as UserId
const grace = "user_01jd000000000000000000000b" as UserId

const heartbeat = (sequence: number) => LiveEvent.cases.Heartbeat.make({ at: DateTime.makeUnsafe(0), sequence })

describe("LiveEvents", () => {
  it.effect("delivers events for everyone to every user, and a user's own events only to them", () =>
    Effect.gen(function*() {
      const live = yield* LiveEvents
      const adas = yield* live.subscribe(ada)
      const graces = yield* live.subscribe(grace)
      yield* live.publish(heartbeat(1))
      yield* live.publish(heartbeat(2), ada)
      yield* live.publish(heartbeat(3), grace)
      const sequences = (events: Iterable<LiveEvent>) =>
        [...events].map((event) => event._tag === "Heartbeat" ? event.sequence : -1)
      assert.deepStrictEqual(sequences(yield* Stream.runCollect(Stream.take(adas, 2))), [1, 2])
      assert.deepStrictEqual(sequences(yield* Stream.runCollect(Stream.take(graces, 2))), [1, 3])
    }).pipe(Effect.scoped, Effect.provide(LiveEvents.layer)))
})
