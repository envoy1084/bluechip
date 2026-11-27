import { NotFound } from "@bluechip/domain/Errors"
import { NotificationId } from "@bluechip/domain/Ids"
import type { NotificationDraft } from "@bluechip/domain/notifications/Notification"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Notifications } from "../../../src/modules/notifications/Notifications.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestNotifications } from "../../utils/TestNotifications.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

const draft = (dedupeKey: string, kind: NotificationDraft["kind"] = "automationFired"): NotificationDraft => ({
  kind,
  title: "Dip buyer ran",
  body: "Apple is up 5% today.",
  link: "/automations",
  subjectType: null,
  subjectId: null,
  dedupeKey
})

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAgents.layer, TestNotifications.layer), { excludeTestServices: true })(
  "notifications",
  (it) => {
    describe("Notifications.add", () => {
      it.effect("a new notification is listed, counted as unread and told to the user's pages", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const added = yield* (yield* Notifications).add(user.id, draft("run:1"))
          const { notification: told } = yield* user.events.next("NotificationAdded")
          const page = yield* user.api.notifications.list({ query: {} })
          const { count } = yield* user.api.notifications.unreadCount()

          assert.deepStrictEqual(
            [told.id, page.items.map((item) => [item.id, item.kind, item.severity, item.title, item.readAt]), count],
            [added!.id, [[added!.id, "automationFired", "info", "Dip buyer ran", null]], 1]
          )
        }))

      it.effect("the same cause twice: one notification", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const notifications = yield* Notifications

          yield* notifications.add(user.id, draft("run:2"))
          const again = yield* notifications.add(user.id, draft("run:2"))
          const page = yield* user.api.notifications.list({ query: {} })

          assert.deepStrictEqual([again, page.items.length], [undefined, 1])
        }))

      it.effect("a kind going to Telegram, with no chat linked: skipped", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const added = yield* (yield* Notifications).add(user.id, draft("run:3", "intentFilled"))
          const deliveries = yield* (yield* TestNotifications).delivered(added!.id)

          assert.deepStrictEqual(deliveries, [{ channel: "telegram", status: "skipped", error: null }])
        }))

      it.effect("a kind held for the digest: nothing delivered now", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const added = yield* (yield* Notifications).add(user.id, draft("run:4", "automationSkipped"))
          const deliveries = yield* (yield* TestNotifications).delivered(added!.id)

          assert.deepStrictEqual(deliveries, [])
        }))
    })

    describe("GET /api/notifications", () => {
      it.effect("newest first, a page at a time, and only unread ones", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const notifications = yield* Notifications
          const first = yield* notifications.add(user.id, draft("a"))
          const second = yield* notifications.add(user.id, draft("b"))
          const third = yield* notifications.add(user.id, draft("c"))
          yield* user.api.notifications.read({ params: { id: second!.id } })

          const page = yield* user.api.notifications.list({ query: { pageSize: 2 } })
          const next = yield* user.api.notifications.list({ query: { pageSize: 2, pageToken: page.nextPageToken! } })
          const unread = yield* user.api.notifications.list({ query: { unread: "true" } })

          assert.deepStrictEqual(
            [page.items.map((item) => item.id), next.items.map((item) => item.id), unread.items.map((item) => item.id)],
            [[third!.id, second!.id], [first!.id], [third!.id, first!.id]]
          )
        }))

      it.effect("another user's notifications are never listed", () =>
        Effect.gen(function*() {
          const users = yield* TestUsers
          const owner = yield* users.signUp
          const stranger = yield* users.signUp
          yield* (yield* Notifications).add(owner.id, draft("mine"))

          const page = yield* stranger.api.notifications.list({ query: {} })

          assert.deepStrictEqual(page.items, [])
        }))
    })

    describe("POST /api/notifications/:id/read", () => {
      it.effect("read: no longer counted, and reading it again keeps the first time", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const added = yield* (yield* Notifications).add(user.id, draft("read"))

          const read = yield* user.api.notifications.read({ params: { id: added!.id } })
          const again = yield* user.api.notifications.read({ params: { id: added!.id } })
          const { count } = yield* user.api.notifications.unreadCount()

          assert.deepStrictEqual([read.readAt !== null, again.readAt, count], [true, read.readAt, 0])
        }))

      it.effect("404: another user's notification", () =>
        Effect.gen(function*() {
          const users = yield* TestUsers
          const owner = yield* users.signUp
          const stranger = yield* users.signUp
          const added = yield* (yield* Notifications).add(owner.id, draft("theirs"))

          const error = yield* Effect.flip(stranger.api.notifications.read({ params: { id: added!.id } }))

          assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "notification", id: added!.id }) })
        }))
    })

    describe("POST /api/notifications/read", () => {
      it.effect("reads every notification", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const notifications = yield* Notifications
          yield* notifications.add(user.id, draft("x"))
          yield* notifications.add(user.id, draft("y"))

          yield* user.api.notifications.readAll()
          const { count } = yield* user.api.notifications.unreadCount()

          assert.strictEqual(count, 0)
        }))
    })

    describe("GET /api/notifications/settings", () => {
      it.effect("a new user: every kind at its defaults, no quiet hours", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const settings = yield* user.api.notifications.settings()

          assert.deepStrictEqual(
            [
              settings.rules.find((rule) => rule.kind === "approvalNeeded"),
              settings.rules.find((rule) => rule.kind === "intentFilled"),
              settings.rules.length,
              settings.quietHours
            ],
            [
              { kind: "approvalNeeded", channels: ["inApp", "push", "telegram"], digest: false },
              { kind: "intentFilled", channels: ["inApp", "telegram"], digest: false },
              24,
              null
            ]
          )
        }))
    })

    describe("PUT /api/notifications/settings/rules/:kind", () => {
      it.effect("trades done on push only: kept, the center still on, and followed by the next one", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const settings = yield* user.api.notifications.setRule({
            params: { kind: "automationFired" },
            payload: { channels: ["push"], digest: false }
          })
          const added = yield* (yield* Notifications).add(user.id, draft("pushed"))
          const deliveries = yield* (yield* TestNotifications).delivered(added!.id)

          assert.deepStrictEqual(
            [settings.rules.find((rule) => rule.kind === "automationFired"), deliveries],
            [
              { kind: "automationFired", channels: ["inApp", "push"], digest: false },
              [{ channel: "push", status: "skipped", error: null }]
            ]
          )
        }))

      it.effect("a security kind turned off: still everywhere", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp

          const settings = yield* user.api.notifications.setRule({
            params: { kind: "chatLinked" },
            payload: { channels: [], digest: true }
          })

          assert.deepStrictEqual(settings.rules.find((rule) => rule.kind === "chatLinked"), {
            kind: "chatLinked",
            channels: ["inApp", "push", "telegram"],
            digest: false
          })
        }))
    })

    describe("PUT /api/notifications/settings/quiet-hours", () => {
      it.effect("set, then turned off", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const quietHours = { from: "22:00", to: "07:00" }

          const set = yield* user.api.notifications.setQuietHours({ payload: { quietHours } })
          const off = yield* user.api.notifications.setQuietHours({ payload: { quietHours: null } })

          assert.deepStrictEqual([set.quietHours, off.quietHours], [quietHours, null])
        }))
    })

    describe("from what happens", () => {
      it.effect("an agent paused: the user is told, once", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked

          yield* user.api.agents.pause({ params: { id: agent.id } })
          const { notification } = yield* user.events.next("NotificationAdded")
          yield* user.api.agents.resume({ params: { id: agent.id } })
          const page = yield* user.api.notifications.list({ query: {} })

          assert.deepStrictEqual(
            [notification.kind, notification.title, notification.link, page.items.map((item) => item.kind)],
            [
              "agentPaused",
              `${agent.name} is paused`,
              `/agents/${agent.id}`,
              ["agentPaused"]
            ]
          )
          assert.match(notification.id, /^notification_/)
          assert.ok(NotificationId.make(notification.id))
        }))
    })
  }
)
