import type { Call } from "@bluechip/chain/account/Owners"
import {
  cancelCall,
  RECOVERY_DELAY_SECONDS,
  recoveryCalls,
  requestCall,
  requestedAt
} from "@bluechip/chain/account/Recovery"
import { ChainClient } from "@bluechip/chain/ChainClient"
import type { RecoveringUser } from "@bluechip/domain/Auth"
import { Conflict, NotFound, SignatureRejected, type Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address, PasskeyId, RecoveryRequestId, UserId } from "@bluechip/domain/Ids"
import { notificationOfRecovery } from "@bluechip/domain/notifications/SecurityDrafts"
import { type CancelledFrom, isDue, Recovering, RecoverySigning } from "@bluechip/domain/recovery/Recovery"
import { type AuthenticationCredential, Ceremony, type RegistrationCredential } from "@bluechip/domain/WebAuthn"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { AppConfig } from "../../config/AppConfig.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { decryptKey } from "../agents/Keys.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { Challenges } from "../auth/Challenges.ts"
import { passkeyLabel } from "../auth/PasskeyLabel.ts"
import { Sessions } from "../auth/Sessions.ts"
import { deviceOf } from "../auth/UserAgents.ts"
import { WebAuthn } from "../auth/WebAuthn.ts"
import { Notifications } from "../notifications/Notifications.ts"
import { challengeOf, OwnerOperations } from "../signing/OwnerOperations.ts"
import { RecoveryOperations } from "./RecoveryOperations.ts"
import { type RecoveryRequestRow, RecoveryStore, type StoredKey } from "./RecoveryStore.ts"

// SimpleWebAuthn leaves unset options as `undefined`, which is not JSON; send them as the browser will read them.
const toJson = (options: object): Record<string, unknown> => JSON.parse(JSON.stringify(options))

// Long enough to read what is asked and touch the recovery passkey; short enough that gas prices still hold.
const SIGNING_WINDOW = { minutes: 2 }

/**
 * Recoveries of accounts: signing in with the recovery passkey, asking for a recovery (this device's new passkey
 * replaces the account's owners), cancelling one during its 48-hour wait (bluechip's guard key sends the cancel, so it
 * needs no Face ID), and making it once due. Requests and recoveries are recovery passkey operations, prepared here and
 * signed in the browser; each is followed to its receipt (and again after a restart), told on every channel and
 * audited.
 */
