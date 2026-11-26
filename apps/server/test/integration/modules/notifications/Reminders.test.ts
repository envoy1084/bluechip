import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as TestClock from "effect/testing/TestClock"
import { Notifications } from "../../../../src/modules/notifications/Notifications.ts"
import { Reminders } from "../../../../src/modules/notifications/Reminders.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`). A session ends 90 days after it is locked, so the reminders
// run on a test clock moved near that end, for their own user only.
layer(TestAgents.layer, { excludeTestServices: true })("Reminders", (it) => {
  describe("remind", () => {
    it.effect("a session ending in 3 days: told it stops in a week, once", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const reminders = yield* Reminders

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.subtract(agent.lockedUntil!, { days: 3 })))
          yield* reminders.remind({ userId: user.id })
          yield* reminders.remind({ userId: user.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(page.items.map((item) => [item.kind, item.title]), [
          ["sessionEnding", `${agent.name} stops in a week`]
        ])
      }))

    it.effect("then 12 hours before: told it stops tomorrow too", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const reminders = yield* Reminders

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.subtract(agent.lockedUntil!, { days: 3 })))
          yield* reminders.remind({ userId: user.id })
          yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.subtract(agent.lockedUntil!, { hours: 12 })))
          yield* reminders.remind({ userId: user.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(page.items.map((item) => item.title), [
          `${agent.name} stops tomorrow`,
          `${agent.name} stops in a week`
        ])
      }))

    it.effect("a session with more than a week left: nothing", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked

        yield* (yield* Reminders).remind({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(page.items, [])
      }))
  })

  describe("digest", () => {
    it.effect("what the digest kinds held in the last day, in one notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const notifications = yield* Notifications
        const held = {
          kind: "automationSkipped",
          body: "The story isn't about earnings.",
          link: null,
          subjectType: null,
          subjectId: null
        } as const
        yield* notifications.add(user.id, { ...held, title: "A judgment held back Dip buyer", dedupeKey: "run:d1" })
        yield* notifications.add(user.id, { ...held, title: "A judgment held back Earnings", dedupeKey: "run:d2" })

        yield* (yield* Reminders).digest({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual([page.items[0]?.kind, page.items[0]?.title, page.items[0]?.body], [
          "dailyDigest",
          "Your day: 2 updates",
          "A judgment held back Dip buyer.\nA judgment held back Earnings."
        ])
      }))

    it.effect("nothing held: no digest", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* (yield* Notifications).add(user.id, {
          kind: "automationFired",
          title: "Dip buyer ran",
          body: "It ran.",
          link: null,
          subjectType: null,
          subjectId: null,
          dedupeKey: "run:d3"
        })

        yield* (yield* Reminders).digest({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(page.items.map((item) => item.kind), ["automationFired"])
      }))
  })
})
