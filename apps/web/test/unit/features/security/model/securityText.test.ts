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
      { name: "synced, never used", changes: {}, expected: "Synced to your other devices, added Tue 24 Nov" },
      {
        name: "on one device, used",
        changes: { synced: false, lastUsedAt: at("2026-11-26T08:00:00Z") },
        expected: "On one device only, added Tue 24 Nov, last used Thu 26 Nov"
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
  it.each([
    {
      name: "no recovery key",
      recovery: { key: null, request: null },
      expected: {
        title: "No recovery key yet",
        description: "If you lose every passkey, a recovery key on another device or a hardware key gets you back " +
          "in, 48 hours after it asks. You can cancel during the wait.",
        cancellable: false
      }
    },
    {
      name: "a recovery key ready",
      recovery: { key: KEY, request: null },
      expected: {
        title: "YubiKey",
        description: "Ready since Wed 25 Nov. It can replace your passkeys 48 hours after it asks, and you're told " +
          "on every channel so you can cancel.",
        cancellable: false
      }
    },
    {
      name: "a recovery waiting: cancellable",
      recovery: { key: KEY, request: request({}) },
      expected: {
        title: "Someone asked to recover your account",
        description: "Your recovery key asked on Fri 27 Nov to replace your passkeys with Passkey on Android. It can " +
          "go through from Sun 29 Nov, 10:00. Cancel it if this wasn't you.",
        cancellable: true
      }
    },
    {
      name: "a cancelled recovery: the key as it is",
      recovery: { key: KEY, request: request({ status: "cancelled" }) },
      expected: {
        title: "YubiKey",
        description: "Ready since Wed 25 Nov. It can replace your passkeys 48 hours after it asks, and you're told " +
          "on every channel so you can cancel.",
        cancellable: false
      }
    },
    {
      name: "the key being locked",
      recovery: { key: new RecoveryKey({ ...KEY, status: "locking" }), request: null },
      expected: {
        title: "Locking your recovery key",
        description: "It's ready once Base takes it.",
        cancellable: false
      }
    }
  ])("$name", ({ expected, recovery }) => {
    assert.deepStrictEqual(recoveryText(new AccountRecovery(recovery), "UTC"), expected)
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
      expected: "Face ID was cancelled or the request couldn't be sent. Nothing changed."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(changeProblem(error), expected)
  })
})
