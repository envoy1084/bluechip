import { Device, Passkey } from "@bluechip/domain/Account"
import { Conflict, SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import type { PasskeyId, RecoveryKeyId, RecoveryRequestId, SessionId } from "@bluechip/domain/Ids"
import { AccountRecovery, RecoveryKey, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  changeProblem,
  deviceDescription,
  passkeyDescription,
  recoveryText
} from "../../../../../src/features/security/model/securityText.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso)

const passkey = (changes: Partial<Passkey>) =>
  new Passkey({
    id: "passkey_01jdzm3q8gfr9ab6t7c5h2kxyz" as PasskeyId,
    role: "owner",
    status: "active",
    label: "iCloud Keychain on Mac",
    synced: true,
    current: false,
    createdAt: at("2026-11-24T10:00:00Z"),
    lastUsedAt: null,
    ...changes
  })

const KEY = new RecoveryKey({
  id: "recoverykey_01jdzm3q8gfr9ab6t7c5h2kxyz" as RecoveryKeyId,
  label: "YubiKey",
  status: "active",
  createdAt: at("2026-11-25T10:00:00Z")
})

const request = (changes: Partial<RecoveryRequest>) =>
  new RecoveryRequest({
    id: "recovery_01jdzm3q8gfr9ab6t7c5h2kxyz" as RecoveryRequestId,
    status: "waiting",
    newPasskey: "Passkey on Android",
    requestedAt: at("2026-11-27T10:00:00Z"),
    executableAt: at("2026-11-29T10:00:00Z"),
    cancelledAt: null,
    cancelledFrom: null,
    executedAt: null,
    ...changes
  })

describe("passkeyDescription", () => {
  it.each(
    [
      { name: "synced, never used", changes: {}, expected: "Synced to your other devices, added 24 Nov 2026" },
      {
        name: "on one device, used",
        changes: { synced: false, lastUsedAt: at("2026-11-26T08:00:00Z") },
        expected: "On one device only, added 24 Nov 2026, last used 26 Nov 2026"
      },
      { name: "being added", changes: { status: "pending" }, expected: "Being added. Base takes it in a few seconds." },
      {
        name: "being removed",
        changes: { status: "removing" },
        expected: "Being removed. Base takes it in a few seconds."
      }
    ] as const
  )("$name", ({ changes, expected }) => {
    assert.strictEqual(passkeyDescription(passkey(changes), "UTC"), expected)
  })
})

describe("deviceDescription", () => {
  const device = (name: string | null) =>
    new Device({
      id: "session_01jdzm3q8gfr9ab6t7c5h2kxyz" as SessionId,
      device: "Chrome on Mac",
      passkey: name,
      current: false,
      signedInAt: at("2026-11-26T08:00:00Z"),
      lastSeenAt: at("2026-11-27T09:30:00Z")
    })

  it("with the passkey it signed in with", () => {
    assert.strictEqual(
      deviceDescription(device("iCloud Keychain on Mac"), "UTC"),
      "Signed in with iCloud Keychain on Mac, last seen Fri 27 Nov, 09:30"
    )
  })

  it("without one", () => {
    assert.strictEqual(deviceDescription(device(null), "UTC"), "Signed in, last seen Fri 27 Nov, 09:30")
  })
})

describe("recoveryText", () => {
  const now = at("2026-11-28T00:00:00Z")

  it.each([
    {
      name: "no recovery key",
      recovery: { key: null, request: null },
      expected: {
        title: "No recovery key yet",
        description: "Keep one on another device or a hardware key. If it ever asks to recover your account, you " +
          "have 48 hours to cancel.",
        cancellable: false,
        cancelled: null
      }
    },
    {
      name: "a recovery key ready",
      recovery: { key: KEY, request: null },
      expected: {
        title: "YubiKey",
        description: "Ready since 25 Nov 2026. It can replace your passkeys 48 hours after it asks, and you're told " +
          "on every channel so you can cancel.",
        cancellable: false,
        cancelled: null
      }
    },
    {
      name: "a recovery waiting: cancellable, with how long is left",
      recovery: { key: KEY, request: request({}) },
      expected: {
        title: "Someone asked to recover your account",
        description: "Your recovery key asked on Fri 27 Nov to replace your passkeys with Passkey on Android. It can " +
          "go through on Sun 29 Nov, 10:00, in 34 h. Cancel it if this wasn't you.",
        cancellable: true,
        cancelled: null
      }
    },
    {
      name: "a recovery past its wait: it can go through now",
      recovery: { key: KEY, request: request({ executableAt: at("2026-11-27T23:00:00Z") }) },
      expected: {
        title: "Someone can recover your account now",
        description: "Your recovery key asked on Fri 27 Nov to replace your passkeys with Passkey on Android. Its 48 " +
          "hours are up, so it can go through now. Cancel it if this wasn't you.",
        cancellable: true,
        cancelled: null
      }
    },
    {
      name: "a recovery cancelled from Telegram: the key, and the cancel",
      recovery: {
        key: KEY,
        request: request({ status: "cancelled", cancelledAt: at("2026-11-27T12:30:00Z"), cancelledFrom: "telegram" })
      },
      expected: {
        title: "YubiKey",
        description: "Ready since 25 Nov 2026. It can replace your passkeys 48 hours after it asks, and you're told " +
          "on every channel so you can cancel.",
        cancellable: false,
        cancelled: "A recovery asked for on Fri 27 Nov was cancelled from Telegram on Fri 27 Nov, 12:30."
      }
    },
    {
      name: "the key being locked",
      recovery: { key: new RecoveryKey({ ...KEY, status: "locking" }), request: null },
      expected: {
        title: "Locking your recovery key",
        description: "It's ready once Base takes it.",
        cancellable: false,
        cancelled: null
      }
    }
  ])("$name", ({ expected, recovery }) => {
    assert.deepStrictEqual(recoveryText(new AccountRecovery(recovery), now, "UTC"), expected)
  })
})

describe("changeProblem", () => {
  it.each([
    {
      name: "the last passkey",
      error: new Conflict({ reason: "lastPasskey" }),
      expected: "This is the account's only passkey. Add another one before you remove it."
    },
    {
      name: "a passkey that isn't the account's",
      error: new SignatureRejected({ reason: "unknownPasskey" }),
      expected: "That passkey doesn't sign for this account. Use one of its passkeys."
    },
    {
      name: "Base not answering",
      error: new Unavailable({ dependency: "chain", retryAfterSeconds: null }),
      expected: "We couldn't reach Base just now. Nothing changed, so try again in a moment."
    },
    {
      name: "Face ID cancelled",
      error: new Error("NotAllowedError"),
      expected: "Face ID didn't finish, or the request couldn't be sent. Nothing changed."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(changeProblem(error), expected)
  })
})
