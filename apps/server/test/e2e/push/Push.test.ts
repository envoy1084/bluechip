import { NotFound } from "@bluechip/domain/Errors"
import { notificationOfChatLink } from "@bluechip/domain/notifications/Drafts"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Notifications } from "../../../src/modules/notifications/Notifications.ts"
import { pushSubscription } from "../../fixtures/Push.ts"
import { PushServiceTest } from "../../utils/PushServiceTest.ts"
import { TestNotifications } from "../../utils/TestNotifications.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

const linked = notificationOfChatLink({ id: "channellink_push", platform: "telegram", name: "Maya" }, "linked")

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestUsers.layer, TestNotifications.layer), { excludeTestServices: true })("web push", (it) => {
  describe("GET /api/push/key", () => {
    it.effect("the server's VAPID public key", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const { publicKey } = yield* user.api.push.key()

        assert.match(publicKey!, /^[A-Za-z0-9_-]{87}$/)
      }))
  })

  describe("POST /api/push/devices", () => {
    it.effect("a device opted in is listed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const subscription = pushSubscription()

        const device = yield* user.api.push.subscribe({ payload: subscription })
        const devices = yield* user.api.push.devices()

        assert.deepStrictEqual(devices.map((listed) => [listed.id, listed.device, listed.endpoint]), [
          [device.id, "Chrome on Mac", subscription.endpoint]
        ])
      }))

    it.effect("the same browser again: one device", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const subscription = pushSubscription()

        yield* user.api.push.subscribe({ payload: subscription })
        yield* user.api.push.subscribe({ payload: { ...subscription, device: "Chrome on Mac (work)" } })
        const devices = yield* user.api.push.devices()

        assert.deepStrictEqual(devices.map((listed) => listed.device), ["Chrome on Mac (work)"])
      }))
  })

  describe("DELETE /api/push/devices/:id", () => {
    it.effect("a device opted out is gone", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const device = yield* user.api.push.subscribe({ payload: pushSubscription() })

        yield* user.api.push.unsubscribe({ params: { id: device.id } })
        const devices = yield* user.api.push.devices()

        assert.deepStrictEqual(devices, [])
      }))

    it.effect("404: another user's device", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const owner = yield* users.signUp
        const stranger = yield* users.signUp
        const device = yield* owner.api.push.subscribe({ payload: pushSubscription() })

        const error = yield* Effect.flip(stranger.api.push.unsubscribe({ params: { id: device.id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "pushDevice", id: device.id }) })
      }))
  })

  describe("the push notifier", () => {
    it.effect("a notification is pushed to the device, encrypted, with the server's identity", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const subscription = pushSubscription()
        yield* user.api.push.subscribe({ payload: subscription })

        const added = yield* (yield* Notifications).add(user.id, linked)
        const deliveries = yield* (yield* TestNotifications).delivered(added!.id)
        const [push] = yield* (yield* PushServiceTest).to(subscription.endpoint)

        assert.deepStrictEqual(deliveries, [
          { channel: "push", status: "sent", error: null },
          { channel: "telegram", status: "skipped", error: null }
        ])
        assert.deepStrictEqual(
          [push!.headers["content-encoding"], push!.headers["ttl"], push!.headers["urgency"]],
          ["aes128gcm", "86400", "high"]
        )
        assert.match(push!.headers["authorization"]!, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/)
      }))

    it.effect("a device its push service no longer knows (410) is forgotten, and the delivery skipped", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* user.api.push.subscribe({ payload: pushSubscription() })
        yield* (yield* PushServiceTest).answer(410)

        const added = yield* (yield* Notifications).add(user.id, linked)
        const deliveries = yield* (yield* TestNotifications).delivered(added!.id)
        const devices = yield* user.api.push.devices()

        assert.deepStrictEqual([deliveries[0], devices], [{ channel: "push", status: "skipped", error: null }, []])
      }))

    it.effect("no device opted in: skipped", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const added = yield* (yield* Notifications).add(user.id, linked)
        const deliveries = yield* (yield* TestNotifications).delivered(added!.id)

        assert.deepStrictEqual(deliveries[0], { channel: "push", status: "skipped", error: null })
      }))
  })
})
