// The mock API's recovery, from both sides: the owner sets up or removes the recovery key (signed, then locked a few
// seconds later) and cancels a recovery; the person recovering signs in with that key, asks for the recovery, waits
// out the 48 hours, makes it, and is signed in with the new passkey.
import { Passkey } from "@bluechip/domain/Account"
import { BluechipApi } from "@bluechip/domain/Api"
import { Conflict, NotFound, SignatureRejected } from "@bluechip/domain/Errors"
import type { PasskeyId, RecoveryKeyId, RecoveryRequestId, SigningRequestId } from "@bluechip/domain/Ids"
import { notificationOfRecovery, notificationOfRecoveryKey } from "@bluechip/domain/notifications/SecurityDrafts"
import {
  AccountRecovery,
  isDue,
  isOpen,
  Recovering,
  RECOVERY_DELAY_HOURS,
  RecoveryKey,
  RecoveryKeyChange,
  RecoveryRequest,
  RecoverySigning
} from "@bluechip/domain/recovery/Recovery"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import type { AccountSlice } from "../../world/account.ts"
import { accountChanged, cancelRecovery, nextNumber, notify, record } from "../../world/account/changes.ts"
import { ACCOUNT_ADDRESS } from "../../world/cast.ts"
import { previewId } from "../../world/ids.ts"
import { Preview } from "../Preview.ts"
import { meOf } from "./account.ts"
import {
  authenticationCeremony,
  authenticationOptions,
  changeNow,
  expiresSoon,
  landLater,
  registrationCeremony
} from "./ceremonies.ts"

const accountRecoveryOf = (account: AccountSlice) =>
  new AccountRecovery({ key: account.recoveryKey, request: account.recovery })

const recoveringOf = (account: AccountSlice) =>
  new Recovering({ account: ACCOUNT_ADDRESS as Recovering["account"], request: account.recovery })

const withRequest = (account: AccountSlice, change: Partial<RecoveryRequest>) => {
  account.recovery = new RecoveryRequest({ ...account.recovery!, ...change })
  return account.recovery
}

const AccountRecoveryHandlers = HttpApiBuilder.group(
  BluechipApi,
  "accountRecovery",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      get: () => Effect.sync(() => accountRecoveryOf(preview.world.account)),
      keyOptions: () => Effect.sync(() => registrationCeremony(preview.world, { securityKey: true })),

      setUp: Effect.fn(function*({ payload }) {
        const world = preview.world
        if (world.account.recoveryKey !== null) return yield* new Conflict({ reason: "recoveryKeyExists" })

        const key = new RecoveryKey({
          id: previewId("recoverykey", nextNumber(world.account)) as RecoveryKeyId,
          label: payload.credential.authenticatorAttachment === "platform" ?
            "Google Password Manager on Android" :
            "YubiKey 5 NFC",
          status: "locking",
          createdAt: DateTime.nowUnsafe()
        })
        const id = previewId("signing", nextNumber(world.account)) as SigningRequestId
        world.account.signing.set(id, { _tag: "SetUpKey", key })
        return new RecoveryKeyChange({
          id,
          options: authenticationOptions(world),
          action: "setup",
          key,
          deploysAccount: !world.account.deployed,
          expiresAt: expiresSoon()
        })
      }),

      removeKey: Effect.fn(function*() {
        const world = preview.world
        const key = world.account.recoveryKey
        if (key?.status !== "active") return yield* new Conflict({ reason: "noRecoveryKey" })

        const id = previewId("signing", nextNumber(world.account)) as SigningRequestId
        world.account.signing.set(id, { _tag: "RemoveKey" })
        return new RecoveryKeyChange({
          id,
          options: authenticationOptions(world),
          action: "remove",
          key: new RecoveryKey({ ...key, status: "removing" }),
          deploysAccount: !world.account.deployed,
          expiresAt: expiresSoon()
        })
      }),

      confirmKey: Effect.fn(function*({ params }) {
        const account = preview.world.account
        const signing = account.signing.get(params.id)
        if (signing?._tag !== "SetUpKey" && signing?._tag !== "RemoveKey") {
          return yield* new NotFound({ resource: "recoveryKeyChange", id: params.id })
        }
        if (signing._tag === "SetUpKey" && account.recovery !== null && isOpen(account.recovery)) {
          return yield* new Conflict({ reason: "recoveryPending" })
        }
        if (signing._tag === "SetUpKey" && account.recoveryKey !== null) {
          return yield* new Conflict({ reason: "recoveryKeyExists" })
        }
        if (signing._tag === "RemoveKey" && account.recoveryKey?.status !== "active") {
          return yield* new Conflict({ reason: "noRecoveryKey" })
        }

        account.signing.delete(params.id)
        const key = signing._tag === "SetUpKey"
          ? signing.key
          : new RecoveryKey({ ...account.recoveryKey!, status: "removing" })
        preview.update((world) => {
          world.account.recoveryKey = key
        })
        preview.emit(accountChanged())

        yield* landLater(preview, (world) => {
          // The panel may have replaced the key meanwhile.
          if (world.account.recoveryKey?.id !== key.id) return []
          world.account.deployed = true
          const set = signing._tag === "SetUpKey"
          world.account.recoveryKey = set ? new RecoveryKey({ ...key, status: "active" }) : null
          // A recovery under way ends with its key.
          const ended = !set && world.account.recovery !== null && isOpen(world.account.recovery) ?
            cancelRecovery(world.account, "app") :
            []
          record(world.account, {
            actor: "owner",
            action: set ? "recovery.keySet" : "recovery.keyRemoved",
            subjectType: "recoveryKey",
            subjectId: key.id,
            data: { label: key.label }
          })
          return [...ended, accountChanged(), notify(world.account, notificationOfRecoveryKey(key, set))]
        })
        return accountRecoveryOf(preview.world.account)
      }),

      cancel: Effect.fn(function*() {
        const request = preview.world.account.recovery
        if (request === null || !isOpen(request)) return yield* new Conflict({ reason: "noRecoveryRequest" })

        changeNow(preview, (world) => cancelRecovery(world.account, "app"))
        return accountRecoveryOf(preview.world.account)
      })
    })
  })
)

