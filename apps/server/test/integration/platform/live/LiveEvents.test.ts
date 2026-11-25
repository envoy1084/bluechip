import { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { LiveEvents } from "../../../../src/platform/live/LiveEvents.ts"

const ada = "user_01jd000000000000000000000a" as UserId
const grace = "user_01jd000000000000000000000b" as UserId

describe("LiveEvents", () => {
  it.effect("delivers events for everyone to every user, and a user's own events only to them", () =>
    Effect.gen(function*() {
      const live = yield* LiveEvents
      const [first, second, third] = [1, 2, 3].map((sequence) =>
        LiveEvent.cases.Heartbeat.make({ at: DateTime.makeUnsafe(0), sequence })
      )
      const adas = yield* live.subscribe(ada)
      const graces = yield* live.subscribe(grace)

      yield* live.publish(first!)
      yield* live.publish(second!, ada)
      yield* live.publish(third!, grace)

      assert.deepStrictEqual(yield* Stream.runCollect(Stream.take(adas, 2)), [first, second])
      assert.deepStrictEqual(yield* Stream.runCollect(Stream.take(graces, 2)), [first, third])
    }).pipe(Effect.provide(LiveEvents.layer)))
})
