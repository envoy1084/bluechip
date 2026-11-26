import { Conflict, InsufficientCash, SignatureRejected } from "@bluechip/domain/Errors"
import { type Address, RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { KINDS } from "@bluechip/domain/notifications/Kinds"
import { assert, beforeEach, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { addNotification, setRecovery, setTelegram, withdrawal } from "../../../src/preview/panel/actions/account.ts"
import { previewApi } from "../../utils/PreviewApi.ts"

// Panel actions are saved in session storage and played again by the next store: every test starts without any.
beforeEach(() => sessionStorage.clear())

const registration = {
  id: "cHJldmlldw",
  rawId: "cHJldmlldw",
  type: "public-key",
  clientExtensionResults: {},
  response: { clientDataJSON: "e30", attestationObject: "cHJldmlldw" }
} as const

const signature = {
  id: "cHJldmlldw",
  rawId: "cHJldmlldw",
  type: "public-key",
  clientExtensionResults: {},
  response: { clientDataJSON: "e30", authenticatorData: "cHJldmlldw", signature: "c2lnbmVk" }
} as const

const ANCHOR = /^[a-z]+_01kqpv000070089[0-9a-z]{11}$/

describe("preview account API", () => {
  describe("GET endpoints, in every scenario", () => {
    it.effect.each(
      [
        { scenario: "newPerson" as const, expected: [null, false, 1, 1, false, 0, 0, 0, 0, 0, 24] },
        { scenario: "starter" as const, expected: ["Jordan", true, 1, 1, false, 2, 1, 0, 0, 1, 24] },
        { scenario: "typical" as const, expected: ["Alex", true, 2, 2, false, 8, 3, 0, 1, 4, 24] },
        { scenario: "heavy" as const, expected: ["Sam Rivera", true, 4, 5, true, 46, 12, 1, 2, 13, 24] }
      ]
    )("$scenario", ({ expected, scenario }) =>
      Effect.gen(function*() {
        const { client } = yield* previewApi(scenario)

        const me = yield* client.account.me()
        const passkeys = yield* client.account.passkeys()
        const devices = yield* client.account.devices()
        const recovery = yield* client.accountRecovery.get()
        const notifications = yield* client.notifications.list({ query: { pageSize: 100 } })
        const unread = yield* client.notifications.unreadCount()
        const links = yield* client.channels.links()
        const push = yield* client.push.devices()
        const transfers = yield* client.transfers.list({ query: { pageSize: 100 } })
        const settings = yield* client.notifications.settings()

        assert.deepStrictEqual<ReadonlyArray<unknown>>([
          me.user.displayName,
          me.account.deployed,
          passkeys.length,
          devices.length,
          recovery.request?.status === "waiting",
          notifications.items.length,
          unread.count,
          links.length,
          push.length,
          transfers.items.length,
          settings.rules.length
        ], expected)
      }))

    it.effect.each(["newPerson", "starter", "typical", "heavy"] as const)(
      "the rest decode in %s",
      (scenario) =>
        Effect.gen(function*() {
          const { client } = yield* previewApi(scenario)

          const key = yield* client.push.key()
          const audit = yield* client.audit.list({ query: { pageSize: 100 } })
          const exported = yield* client.audit.export({ query: {} })
          const recovering = yield* client.recovering.get()

          assert.deepStrictEqual(
            [key.publicKey !== null, audit.items.length === Math.min(exported.length, 100), recovering.account],
            [true, true, "0x5e1f0000000000000000000000000000000b1c4f"]
          )
        })
    )

    it.effect("the heavy notifications page on", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const first = yield* client.notifications.list({ query: { pageSize: 20 } })
        const second = yield* client.notifications.list({ query: { pageSize: 20, pageToken: first.nextPageToken! } })
        const last = yield* client.notifications.list({ query: { pageSize: 20, pageToken: second.nextPageToken! } })

        assert.deepStrictEqual([first.items.length, second.items.length, last.items.length, last.nextPageToken], [
          20,
          20,
          6,
          null
        ])
      }))

    it.effect("unread only", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const unread = yield* client.notifications.list({ query: { pageSize: 100, unread: "true" } })

        assert.deepStrictEqual(unread.items.map((notification) => notification.readAt), Array(12).fill(null))
      }))

    it.effect("the audit log of passkeys only", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const passkeys = yield* client.audit.export({ query: { type: "passkey" } })

        assert.deepStrictEqual(passkeys.map((event) => event.action), [
          "passkey.added",
          "passkey.added",
          "passkey.added"
        ])
      }))
  })

  describe("account", () => {
    it.effect("a display name set", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")

        yield* client.account.setDisplayName({ payload: { displayName: "Robin" } })

        assert.strictEqual((yield* client.account.me()).user.displayName, "Robin")
      }))

    it.effect("a passkey added: pending once signed", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const ceremony = yield* client.account.passkeyOptions()
        const change = yield* client.account.addPasskey({
          payload: {
            requestId: RequestId.make(crypto.randomUUID()),
            challengeId: ceremony.challengeId,
            credential: registration
          }
        })
        const passkey = yield* client.account.confirmPasskeyChange({
          params: { id: change.id },
          payload: { credential: signature }
        })

        assert.deepStrictEqual(
          [change.action, passkey.status, (yield* client.account.passkeys()).map((listed) => listed.status)],
          ["add", "pending", ["active", "active", "pending"]]
        )
      }))

    it.effect("409: the only passkey removed", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")
        const [only] = yield* client.account.passkeys()

        const error = yield* Effect.flip(
          client.account.removePasskey({
            params: { id: only!.id },
            payload: { requestId: RequestId.make(crypto.randomUUID()) }
          })
        )

        assert.deepStrictEqual(error, new Conflict({ reason: "lastPasskey" }))
      }))

    it.effect("every other device signed out", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        yield* client.account.signOutOthers()

        assert.deepStrictEqual((yield* client.account.devices()).map((device) => device.current), [true])
      }))
  })

  describe("recovery", () => {
    it.effect("a recovery key set up: locking once signed", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const ceremony = yield* client.accountRecovery.keyOptions()
        const change = yield* client.accountRecovery.setUp({
          payload: {
            requestId: RequestId.make(crypto.randomUUID()),
            challengeId: ceremony.challengeId,
            credential: registration
          }
        })
        const recovery = yield* client.accountRecovery.confirmKey({
          params: { id: change.id },
          payload: { credential: signature }
        })

        assert.deepStrictEqual(recovery.key?.status, "locking")
      }))

    it.effect("the waiting recovery cancelled, and told", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const recovery = yield* client.accountRecovery.cancel()
        const latest = yield* client.notifications.list({ query: { pageSize: 1 } })

        assert.deepStrictEqual(
          [recovery.request?.status, recovery.request?.cancelledFrom, latest.items[0]?.kind],
          ["cancelled", "app", "recoveryCancelled"]
        )
      }))

    it.effect("409: nothing to cancel", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const error = yield* Effect.flip(client.accountRecovery.cancel())

        assert.deepStrictEqual(error, new Conflict({ reason: "noRecoveryRequest" }))
      }))

    it.effect("403: signing in to recover without a recovery key", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const error = yield* Effect.flip(
          client.recovery.signIn({ payload: { challengeId: "x", credential: signature } })
        )

        assert.deepStrictEqual(error, new SignatureRejected({ reason: "unknownPasskey" }))
      }))

    it.effect("409: making a recovery before its 48 hours", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const error = yield* Effect.flip(client.recovering.execute())

        assert.deepStrictEqual(error, new Conflict({ reason: "recoveryNotDue" }))
      }))

    it.effect("a due recovery made: executing once signed", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("heavy")
        store.act(setRecovery("due"))

        const signing = yield* client.recovering.execute()
        const recovering = yield* client.recovering.confirm({
          params: { id: signing.id },
          payload: { credential: signature }
        })

        assert.deepStrictEqual([signing.action, recovering.request?.status], ["execute", "executing"])
      }))

    it.effect("a recovery asked for: requesting once signed", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        store.act(setRecovery("key"))

        const signing = yield* client.recovering.request({ payload: { challengeId: "x", credential: registration } })
        const recovering = yield* client.recovering.confirm({
          params: { id: signing.id },
          payload: { credential: signature }
        })

        assert.deepStrictEqual(recovering.request?.status, "requesting")
      }))
  })

  describe("notifications", () => {
    it.effect("one read", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")
        const { items } = yield* client.notifications.list({ query: { unread: "true" } })

        const read = yield* client.notifications.read({ params: { id: items[0]!.id } })

        assert.deepStrictEqual([read.readAt !== null, (yield* client.notifications.unreadCount()).count], [true, 2])
      }))

    it.effect("all read", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        yield* client.notifications.readAll()

        assert.strictEqual((yield* client.notifications.unreadCount()).count, 0)
      }))

    it.effect("a rule saved, kept to the kind's channels", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")

        const settings = yield* client.notifications.setRule({
          params: { kind: "dailyDigest" },
          payload: { channels: ["push"], digest: false }
        })

        assert.deepStrictEqual(settings.rules.find((rule) => rule.kind === "dailyDigest"), {
          kind: "dailyDigest",
          channels: ["inApp"],
          digest: false
        })
      }))

    it.effect("quiet hours off", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")

        const settings = yield* client.notifications.setQuietHours({ payload: { quietHours: null } })

        assert.strictEqual(settings.quietHours, null)
      }))

    it.effect("a device opted in to push, then out", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")

        const device = yield* client.push.subscribe({
          payload: {
            endpoint: "https://fcm.googleapis.com/fcm/send/test",
            keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
            device: "Chrome on Mac"
          }
        })
        const listed = (yield* client.push.devices()).length
        yield* client.push.unsubscribe({ params: { id: device.id } })

        assert.deepStrictEqual([listed, (yield* client.push.devices()).length], [1, 0])
      }))

    it.effect("a Telegram code", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const code = yield* client.channels.linkCode({ params: { platform: "telegram" } })

        assert.match(code.deepLink ?? "", /^https:\/\/t\.me\/bluechip_market_bot\?start=[A-Z2-9]{8}$/)
      }))

    it.effect("Telegram unlinked, and told", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("heavy")
        const [link] = yield* client.channels.links()

        yield* client.channels.unlink({ params: { id: link!.id } })
        const latest = yield* client.notifications.list({ query: { pageSize: 1 } })

        assert.deepStrictEqual([(yield* client.channels.links()).length, latest.items[0]?.kind], [0, "chatUnlinked"])
      }))
  })

  describe("transfers", () => {
    it.effect("a withdrawal prepared and signed: pending, first", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const request = yield* client.transfers.prepareWithdrawal({
          payload: {
            requestId: RequestId.make(crypto.randomUUID()),
            to: "0x00000000000000000000000000000000000000aa" as Address,
            amount: Usdc.make(BigInt(100_000_000))
          }
        })
        const transfer = yield* client.transfers.confirmWithdrawal({
          params: { id: request.id },
          payload: { credential: signature }
        })
        const latest = yield* client.transfers.list({ query: { pageSize: 1 } })

        assert.deepStrictEqual(
          [transfer.status, transfer.amount, latest.items[0]?.id === transfer.id],
          ["pending", BigInt(100_000_000), true]
        )
      }))

    it.effect("422: a withdrawal over the cash", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")

        const error = yield* Effect.flip(client.transfers.prepareWithdrawal({
          payload: {
            requestId: RequestId.make(crypto.randomUUID()),
            to: "0x00000000000000000000000000000000000000aa" as Address,
            amount: Usdc.make(BigInt(1_000_000))
          }
        }))

        assert.deepStrictEqual(error, new InsufficientCash({ available: BigInt(0) }))
      }))

    it.effect("test money arrives as a deposit", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("newPerson")

        yield* client.dev.fund()
        const { items } = yield* client.transfers.list({ query: {} })

        assert.deepStrictEqual(items.map((transfer) => [transfer.kind, transfer.amount, transfer.status]), [
          ["deposit", BigInt(1_000_000_000), "confirmed"]
        ])
      }))
  })

  describe("auth and rpc", () => {
    it.effect("signed out, then in again", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")

        yield* client.auth.logout()
        const out = store.settings.live
        const ceremony = yield* client.auth.loginOptions()
        const me = yield* client.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: signature }
        })

        assert.deepStrictEqual([out, store.settings.live, me.user.displayName], ["signedOut", "connected", "Alex"])
      }))

    it.effect("a wallet's reads, in a batch", () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi("typical")

        const answers = yield* client.rpc.call({
          payload: [
            { jsonrpc: "2.0", id: 1, method: "eth_chainId" },
            { jsonrpc: "2.0", id: 2, method: "eth_getBalance", params: ["0x00", "latest"] },
            { jsonrpc: "2.0", id: 3, method: "eth_sendRawTransaction" }
          ]
        })

        assert.deepStrictEqual(answers, [
          { jsonrpc: "2.0", id: 1, result: "0x2105" },
          { jsonrpc: "2.0", id: 2, result: "0x0" },
          { jsonrpc: "2.0", id: 3, error: { code: -32601, message: "bluechip doesn't forward eth_sendRawTransaction" } }
        ])
      }))
  })

  describe("panel actions", () => {
    it.effect.each(KINDS.map((info) => info.kind))("a notification of kind %s", (kind) =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("newPerson")
        store.act(addNotification(kind, false))

        const { items } = yield* client.notifications.list({ query: {} })

        assert.deepStrictEqual([items.length, items[0]?.kind, items[0]?.readAt], [1, kind, null])
        assert.match(items[0]!.id, ANCHOR)
      }))

    it.effect.each(
      [
        { state: "none", expected: [null, null] },
        { state: "locking", expected: ["locking", null] },
        { state: "key", expected: ["active", null] },
        { state: "waiting", expected: ["active", "waiting"] },
        { state: "due", expected: ["active", "waiting"] },
        { state: "cancelled", expected: ["active", "cancelled"] },
        { state: "completed", expected: ["active", "completed"] }
      ] as const
    )("recovery: $state", ({ expected, state }) =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        store.act(setRecovery(state))

        const recovery = yield* client.accountRecovery.get()

        assert.deepStrictEqual<ReadonlyArray<string | null>>(
          [recovery.key?.status ?? null, recovery.request?.status ?? null],
          expected
        )
      }))

    it.effect("Telegram linked", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        store.act(setTelegram(true))

        const links = yield* client.channels.links()

        assert.deepStrictEqual(links.map((link) => link.name), ["Alex"])
      }))

    it.effect("a withdrawal sent, then failed", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        store.act(withdrawal("pending"))
        store.act(withdrawal("failed"))

        const { items } = yield* client.transfers.list({ query: { pageSize: 1 } })

        assert.deepStrictEqual([items[0]?.status, items[0]?.amount], ["failed", BigInt(250_000_000)])
      }))
  })
})