const RecoveryHandlers = HttpApiBuilder.group(
  BluechipApi,
  "recovery",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      options: () => Effect.sync(() => authenticationCeremony(preview.world)),
      // Any passkey is the recovery key while the account has one ready; without one, none is.
      signIn: Effect.fn(function*() {
        const account = preview.world.account
        if (account.recoveryKey?.status !== "active") return yield* new SignatureRejected({ reason: "unknownPasskey" })

        preview.update((world) => {
          record(world.account, {
            actor: "owner",
            action: "recovery.signedIn",
            subjectType: "passkey",
            subjectId: account.recoveryKey!.id,
            data: {}
          })
        })
        return recoveringOf(account)
      })
    })
  })
)

const RecoveringHandlers = HttpApiBuilder.group(
  BluechipApi,
  "recovering",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      get: () => Effect.sync(() => recoveringOf(preview.world.account)),
      passkeyOptions: () => Effect.sync(() => registrationCeremony(preview.world)),

      request: Effect.fn(function*() {
        const world = preview.world
        if (world.account.recoveryKey?.status !== "active") return yield* new Conflict({ reason: "noRecoveryKey" })
        if (world.account.recovery !== null && isOpen(world.account.recovery)) {
          return yield* new Conflict({ reason: "recoveryPending" })
        }

        const id = previewId("recovery", nextNumber(world.account)) as RecoveryRequestId
        world.account.signing.set(id, { _tag: "AskRecovery", id, newPasskey: "Chrome on this device" })
        return new RecoverySigning({
          id,
          options: authenticationOptions(world),
          action: "request",
          expiresAt: expiresSoon()
        })
      }),

      execute: Effect.fn(function*() {
        const world = preview.world
        const request = world.account.recovery
        if (request?.status !== "waiting") return yield* new Conflict({ reason: "noRecoveryRequest" })
        if (!isDue(request, DateTime.nowUnsafe())) return yield* new Conflict({ reason: "recoveryNotDue" })

        world.account.signing.set(request.id, { _tag: "MakeRecovery" })
        return new RecoverySigning({
          id: request.id,
          options: authenticationOptions(world),
          action: "execute",
          expiresAt: expiresSoon()
        })
      }),

      confirm: Effect.fn(function*({ params }) {
        const account = preview.world.account
        const signing = account.signing.get(params.id)
        if (signing?._tag !== "AskRecovery" && signing?._tag !== "MakeRecovery") {
          return yield* new NotFound({ resource: "recovery", id: params.id })
        }
        account.signing.delete(params.id)

        if (signing._tag === "AskRecovery") {
          const now = DateTime.nowUnsafe()
          preview.update((world) => {
            world.account.recovery = new RecoveryRequest({
              id: signing.id,
              status: "requesting",
              newPasskey: signing.newPasskey,
              requestedAt: now,
              executableAt: null,
              cancelledAt: null,
              cancelledFrom: null,
              executedAt: null
            })
          })
          preview.emit(accountChanged())
          yield* landLater(preview, (world) => {
            if (world.account.recovery?.id !== signing.id) return []
            const request = withRequest(world.account, {
              status: "waiting",
              executableAt: DateTime.add(now, { hours: RECOVERY_DELAY_HOURS })
            })
            record(world.account, {
              actor: "system",
              action: "recovery.requested",
              subjectType: "recovery",
              subjectId: request.id,
              data: {}
            })
            return [accountChanged(), notify(world.account, notificationOfRecovery(request, { _tag: "Requested" }))]
          })
          return recoveringOf(preview.world.account)
        }

        preview.update((world) => {
          withRequest(world.account, { status: "executing" })
        })
        preview.emit(accountChanged())
        yield* landLater(preview, (world) => {
          if (world.account.recovery?.status !== "executing") return []
          const request = withRequest(world.account, { status: "completed", executedAt: DateTime.nowUnsafe() })
          // The new passkey, made on this device, replaces every owner; the other devices are signed out.
          world.account.passkeys = [
            new Passkey({
              id: previewId("passkey", nextNumber(world.account)) as PasskeyId,
              role: "owner",
              status: "active",
              label: request.newPasskey,
              synced: true,
              current: true,
              createdAt: request.requestedAt,
              lastUsedAt: DateTime.nowUnsafe()
            })
          ]
          world.account.devices = world.account.devices.filter((device) => device.current)
          record(world.account, {
            actor: "system",
            action: "recovery.completed",
            subjectType: "recovery",
            subjectId: request.id,
            data: {}
          })
          return [accountChanged(), notify(world.account, notificationOfRecovery(request, { _tag: "Completed" }))]
        })
        return recoveringOf(preview.world.account)
      }),

      signInRecovered: Effect.fn(function*() {
        if (preview.world.account.recovery?.status !== "completed") {
          return yield* new Conflict({ reason: "noRecoveryRequest" })
        }
        if (preview.settings.live === "signedOut") preview.setLive("connected")
        return meOf(preview.world)
      })
    })
  })
)

export const RecoveryGroupsLive = Layer.mergeAll(AccountRecoveryHandlers, RecoveryHandlers, RecoveringHandlers)
