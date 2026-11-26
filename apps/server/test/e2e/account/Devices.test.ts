import { NotFound } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { type TestUser, TestUsers } from "../../utils/TestUsers.ts"

const CHROME_ON_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

layer(TestUsers.layer, { excludeTestServices: true })("the account's devices", (it) => {
  // The user's passkey signing in from another browser.
  const signInOn = Effect.fnUntraced(function*(user: TestUser, userAgent: string) {
    const browser = yield* (yield* TestUsers).browserOn(userAgent)
    const ceremony = yield* browser.api.auth.loginOptions()
    yield* browser.api.auth.loginVerify({
      payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
    })
    return browser
  }, Effect.orDie)

  describe("GET /api/account/devices", () => {
    it.effect("the browser that signed up is the one device, and it's this one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const devices = yield* user.api.account.devices()

        assert.deepStrictEqual(devices.map(({ current, device }) => ({ device, current })), [
          { device: "A browser", current: true }
        ])
      }))

    it.effect("a sign-in from Chrome on Windows is listed by name, with its passkey", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* signInOn(user, CHROME_ON_WINDOWS)

        const devices = yield* user.api.account.devices()

        assert.deepStrictEqual(
          devices.map(({ current, device }) => ({ device, current })).sort((a, b) => a.device.localeCompare(b.device)),
          [{ device: "A browser", current: true }, { device: "Chrome on Windows", current: false }]
        )
        assert.match(devices[0]!.passkey ?? "", /Passkey/)
      }))
  })

  describe("a sign-in on a new device", () => {
    it.effect("is a security notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* signInOn(user, CHROME_ON_WINDOWS)

        const { notification } = yield* user.events.next("NotificationAdded")

        assert.deepStrictEqual([notification.kind, notification.title], ["newDevice", "Chrome on Windows signed in"])
      }))

    it.effect("on a device seen before says nothing", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        yield* signInOn(user, CHROME_ON_WINDOWS)
        yield* signInOn(user, CHROME_ON_WINDOWS)

        const notifications = yield* user.api.notifications.list({ query: {} })

        assert.deepStrictEqual(notifications.items.map((notification) => notification.kind), ["newDevice"])
      }))
  })

  describe("POST /api/account/devices/:id/sign-out", () => {
    it.effect("the device signed out can no longer call the API", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const other = yield* signInOn(user, CHROME_ON_WINDOWS)
        const device = (yield* user.api.account.devices()).find((candidate) => !candidate.current)!

        yield* user.api.account.signOutDevice({ params: { id: device.id } })

        assert.strictEqual((yield* Effect.flip(other.api.account.me()))._tag, "Unauthenticated")
        assert.strictEqual((yield* user.api.account.devices()).length, 1)
      }))

    it.effect("404: another user's device", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const stranger = yield* users.signUp
        const [theirs] = yield* stranger.api.account.devices()

        const error = yield* Effect.flip(user.api.account.signOutDevice({ params: { id: theirs!.id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "device", id: theirs!.id }) })
      }))
  })

  describe("POST /api/account/devices/sign-out-others", () => {
    it.effect("signs out every other device and keeps this one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const first = yield* signInOn(user, CHROME_ON_WINDOWS)
        const second = yield* signInOn(user, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/604.1")

        yield* user.api.account.signOutOthers()

        assert.deepStrictEqual(
          [
            (yield* Effect.flip(first.api.account.me()))._tag,
            (yield* Effect.flip(second.api.account.me()))._tag,
            (yield* user.api.account.devices()).length
          ],
          ["Unauthenticated", "Unauthenticated", 1]
        )
      }))
  })
})
