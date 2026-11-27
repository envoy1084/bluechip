import { addOwnerCall, removeOwnerCall } from "@bluechip/chain/account/Owners"
import { PasskeyChange } from "@bluechip/domain/Account"
import { Conflict, NotFound, SignatureRejected, type Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { notificationOfPasskey } from "@bluechip/domain/notifications/SecurityDrafts"
import { type AuthenticationCredential, Ceremony, type RegistrationCredential } from "@bluechip/domain/WebAuthn"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { Hex } from "viem"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { count, Passkeys as PasskeysMetric } from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { Challenges } from "../auth/Challenges.ts"
import { passkeyLabel } from "../auth/PasskeyLabel.ts"
import { Sessions } from "../auth/Sessions.ts"
import { WebAuthn } from "../auth/WebAuthn.ts"
import { Notifications } from "../notifications/Notifications.ts"
import { OwnerOperations } from "../signing/OwnerOperations.ts"
import { type Owner, type SigningRequestRow, SigningRequests } from "../signing/SigningRequests.ts"
import { Accounts, type PasskeyRow, toPasskey } from "./Accounts.ts"

// SimpleWebAuthn leaves unset options as `undefined`, which is not JSON; send them as the browser will read them.
const toJson = (options: object): Record<string, unknown> => JSON.parse(JSON.stringify(options))

/**
 * The account's owner passkeys: adding one (a new passkey, made on this device or another, becomes an owner of the
 * account on Namera's `WebAuthnValidator`) and removing one, each one owner operation signed by any current owner.
 * The last owner can't be removed. Operations are followed to their receipt in the background (and again after a
 * restart); each change that lands is a security notification and an audit entry.
 */
export class Passkeys extends Context.Service<Passkeys, {
  /** The WebAuthn options for creating another passkey for the account. */
  readonly options: (owner: Owner) => Effect.Effect<Ceremony>
  /** Checks the new passkey and prepares the owner operation that adds it. */
  readonly add: (owner: Owner, input: {
    readonly requestId: string
    readonly challengeId: string
    readonly credential: typeof RegistrationCredential.Type
    readonly userAgent: string | undefined
  }) => Effect.Effect<PasskeyChange, SignatureRejected | Conflict | Unavailable>
  /** Prepares the owner operation that removes one of the account's owners. */
  readonly remove: (
    owner: Owner,
    id: string,
    requestId: string
  ) => Effect.Effect<PasskeyChange, NotFound | Conflict | Unavailable>
  /** Sends a prepared change the passkey signed. */
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<PasskeyChange["passkey"], NotFound | Conflict | SignatureRejected | Unavailable>
}>()("@bluechip/server/Passkeys") {
  static readonly layer = Layer.effect(
    Passkeys,
    Effect.gen(function*() {
      const accounts = yield* Accounts
      const analytics = yield* Analytics
      const challenges = yield* Challenges
      const webAuthn = yield* WebAuthn
      const signing = yield* SigningRequests
      const operations = yield* OwnerOperations
      const sessions = yield* Sessions
      const notifications = yield* Notifications
      const audit = yield* AuditLog
      const live = yield* LiveEvents
      const scope = yield* Effect.scope

      const changed = (userId: string) => live.publish(LiveEvent.cases.AccountChanged.make({}), userId as UserId)

      const toChange = Effect.fnUntraced(function*(request: SigningRequestRow, row: PasskeyRow) {
        return new PasskeyChange({
          id: request.id as SigningRequestId,
          options: yield* signing.webAuthnOptions(request),
          action: request.payload["action"] as "add" | "remove",
          passkey: toPasskey(row),
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      })

      const prepared = Effect.fnUntraced(function*(owner: Owner, requestId: string, action: "add" | "remove") {
        const existing = yield* signing.findPrepared(owner, requestId, (payload) => payload["action"] === action)
        if (Option.isNone(existing)) return Option.none<PasskeyChange>()
        const row = yield* accounts.passkey(owner.id, existing.value.payload["passkeyId"]!)
        return Option.some(yield* toChange(existing.value, Option.getOrThrow(row)))
      })

      // What a change that landed (or not) does to the passkey.
      const settle = Effect.fnUntraced(function*(row: PasskeyRow) {
        const userId = row.userId as UserId
        const outcome = yield* operations.wait(
          yield* accounts.ownerPasskey(userId),
          row.userOpHash as Hex,
          "owner_change"
        ).pipe(
          Effect.result
        )
        const landed = outcome._tag === "Success" && outcome.success.success
        const adding = row.status === "pending"
        const now = yield* DateTime.now

        if (!landed) {
          yield* Effect.logWarning(`Passkey ${row.id}: its ${adding ? "addition" : "removal"} didn't land`, outcome)
          // An owner that was never added is gone; one whose removal failed still owns the account.
          yield* accounts.savePasskey(
            row.id,
            adding ? { status: "removed", removedAt: now, userOpHash: null } : {
              status: "active",
              userOpHash: null
            }
          )
          return yield* changed(userId)
        }

        yield* accounts.savePasskey(
          row.id,
          adding ? { status: "active", userOpHash: null } : { status: "removed", removedAt: now, userOpHash: null }
        )
        if (!adding) yield* sessions.signOutPasskey(row.id)
        yield* audit.record({
          userId,
          actor: "owner",
          action: adding ? "passkey.added" : "passkey.removed",
          subjectType: "passkey",
          subjectId: row.id,
          data: { label: row.label }
        })
        yield* count(PasskeysMetric, { change: adding ? "added" : "removed" })
        const owners = (yield* accounts.owners(userId)).length
        yield* analytics.capture(userId, { _tag: adding ? "passkey_added" : "passkey_removed", count_after: owners }, {
          id: row.id,
          at: now,
          set: { passkeys_count: owners }
        })
        yield* notifications.add(userId, notificationOfPasskey(row, adding))
        yield* changed(userId)
      })

      const track = (row: PasskeyRow) =>
        settle(row).pipe(
          Effect.catchCause((cause) => Effect.logWarning(`Passkey ${row.id} settle failed`, cause)),
          Effect.forkIn(scope),
          Effect.asVoid
        )

      for (const row of yield* accounts.passkeysInFlight) {
        if (row.role === "owner") yield* track(row)
      }

      const options = Effect.fn("Passkeys.options")(function*(owner: Owner) {
        const known = yield* accounts.owners(owner.id)
        const options = yield* webAuthn.registrationOptions(undefined, { exclude: known })
        const challengeId = yield* challenges.issue("passkey", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      })

      const add = Effect.fn("Passkeys.add")(function*(owner: Owner, input: {
        readonly requestId: string
        readonly challengeId: string
        readonly credential: typeof RegistrationCredential.Type
        readonly userAgent: string | undefined
      }) {
        const existing = yield* prepared(owner, input.requestId, "add")
        if (Option.isSome(existing)) return existing.value

        const challenge = yield* challenges.consume("passkey", input.challengeId)
        const passkey = yield* webAuthn.verifyRegistration(input.credential, challenge)
        if (Option.isSome(yield* accounts.findPasskey(passkey.credentialId))) {
          return yield* new SignatureRejected({ reason: "invalid" })
        }

        const row = yield* accounts.insertPasskey(owner.id, {
          passkey,
          label: passkeyLabel({ aaguid: passkey.aaguid, userAgent: input.userAgent }),
          role: "owner"
        })
        const request = yield* signing.create(owner, {
          requestId: input.requestId,
          kind: "passkey",
          payload: { passkeyId: row.id, action: "add" },
          calls: [addOwnerCall(passkey.publicKey)]
        })
        return yield* toChange(request, row)
      })

      const remove = Effect.fn("Passkeys.remove")(function*(owner: Owner, id: string, requestId: string) {
        const existing = yield* prepared(owner, requestId, "remove")
        if (Option.isSome(existing)) return existing.value

        const found = yield* accounts.passkey(owner.id, id)
        if (Option.isNone(found) || found.value.role !== "owner" || found.value.status === "removed") {
          return yield* new NotFound({ resource: "passkey", id })
        }
        const row = found.value
        if (row.status !== "active") return yield* new Conflict({ reason: "passkeyBusy" })
        if ((yield* accounts.owners(owner.id)).length <= 1) return yield* new Conflict({ reason: "lastPasskey" })

        const request = yield* signing.create(owner, {
          requestId,
          kind: "passkey",
          payload: { passkeyId: row.id, action: "remove" },
          calls: [removeOwnerCall(row.publicKey as Hex)]
        })
        return yield* toChange(request, row)
      })

      const confirm = Effect.fn("Passkeys.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey: signer, request } = yield* signing.claim(owner, id, "passkey", credential)
        const adding = request.payload["action"] === "add"
        const row = Option.getOrThrow(yield* accounts.passkey(owner.id, request.payload["passkeyId"]!))
        if (row.status !== (adding ? "pending" : "active")) return yield* new Conflict({ reason: "passkeyBusy" })
        if (!adding && (yield* accounts.owners(owner.id)).length <= 1) {
          return yield* new Conflict({ reason: "lastPasskey" })
        }

        const userOpHash = yield* operations.send(signer, request.userOperation, credential)
        const saved = yield* accounts.savePasskey(row.id, { userOpHash, status: adding ? "pending" : "removing" })
        yield* changed(owner.id)
        yield* track(saved)
        return toPasskey(saved)
      })

      return Passkeys.of({ options, add, remove, confirm })
    })
  )
}
