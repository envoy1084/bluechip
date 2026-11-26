import {
  notificationOfDevice,
  notificationOfPasskey,
  notificationOfRecovery,
  notificationOfRecoveryKey
} from "@bluechip/domain/notifications/SecurityDrafts"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

describe("notificationOfPasskey", () => {
  it("a passkey added", () => {
    assert.deepStrictEqual(notificationOfPasskey({ id: "passkey_01", label: "YubiKey" }, true), {
      kind: "passkeyAdded",
      title: "YubiKey can now sign for your account",
      body: "It signs in and approves with Face ID like your other passkeys. Remove it in Settings if this wasn't you.",
      link: "/settings/security",
      subjectType: "passkey",
      subjectId: "passkey_01",
      dedupeKey: "passkeyAdded:passkey_01"
    })
  })

  it("a passkey without a label, removed", () => {
    assert.deepStrictEqual(notificationOfPasskey({ id: "passkey_01", label: null }, false), {
      kind: "passkeyRemoved",
      title: "A passkey was removed",
      body: "It can no longer sign in or approve anything for your account.",
      link: "/settings/security",
      subjectType: "passkey",
      subjectId: "passkey_01",
      dedupeKey: "passkeyRemoved:passkey_01"
    })
  })
})

describe("notificationOfDevice", () => {
  it("a new device", () => {
    assert.deepStrictEqual(notificationOfDevice({ id: "session_01", device: "Safari on iPhone" }), {
      kind: "newDevice",
      title: "Safari on iPhone signed in",
      body: "A device that hadn't signed in before is now signed in to your account. Sign it out in Settings if " +
        "this wasn't you.",
      link: "/settings/security",
      subjectType: "session",
      subjectId: "session_01",
      dedupeKey: "newDevice:session_01"
    })
  })
})

describe("notificationOfRecoveryKey", () => {
  it.each([
    {
      set: true,
      title: "Your recovery key is ready",
      body: "YubiKey can recover your account if you lose every passkey, 48 hours after it asks."
    },
    {
      set: false,
      title: "Your recovery key was removed",
      body: "Without a recovery key, losing every passkey means losing access to your account. Set one up in Settings."
    }
  ])("set: $set", ({ body, set, title }) => {
    const draft = notificationOfRecoveryKey({ id: "recoverykey_01", label: "YubiKey" }, set)
    assert.deepStrictEqual([draft.kind, draft.title, draft.body], ["recoveryKeyChanged", title, body])
  })
})

describe("notificationOfRecovery", () => {
  const request = { id: "recovery_01", executableAt: DateTime.makeUnsafe("2026-11-29T10:00:00Z") }

  it("asked for: when it can happen, in UTC", () => {
    assert.deepStrictEqual(notificationOfRecovery(request, { _tag: "Requested" }), {
      kind: "recoveryRequested",
      title: "Someone asked to recover your account",
      body: "Your recovery key asked to replace your passkeys with a new one. It can happen from Sun 29 Nov, 10:00 " +
        "UTC. If this wasn't you, cancel it now.",
      link: "/settings/security",
      subjectType: "recovery",
      subjectId: "recovery_01",
      dedupeKey: "recoveryRequested:recovery_01"
    })
  })

  it.each(
    [
      { from: "app", body: "It was cancelled from a signed-in device. Your passkeys stay as they are." },
      { from: "telegram", body: "It was cancelled from Telegram. Your passkeys stay as they are." }
    ] as const
  )("cancelled from $from", ({ body, from }) => {
    const draft = notificationOfRecovery(request, { _tag: "Cancelled", from })
    assert.deepStrictEqual([draft.kind, draft.body], ["recoveryCancelled", body])
  })

  it("made", () => {
    const draft = notificationOfRecovery(request, { _tag: "Completed" })
    assert.deepStrictEqual([draft.kind, draft.title, draft.body], [
      "recoveryCompleted",
      "Your account was recovered",
      "A new passkey now owns your account and your old passkeys were removed."
    ])
  })
})