export class Recoveries extends Context.Service<Recoveries, {
  /** The WebAuthn options for signing in with a recovery passkey. */
  readonly signInOptions: Effect.Effect<Ceremony>
  /** Checks the recovery passkey's sign-in and starts a recovery session; returns its token for the cookie. */
  readonly signIn: (input: {
    readonly challengeId: string
    readonly credential: typeof AuthenticationCredential.Type
    readonly userAgent: string | undefined
  }) => Effect.Effect<
    { readonly token: string; readonly expiresAt: DateTime.Utc; readonly recovering: Recovering },
    SignatureRejected
  >
  readonly get: (user: RecoveringUser["Service"]) => Effect.Effect<Recovering>
  /** The WebAuthn options for creating this device's new passkey. */
  readonly passkeyOptions: (user: RecoveringUser["Service"]) => Effect.Effect<Ceremony>
  /** Checks the new passkey and prepares the request for the recovery passkey to sign. */
  readonly request: (user: RecoveringUser["Service"], input: {
    readonly challengeId: string
    readonly credential: typeof RegistrationCredential.Type
    readonly userAgent: string | undefined
  }) => Effect.Effect<RecoverySigning, SignatureRejected | Conflict | Unavailable>
  /** Prepares the recovery itself, once due, for the recovery passkey to sign. */
  readonly execute: (user: RecoveringUser["Service"]) => Effect.Effect<RecoverySigning, Conflict | Unavailable>
  /** Sends a prepared step the recovery passkey signed. */
  readonly confirm: (
    user: RecoveringUser["Service"],
    id: RecoveryRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<Recovering, NotFound | Conflict | SignatureRejected | Unavailable>
  /** Cancels the recovery waiting out its delay, with the guard key; waits until the cancel landed. */
  readonly cancel: (userId: UserId, from: CancelledFrom) => Effect.Effect<RecoveryRequestRow, Conflict | Unavailable>
  /** Marks an open recovery cancelled without sending anything (its recovery key's sessions were revoked). */
  readonly abandon: (userId: UserId) => Effect.Effect<void>
}>()("@bluechip/server/Recoveries") {
  static readonly layer = Layer.effect(
    Recoveries,
    Effect.gen(function*() {
      const config = yield* AppConfig
      const chain = yield* ChainClient
      const accounts = yield* Accounts
      const challenges = yield* Challenges
      const webAuthn = yield* WebAuthn
      const sessions = yield* Sessions
      const owners = yield* OwnerOperations
      const operations = yield* RecoveryOperations
      const store = yield* RecoveryStore
      const notifications = yield* Notifications
      const audit = yield* AuditLog
      const live = yield* LiveEvents
      const scope = yield* Effect.scope

      const changed = (userId: string) => live.publish(LiveEvent.cases.AccountChanged.make({}), userId as UserId)

      const recordAudit = (row: RecoveryRequestRow, action: string, actor: "owner" | "system", data: object = {}) =>
        audit.record({
          userId: row.userId as UserId,
          actor,
          action: `recovery.${action}`,
          subjectType: "recovery",
          subjectId: row.id,
          data
        })

      // The recovery passkey's session and guard, as locked on the account.
      const grantsOf = Effect.fnUntraced(function*(stored: StoredKey) {
        const built = operations.sessions({
          id: stored.key.id,
          recoveryKey: stored.passkey.publicKey as Hex,
          guard: stored.key.guardAddress as Hex
        })
        const signer = yield* accounts.ownerPasskey(stored.key.userId as UserId)
        return {
          recovery: yield* operations.grant(signer, built.recovery),
          guard: yield* operations.grant(signer, built.guard)
        }
      })

      const requestOf = Effect.fnUntraced(function*(userId: UserId) {
        const row = yield* store.latest(userId)
        return Option.isNone(row) ? null : yield* store.toRequest(row.value)
      })

      const get = Effect.fn("Recoveries.get")(function*(user: RecoveringUser["Service"]) {
        return new Recovering({ account: user.account, request: yield* requestOf(user.id) })
      })

      // The user's recovery key in force, which must be the passkey signed in.
      const activeKey = Effect.fnUntraced(function*(user: RecoveringUser["Service"]) {
        const stored = yield* store.keyOf(user.id)
        if (Option.isNone(stored) || stored.value.key.status !== "active" || stored.value.passkey.id !== user.passkey) {
          return yield* new Conflict({ reason: "noRecoveryKey" })
        }
        return stored.value
      })

      const settle = Effect.fnUntraced(function*(row: RecoveryRequestRow) {
        const userId = row.userId as UserId
        const signer = yield* accounts.ownerPasskey(userId)
        const outcome = yield* owners.wait(signer, row.userOpHash as Hex).pipe(Effect.result)
        const now = yield* DateTime.now

        if (row.status === "requesting") {
          if (outcome._tag === "Failure" || !outcome.success.success) {
            yield* store.saveRequest(row.id, { status: "failed", userOpHash: null })
            yield* accounts.savePasskey(row.newPasskeyId, { status: "removed", removedAt: now })
            return yield* changed(userId)
          }
          // The delay counts from the block that recorded the request, as the policy reads it.
          const at = yield* requestedAt(signer.account as Hex, row.calls[0] as Call).pipe(
            Effect.provideService(ChainClient, chain)
          )
          const executableAt = DateTime.add(
            at === undefined ? now : DateTime.makeUnsafe(at * 1000),
            { seconds: RECOVERY_DELAY_SECONDS }
          )
          const saved = yield* store.saveRequest(row.id, { status: "waiting", executableAt, userOpHash: null })
          yield* recordAudit(saved, "requested", "owner", { executableAt: DateTime.formatIso(executableAt) })
          yield* notifications.add(userId, notificationOfRecovery(saved, { _tag: "Requested" }))
          return yield* changed(userId)
        }

        // The recovery itself. With no receipt it never went through: it waits again. One that reverted used its
        // request, so it can't be made again.
        if (outcome._tag === "Failure") {
          yield* store.saveRequest(row.id, { status: "waiting", userOpHash: null })
          return yield* changed(userId)
        }
        if (!outcome.success.success) {
          yield* store.saveRequest(row.id, { status: "failed", userOpHash: null })
          return yield* changed(userId)
        }
        for (const old of yield* accounts.owners(userId)) {
          yield* accounts.savePasskey(old.id, { status: "removed", removedAt: now })
        }
        yield* accounts.savePasskey(row.newPasskeyId, { status: "active" })
        const saved = yield* store.saveRequest(row.id, { status: "completed", executedAt: now, userOpHash: null })
        yield* sessions.signOutAll(userId)
        yield* recordAudit(saved, "completed", "owner")
        yield* notifications.add(userId, notificationOfRecovery(saved, { _tag: "Completed" }))
        yield* changed(userId)
      })

      const track = (row: RecoveryRequestRow) =>
        settle(row).pipe(
          Effect.catchCause((cause) => Effect.logWarning(`Recovery ${row.id} settle failed`, cause)),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      for (const row of (yield* store.inFlight).requests) yield* track(row)

      const signInOptions = Effect.gen(function*() {
        const options = yield* webAuthn.authenticationOptions
        const challengeId = yield* challenges.issue("recovery", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      })

      const signIn = Effect.fn("Recoveries.signIn")(function*(input: {
        readonly challengeId: string
        readonly credential: typeof AuthenticationCredential.Type
        readonly userAgent: string | undefined
      }) {
        const challenge = yield* challenges.consume("recovery", input.challengeId)
        const found = yield* accounts.findPasskey(input.credential.id)
        if (Option.isNone(found) || found.value.role !== "recovery" || found.value.status !== "active") {
          return yield* new SignatureRejected({ reason: "unknownPasskey" })
        }
        const passkey = found.value
        const counter = yield* webAuthn.verifyAuthentication(input.credential, challenge, passkey)
        yield* accounts.recordPasskeyUse(passkey.id, counter)

        const userId = passkey.userId as UserId
        const session = yield* sessions.create({
          userId,
          passkeyId: passkey.id as PasskeyId,
          device: deviceOf(input.userAgent),
          scope: "recovery"
        })
        yield* audit.record({
          userId,
          actor: "owner",
          action: "recovery.signedIn",
          subjectType: "passkey",
          subjectId: passkey.id
        })
        const { account } = yield* accounts.ownerPasskey(userId)
        return {
          token: session.token,
          expiresAt: session.expiresAt,
          recovering: new Recovering({ account: account as Address, request: yield* requestOf(userId) })
        }
      })

      const passkeyOptions = Effect.fn("Recoveries.passkeyOptions")(function*(user: RecoveringUser["Service"]) {
        const known = yield* accounts.owners(user.id)
        const options = yield* webAuthn.registrationOptions(undefined, { exclude: known })
        const challengeId = yield* challenges.issue("recovery", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      })

      // Stores the step prepared for the recovery passkey and the WebAuthn request that signs it.
      const prepareSigning = Effect.fnUntraced(function*(
        row: RecoveryRequestRow,
        stored: StoredKey,
        action: "request" | "execute",
        calls: ReadonlyArray<Call>
      ) {
        const { recovery } = yield* grantsOf(stored)
        const prepared = yield* operations.prepare(recovery, stored.passkey, calls)
        const expiresAt = DateTime.add(yield* DateTime.now, SIGNING_WINDOW)
        yield* store.saveRequest(row.id, {
          signing: action,
          userOperation: prepared.userOperation,
          hash: prepared.challenge,
          signingExpiresAt: expiresAt
        })
        return new RecoverySigning({
          id: row.id as RecoveryRequestId,
          action,
          expiresAt,
          options: {
            challenge: challengeOf(prepared.challenge),
            rpId: config.rpId,
            allowCredentials: [{
              id: stored.passkey.credentialId,
              type: "public-key",
              transports: stored.passkey.transports
            }],
            userVerification: "required",
            timeout: 120_000
          }
        })
      })

      const request = Effect.fn("Recoveries.request")(function*(user: RecoveringUser["Service"], input: {
        readonly challengeId: string
        readonly credential: typeof RegistrationCredential.Type
        readonly userAgent: string | undefined
      }) {
        const stored = yield* activeKey(user)
        const latest = yield* store.latest(user.id)
        const open = Option.isSome(latest) &&
          ["requesting", "waiting", "executing"].includes(latest.value.status)
        if (open) return yield* new Conflict({ reason: "recoveryPending" })

        const challenge = yield* challenges.consume("recovery", input.challengeId)
        const passkey = yield* webAuthn.verifyRegistration(input.credential, challenge)
        if (Option.isSome(yield* accounts.findPasskey(passkey.credentialId))) {
          return yield* new SignatureRejected({ reason: "invalid" })
        }
        const newOwner = yield* accounts.insertPasskey(user.id, {
          passkey,
          label: passkeyLabel({ aaguid: passkey.aaguid, userAgent: input.userAgent }),
          role: "owner"
        })
        const calls = recoveryCalls({
          newOwner: passkey.publicKey,
          oldOwners: (yield* accounts.owners(user.id)).map((owner) => owner.publicKey as Hex)
        })
        const row = yield* store.insertRequest({
          userId: user.id,
          recoveryKeyId: stored.key.id,
          newPasskeyId: newOwner.id,
          calls
        })
        return yield* prepareSigning(row, stored, "request", [requestCall(calls)])
      })

      const execute = Effect.fn("Recoveries.execute")(function*(user: RecoveringUser["Service"]) {
        const stored = yield* activeKey(user)
        const latest = yield* store.latest(user.id)
        if (Option.isNone(latest) || latest.value.status !== "waiting") {
          return yield* new Conflict({ reason: "noRecoveryRequest" })
        }
        if (!isDue({ status: "waiting", executableAt: latest.value.executableAt }, yield* DateTime.now)) {
          return yield* new Conflict({ reason: "recoveryNotDue" })
        }
        return yield* prepareSigning(latest.value, stored, "execute", latest.value.calls as ReadonlyArray<Call>)
      })

      const confirm = Effect.fn("Recoveries.confirm")(function*(
        user: RecoveringUser["Service"],
        id: RecoveryRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const found = yield* store.request(id)
        if (Option.isNone(found) || found.value.userId !== user.id) {
          return yield* new NotFound({ resource: "recovery", id })
        }
        const row = found.value
        const now = yield* DateTime.now
        if (
          row.signing === null || row.hash === null || row.userOperation === null || row.signingExpiresAt === null ||
          DateTime.isGreaterThan(now, row.signingExpiresAt)
        ) {
          return yield* new SignatureRejected({ reason: "challenge" })
        }
        const stored = yield* activeKey(user)
        if (credential.id !== stored.passkey.credentialId) {
          return yield* new SignatureRejected({ reason: "unknownPasskey" })
        }
        const counter = yield* webAuthn.verifyAuthentication(credential, challengeOf(row.hash as Hex), stored.passkey)
        yield* accounts.recordPasskeyUse(stored.passkey.id, counter)
        // Used once: a replayed signature finds nothing to send.
        yield* store.saveRequest(row.id, { signing: null, userOperation: null, hash: null, signingExpiresAt: null })

        const { recovery } = yield* grantsOf(stored)
        const userOpHash = yield* operations.send(recovery, stored.passkey, row.userOperation, credential)
        const saved = yield* store.saveRequest(
          row.id,
          row.signing === "request" ?
            { status: "requesting", userOpHash, requestedAt: now } :
            { status: "executing", userOpHash }
        )
        yield* changed(user.id)
        yield* track(saved)
        return yield* get(user)
      })

      const cancel = Effect.fn("Recoveries.cancel")(function*(userId: UserId, from: CancelledFrom) {
        const latest = yield* store.latest(userId)
        if (Option.isNone(latest) || latest.value.status !== "waiting") {
          return yield* new Conflict({ reason: "noRecoveryRequest" })
        }
        const row = latest.value
        const stored = yield* store.key(row.recoveryKeyId)
        const { guard } = yield* grantsOf(stored)
        const key = privateKeyToAccount(decryptKey(config.agentKeyEncryptionKey, stored.key.id, stored.key.guardKey))

        const hash = yield* operations.sendAsGuard(guard, key, [cancelCall(row.calls as ReadonlyArray<Call>)])
        const receipt = yield* owners.wait(yield* accounts.ownerPasskey(userId), hash)
        if (!receipt.success) return yield* new Conflict({ reason: "noRecoveryRequest" })

        const now = yield* DateTime.now
        const saved = yield* store.saveRequest(row.id, { status: "cancelled", cancelledAt: now, cancelledFrom: from })
        yield* accounts.savePasskey(row.newPasskeyId, { status: "removed", removedAt: now })
        yield* recordAudit(saved, "cancelled", "owner", { from })
        yield* notifications.add(userId, notificationOfRecovery(saved, { _tag: "Cancelled", from }))
        yield* changed(userId)
        return saved
      })

      const abandon = Effect.fn("Recoveries.abandon")(function*(userId: UserId) {
        const latest = yield* store.latest(userId)
        if (Option.isNone(latest) || latest.value.status !== "waiting") return
        const now = yield* DateTime.now
        const saved = yield* store.saveRequest(latest.value.id, {
          status: "cancelled",
          cancelledAt: now,
          cancelledFrom: "app"
        })
        yield* accounts.savePasskey(saved.newPasskeyId, { status: "removed", removedAt: now })
        yield* recordAudit(saved, "cancelled", "owner", { from: "app", keyRemoved: true })
        yield* notifications.add(userId, notificationOfRecovery(saved, { _tag: "Cancelled", from: "app" }))
      })

      return Recoveries.of({
        signInOptions,
        signIn,
        get,
        passkeyOptions,
        request,
        execute,
        confirm,
        cancel,
        abandon
      })
    })
  )
}
