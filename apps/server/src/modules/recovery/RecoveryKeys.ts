import { setupCalls } from "@bluechip/chain/account/Recovery"
import { revokeCalls } from "@bluechip/chain/policies/Session"
import { Conflict, type NotFound, SignatureRejected, type Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { RecoveryKeyId, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { notificationOfRecoveryKey } from "@bluechip/domain/notifications/SecurityDrafts"
import { AccountRecovery, RecoveryKeyChange } from "@bluechip/domain/recovery/Recovery"
import { type AuthenticationCredential, Ceremony, type RegistrationCredential } from "@bluechip/domain/WebAuthn"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { AppConfig } from "../../config/AppConfig.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { count, Recovery as RecoveryMetric } from "../../platform/telemetry/Metrics.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { encryptKey } from "../agents/Keys.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { Challenges } from "../auth/Challenges.ts"
import { passkeyLabel } from "../auth/PasskeyLabel.ts"
import { WebAuthn } from "../auth/WebAuthn.ts"
import { Notifications } from "../notifications/Notifications.ts"
import { OwnerOperations } from "../signing/OwnerOperations.ts"
import { type Owner, type SigningRequestRow, SigningRequests } from "../signing/SigningRequests.ts"
import { Recoveries } from "./Recoveries.ts"
import { RecoveryOperations } from "./RecoveryOperations.ts"
import { type RecoveryKeyRow, RecoveryStore, type StoredKey } from "./RecoveryStore.ts"

// SimpleWebAuthn leaves unset options as `undefined`, which is not JSON; send them as the browser will read them.
const toJson = (options: object): Record<string, unknown> => JSON.parse(JSON.stringify(options))

/**
 * The account's recovery passkey, for its owner: setting it up (the recovery passkey's session and bluechip's guard,
 * locked in one owner operation) and removing it (both revoked in one), each signed with Face ID; and the account's
 * recovery as the owner sees it. Operations are followed to their receipt in the background.
 */
export class RecoveryKeys extends Context.Service<RecoveryKeys, {
  readonly get: (owner: Owner) => Effect.Effect<AccountRecovery>
  /** The WebAuthn options for creating the recovery passkey, on another device or a hardware key. */
  readonly options: (owner: Owner) => Effect.Effect<Ceremony>
  readonly setUp: (owner: Owner, input: {
    readonly requestId: string
    readonly challengeId: string
    readonly credential: typeof RegistrationCredential.Type
    readonly userAgent: string | undefined
  }) => Effect.Effect<RecoveryKeyChange, SignatureRejected | Conflict | Unavailable>
  readonly remove: (owner: Owner, requestId: string) => Effect.Effect<RecoveryKeyChange, Conflict | Unavailable>
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<AccountRecovery, NotFound | Conflict | SignatureRejected | Unavailable>
}>()("@bluechip/server/RecoveryKeys") {
  static readonly layer = Layer.effect(
    RecoveryKeys,
    Effect.gen(function*() {
      const config = yield* AppConfig
      const accounts = yield* Accounts
      const challenges = yield* Challenges
      const webAuthn = yield* WebAuthn
      const signing = yield* SigningRequests
      const owners = yield* OwnerOperations
      const operations = yield* RecoveryOperations
      const recoveries = yield* Recoveries
      const store = yield* RecoveryStore
      const notifications = yield* Notifications
      const audit = yield* AuditLog
      const analytics = yield* Analytics
      const live = yield* LiveEvents
      const scope = yield* Effect.scope

      const changed = (userId: string) => live.publish(LiveEvent.cases.AccountChanged.make({}), userId as UserId)

      const sessionsOf = (stored: StoredKey) =>
        operations.sessions({
          id: stored.key.id,
          recoveryKey: stored.passkey.publicKey as Hex,
          guard: stored.key.guardAddress as Hex
        })

      const get = Effect.fn("RecoveryKeys.get")(function*(owner: Owner) {
        const stored = yield* store.keyOf(owner.id)
        const latest = yield* store.latest(owner.id)
        return new AccountRecovery({
          key: Option.isNone(stored) ? null : store.toKey(stored.value),
          request: Option.isNone(latest) ? null : yield* store.toRequest(latest.value)
        })
      })

      const toChange = Effect.fnUntraced(function*(request: SigningRequestRow, stored: StoredKey) {
        const action = request.payload["action"] as "setup" | "remove"
        return new RecoveryKeyChange({
          id: request.id as SigningRequestId,
          options: yield* signing.webAuthnOptions(request),
          action,
          // Shown as it will be once the operation is on its way.
          key: store.toKey({ ...stored, key: { ...stored.key, status: action === "setup" ? "locking" : "removing" } })!,
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      })

      const prepared = Effect.fnUntraced(function*(owner: Owner, requestId: string, action: "setup" | "remove") {
        const existing = yield* signing.findPrepared(owner, requestId, (payload) => payload["action"] === action)
        if (Option.isNone(existing)) return Option.none<RecoveryKeyChange>()
        const stored = yield* store.key(existing.value.payload["recoveryKeyId"]!)
        return Option.some(yield* toChange(existing.value, stored))
      })

      const settle = Effect.fnUntraced(function*(row: RecoveryKeyRow) {
        const userId = row.userId as UserId
        const outcome = yield* owners.wait(yield* accounts.ownerPasskey(userId), row.userOpHash as Hex, "recovery")
          .pipe(
            Effect.result
          )
        const landed = outcome._tag === "Success" && outcome.success.success
        const locking = row.status === "locking"
        const now = yield* DateTime.now

        if (!landed) {
          yield* store.saveKey(
            row.id,
            locking ? { status: "removed", removedAt: now, userOpHash: null } : {
              status: "active",
              userOpHash: null
            }
          )
          if (locking) yield* accounts.savePasskey(row.passkeyId, { status: "removed", removedAt: now })
          return yield* changed(userId)
        }

        yield* store.saveKey(
          row.id,
          locking ?
            { status: "active", lockedAt: now, userOpHash: null } :
            { status: "removed", removedAt: now, userOpHash: null }
        )
        const passkey = yield* accounts.savePasskey(
          row.passkeyId,
          locking ? { status: "active" } : { status: "removed", removedAt: now }
        )
        // A recovery under way can't be made without its key's session.
        if (!locking) yield* recoveries.abandon(userId)
        yield* audit.record({
          userId,
          actor: "owner",
          action: locking ? "recovery.keySet" : "recovery.keyRemoved",
          subjectType: "recoveryKey",
          subjectId: row.id,
          data: { label: passkey.label }
        })
        yield* count(RecoveryMetric, { change: locking ? "key_added" : "key_removed" })
        if (locking) {
          yield* analytics.capture(userId, { _tag: "recovery_key_added", by: "device" }, {
            id: row.id,
            at: now,
            set: { has_recovery_passkey: true }
          })
        } else {
          yield* analytics.identify(userId, { id: `${row.id}:removed`, at: now, set: { has_recovery_passkey: false } })
        }
        yield* notifications.add(userId, notificationOfRecoveryKey({ id: row.id, label: passkey.label }, locking))
        yield* changed(userId)
      })

      const track = (row: RecoveryKeyRow) =>
        settle(row).pipe(
          Effect.catchCause((cause) => Effect.logWarning(`Recovery key ${row.id} settle failed`, cause)),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      for (const row of (yield* store.inFlight).keys) yield* track(row)

      const options = Effect.fn("RecoveryKeys.options")(function*(owner: Owner) {
        const known = yield* accounts.owners(owner.id)
        const options = yield* webAuthn.registrationOptions("bluechip recovery", { exclude: known, securityKey: true })
        const challengeId = yield* challenges.issue("recovery", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      })

      const setUp = Effect.fn("RecoveryKeys.setUp")(function*(owner: Owner, input: {
        readonly requestId: string
        readonly challengeId: string
        readonly credential: typeof RegistrationCredential.Type
        readonly userAgent: string | undefined
      }) {
        const existing = yield* prepared(owner, input.requestId, "setup")
        if (Option.isSome(existing)) return existing.value
        if (Option.isSome(yield* store.keyOf(owner.id))) return yield* new Conflict({ reason: "recoveryKeyExists" })

        const challenge = yield* challenges.consume("recovery", input.challengeId)
        const passkey = yield* webAuthn.verifyRegistration(input.credential, challenge)
        if (Option.isSome(yield* accounts.findPasskey(passkey.credentialId))) {
          return yield* new SignatureRejected({ reason: "invalid" })
        }
        const row = yield* accounts.insertPasskey(owner.id, {
          passkey,
          label: passkeyLabel({ aaguid: passkey.aaguid, userAgent: input.userAgent }),
          role: "recovery"
        })
        const guardKey = generatePrivateKey()
        const key = yield* store.insertKey({
          userId: owner.id,
          passkeyId: row.id,
          guardAddress: privateKeyToAccount(guardKey).address,
          guardKey: (id: RecoveryKeyId) => encryptKey(config.agentKeyEncryptionKey, id, guardKey)
        })
        const stored = { key, passkey: row }
        const built = sessionsOf(stored)

        const request = yield* signing.create(owner, {
          requestId: input.requestId,
          kind: "recoveryKey",
          payload: { recoveryKeyId: key.id, action: "setup" },
          calls: setupCalls(built.recovery, built.guard)
        })
        return yield* toChange(request, stored)
      })

      const remove = Effect.fn("RecoveryKeys.remove")(function*(owner: Owner, requestId: string) {
        const existing = yield* prepared(owner, requestId, "remove")
        if (Option.isSome(existing)) return existing.value
        const found = yield* store.keyOf(owner.id)
        if (Option.isNone(found) || found.value.key.status !== "active") {
          return yield* new Conflict({ reason: "noRecoveryKey" })
        }

        const stored = found.value
        const built = sessionsOf(stored)
        const signer = yield* accounts.ownerPasskey(owner.id)
        const recovery = yield* operations.grant(signer, built.recovery)
        const guard = yield* operations.grant(signer, built.guard)
        const request = yield* signing.create(owner, {
          requestId,
          kind: "recoveryKey",
          payload: { recoveryKeyId: stored.key.id, action: "remove" },
          calls: [...revokeCalls(recovery), ...revokeCalls(guard)]
        })
        return yield* toChange(request, stored)
      })

      const confirm = Effect.fn("RecoveryKeys.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey: signer, request } = yield* signing.claim(owner, id, "recoveryKey", credential)
        const setup = request.payload["action"] === "setup"
        const stored = yield* store.key(request.payload["recoveryKeyId"]!)
        if (stored.key.status !== (setup ? "draft" : "active")) {
          return yield* new Conflict({ reason: "recoveryPending" })
        }
        if (setup && Option.isSome(yield* store.keyOf(owner.id))) {
          return yield* new Conflict({ reason: "recoveryKeyExists" })
        }

        const userOpHash = yield* owners.send(signer, request.userOperation, credential)
        const saved = yield* store.saveKey(stored.key.id, { status: setup ? "locking" : "removing", userOpHash })
        yield* changed(owner.id)
        yield* track(saved)
        return yield* get(owner)
      })

      return RecoveryKeys.of({ get, options, setUp, remove, confirm })
    })
  )
}
