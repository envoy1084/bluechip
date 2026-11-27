import { notificationOfChatLink } from "@bluechip/domain/notifications/Drafts"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { NotificationFanout } from "../../../../src/modules/notifications/Fanout.ts"
import { NotificationOutbox } from "../../../../src/modules/notifications/Outbox.ts"
import { Database } from "../../../../src/platform/db/Database.ts"
import { depositArrived } from "../../../fixtures/Events.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`). A "crash" is a change written with its outbox row and never
// heard live: the in-process fan-out only wakes on live events, so the row waits for a drain (the sweep's, after a
// restart).
layer(TestUsers.layer, { excludeTestServices: true })("NotificationFanout", (it) => {
  describe("drain", () => {
    it.effect("a deposit written, then the process stopped before telling it: drained, it is one notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const db = yield* Database
        const outbox = yield* NotificationOutbox
        const fanout = yield* NotificationFanout
        yield* db.transaction(() => outbox.write(depositArrived(user.account), user.id)).pipe(Effect.orDie)

        const drained = yield* fanout.drain({ userId: user.id })
        const again = yield* fanout.drain({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(
          [drained, again, page.items.map((item) => [item.kind, item.title])],
          [1, 0, [["deposit", "$25.00 of USDC arrived"]]]
        )
      }))

    it.effect("a draft written as it is (a chat linked), then the process stopped: drained, it is one notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const db = yield* Database
        const outbox = yield* NotificationOutbox
        const fanout = yield* NotificationFanout
        const draft = notificationOfChatLink({ id: "channellink_01", platform: "telegram", name: "Ana" }, "linked")
        yield* db.transaction(() => outbox.notify(draft, user.id)).pipe(Effect.orDie)

        const drained = yield* fanout.drain({ userId: user.id })
        const again = yield* fanout.drain({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(
          [drained, again, page.items.map((item) => [item.kind, item.title, item.subjectId])],
          [1, 0, [["chatLinked", "Telegram is linked", "channellink_01"]]]
        )
      }))

    it.effect("one event handled twice (stopped after its notification, before its row was cleared): one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const db = yield* Database
        const outbox = yield* NotificationOutbox
        const deposit = depositArrived(user.account)
        yield* db.transaction(() => Effect.andThen(outbox.write(deposit, user.id), outbox.write(deposit, user.id)))
          .pipe(Effect.orDie)

        const drained = yield* (yield* NotificationFanout).drain({ userId: user.id })
        const page = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual([drained, page.items.map((item) => item.kind)], [2, ["deposit"]])
      }))

    it.effect("a change rolled back: no row, so no notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const db = yield* Database
        const outbox = yield* NotificationOutbox
        yield* db.transaction(() =>
          Effect.andThen(outbox.write(depositArrived(user.account), user.id), Effect.fail("stopped" as const))
        ).pipe(Effect.ignore)

        const drained = yield* (yield* NotificationFanout).drain({ userId: user.id })

        assert.strictEqual(drained, 0)
      }))

    it.effect("a sweep leaves rows written after its cutoff to the process that wrote them", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const db = yield* Database
        const outbox = yield* NotificationOutbox
        yield* db.transaction(() => outbox.write(depositArrived(user.account), user.id)).pipe(Effect.orDie)

        const claimed = yield* outbox.claim({
          userId: user.id,
          before: DateTime.subtract(DateTime.nowUnsafe(), { minutes: 1 })
        })

        assert.deepStrictEqual(claimed, [])
      }))
  })
})
