import { Conflict, NotFound, SignatureRejected, type Unavailable } from "@bluechip/domain/Errors"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import type { AuthenticationCredential, CeremonyOptions } from "@bluechip/domain/WebAuthn"
import { and, eq, isNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import { AppConfig } from "../../config/AppConfig.ts"
import { Database } from "../../platform/db/Database.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { WebAuthn } from "../auth/WebAuthn.ts"
import { type Call, challengeOf, OwnerOperations, type OwnerPasskey } from "./OwnerOperations.ts"
import { signingRequests } from "./tables.ts"

/** The signed-in user and their account. */
export interface Owner {
  readonly id: UserId
  readonly account: Address
}

export type SigningRequestRow = typeof signingRequests.$inferSelect

// Long enough to read the review and approve with Face ID; short enough that gas prices and quotes still hold.
const SIGNING_WINDOW = { minutes: 2 }

/**
 * Owner operations waiting for the passkey: each is prepared and stored with what it does, signed in the browser,
 * then claimed exactly once to be sent.
 */
export class SigningRequests extends Context.Service<SigningRequests, {
  /** The browser's WebAuthn request for a signing request: the user operation's hash, signed by the owner passkey. */
  readonly webAuthnOptions: (row: SigningRequestRow) => Effect.Effect<typeof CeremonyOptions.Type>
  /**
   * The request already prepared under this client request id, if it's the same action and still usable; a reused id
   * for something else (or a used or expired request) is a `Conflict`.
   */
  readonly findPrepared: (
    owner: Owner,
    requestId: string,
    sameAction: (payload: Record<string, string>) => boolean
  ) => Effect.Effect<Option.Option<SigningRequestRow>, Conflict>
  /** Builds the user operation for `calls` and stores it, with what it does, for the owner's passkey to sign. */
  readonly create: (owner: Owner, request: {
    readonly requestId: string
    readonly kind: SigningRequestRow["kind"]
    readonly payload: Record<string, string>
    readonly calls: ReadonlyArray<Call>
    readonly minCallGas?: bigint
  }) => Effect.Effect<SigningRequestRow, Unavailable>
  /**
   * Checks the browser's passkey signature on a signing request and claims it, so it can be sent exactly once: wrong
   * passkey, bad signature, expired or already used are all `SignatureRejected`.
   */
  readonly claim: (
    owner: Owner,
    id: SigningRequestId,
    kind: SigningRequestRow["kind"],
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<
    { readonly request: SigningRequestRow; readonly passkey: OwnerPasskey },
    NotFound | SignatureRejected
  >
}>()("@bluechip/server/SigningRequests") {
  static readonly layer = Layer.effect(
    SigningRequests,
    Effect.gen(function*() {
      const db = yield* Database
      const config = yield* AppConfig
      const accounts = yield* Accounts
      const webAuthn = yield* WebAuthn
      const operations = yield* OwnerOperations

      // Any of the account's owner passkeys signs: the browser offers whichever this device has.
      const webAuthnOptions = Effect.fn("SigningRequests.webAuthnOptions")(function*(row: SigningRequestRow) {
        const owners = yield* accounts.owners(row.userId as UserId)
        return {
          challenge: challengeOf(row.hash as Hex),
          rpId: config.rpId,
          allowCredentials: owners.map((owner) => ({
            id: owner.credentialId,
            type: "public-key",
            transports: owner.transports
          })),
          userVerification: "required",
          timeout: 120_000
        }
      })

      const findPrepared = Effect.fn("SigningRequests.findPrepared")(function*(
        owner: Owner,
        requestId: string,
        sameAction: (payload: Record<string, string>) => boolean
      ) {
        const [existing] = yield* db.select().from(signingRequests).where(and(
          eq(signingRequests.userId, owner.id as `user_${string}`),
          eq(signingRequests.requestId, requestId)
        )).pipe(Effect.orDie)
        if (existing === undefined) return Option.none<SigningRequestRow>()

        const now = yield* DateTime.now
        if (
          !sameAction(existing.payload) || existing.usedAt !== null || DateTime.isGreaterThan(now, existing.expiresAt)
        ) {
          return yield* new Conflict({ reason: "requestIdReused" })
        }
        return Option.some(existing)
      })

      const create = Effect.fn("SigningRequests.create")(function*(owner: Owner, request: {
        readonly requestId: string
        readonly kind: SigningRequestRow["kind"]
        readonly payload: Record<string, string>
        readonly calls: ReadonlyArray<Call>
        readonly minCallGas?: bigint
      }) {
        const passkey = yield* accounts.ownerPasskey(owner.id)
        const prepared = yield* operations.prepare(passkey, request.calls, request.minCallGas)
        const now = yield* DateTime.now

        const [row] = yield* db.insert(signingRequests).values({
          id: typeid("signing").toString() as `signing_${string}`,
          userId: owner.id as `user_${string}`,
          requestId: request.requestId,
          kind: request.kind,
          payload: request.payload,
          userOperation: prepared.userOperation,
          hash: prepared.hash,
          deploysAccount: prepared.deploysAccount,
          createdAt: now,
          expiresAt: DateTime.add(now, SIGNING_WINDOW)
        }).returning().pipe(Effect.orDie)
        return row!
      })

      const claim = Effect.fn("SigningRequests.claim")(function*(
        owner: Owner,
        id: SigningRequestId,
        kind: SigningRequestRow["kind"],
        credential: typeof AuthenticationCredential.Type
      ) {
        const [request] = yield* db.select().from(signingRequests).where(and(
          eq(signingRequests.id, id as `signing_${string}`),
          eq(signingRequests.userId, owner.id as `user_${string}`),
          eq(signingRequests.kind, kind)
        )).pipe(Effect.orDie)
        if (request === undefined) return yield* new NotFound({ resource: "signingRequest", id })

        const now = yield* DateTime.now
        if (request.usedAt !== null || DateTime.isGreaterThan(now, request.expiresAt)) {
          return yield* new SignatureRejected({ reason: "challenge" })
        }

        const signer = yield* accounts.ownerByCredential(owner.id, credential.id)
        if (Option.isNone(signer)) return yield* new SignatureRejected({ reason: "unknownPasskey" })
        const passkey = signer.value
        const counter = yield* webAuthn.verifyAuthentication(credential, challengeOf(request.hash as Hex), passkey)
        yield* accounts.recordPasskeyUse(passkey.id, counter)

        // Claimed before sending, so a replayed signature can never send it twice.
        const claimed = yield* db.update(signingRequests).set({ usedAt: now })
          .where(and(eq(signingRequests.id, request.id), isNull(signingRequests.usedAt))).returning()
          .pipe(Effect.orDie)
        if (claimed.length === 0) return yield* new SignatureRejected({ reason: "challenge" })

        return { request, passkey }
      })

      return SigningRequests.of({ webAuthnOptions, findPrepared, create, claim })
    })
  )
}
