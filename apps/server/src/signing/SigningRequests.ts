import { Conflict, NotFound, SignatureRejected } from "@bluechip/domain/Errors"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, asc, eq, isNull } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import { recordPasskeyUse } from "../accounts/Accounts.ts"
import { verifyAuthentication } from "../auth/WebAuthn.ts"
import { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { passkeys } from "../db/schema/accounts.ts"
import { signingRequests } from "../db/schema/signing.ts"
import { type Call, challengeOf, prepareOperation } from "./OwnerOperations.ts"

/** The signed-in user and their account. */
export interface Owner {
  readonly id: UserId
  readonly account: Address
}

export type SigningRequestRow = typeof signingRequests.$inferSelect

// Long enough to read the review and approve with Face ID; short enough that gas prices and quotes still hold.
const SIGNING_WINDOW = { minutes: 2 }

/** The passkey the account was created with: the one its validator checks. */
export const ownerPasskey = Effect.fnUntraced(function*(userId: UserId) {
  const db = yield* Database
  const [row] = yield* db.select().from(passkeys).where(eq(passkeys.userId, userId as `user_${string}`))
    .orderBy(asc(passkeys.createdAt)).limit(1).pipe(Effect.orDie)

  if (row === undefined) return yield* Effect.die(new Error(`no passkey for ${userId}`))
  return row
})

/** The browser's WebAuthn request for a signing request: the user operation's hash, signed by the owner passkey. */
export const webAuthnOptions = Effect.fnUntraced(function*(row: SigningRequestRow) {
  const config = yield* AppConfig
  const passkey = yield* ownerPasskey(row.userId as UserId)

  return {
    challenge: challengeOf(row.hash as Hex),
    rpId: config.rpId,
    allowCredentials: [{ id: passkey.credentialId, type: "public-key", transports: passkey.transports }],
    userVerification: "required",
    timeout: 120_000
  }
})

/**
 * The request already prepared under this client request id, if it's the same action and still usable; a reused id
 * for something else (or a used or expired request) is a `Conflict`.
 */
export const findPrepared = Effect.fnUntraced(function*(
  owner: Owner,
  requestId: string,
  sameAction: (payload: Record<string, string>) => boolean
) {
  const db = yield* Database
  const [existing] = yield* db.select().from(signingRequests).where(and(
    eq(signingRequests.userId, owner.id as `user_${string}`),
    eq(signingRequests.requestId, requestId)
  )).pipe(Effect.orDie)
  if (existing === undefined) return Option.none<SigningRequestRow>()

  const now = yield* DateTime.now
  if (!sameAction(existing.payload) || existing.usedAt !== null || DateTime.isGreaterThan(now, existing.expiresAt)) {
    return yield* new Conflict({ reason: "requestIdReused" })
  }
  return Option.some(existing)
})

/** Builds the user operation for `calls` and stores it, with what it does, for the owner's passkey to sign. */
export const createSigningRequest = Effect.fnUntraced(function*(
  owner: Owner,
  request: {
    readonly requestId: string
    readonly kind: SigningRequestRow["kind"]
    readonly payload: Record<string, string>
    readonly calls: ReadonlyArray<Call>
    readonly minCallGas?: bigint
  }
) {
  const db = yield* Database
  const passkey = yield* ownerPasskey(owner.id)
  const prepared = yield* prepareOperation(passkey, request.calls, request.minCallGas)
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

/**
 * Checks the browser's passkey signature on a signing request and claims it, so it can be sent exactly once: wrong
 * passkey, bad signature, expired or already used are all `SignatureRejected`.
 */
export const claimSigningRequest = Effect.fnUntraced(function*(
  owner: Owner,
  id: SigningRequestId,
  kind: SigningRequestRow["kind"],
  credential: typeof AuthenticationCredential.Type
) {
  const db = yield* Database
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

  const passkey = yield* ownerPasskey(owner.id)
  if (credential.id !== passkey.credentialId) return yield* new SignatureRejected({ reason: "unknownPasskey" })
  const counter = yield* verifyAuthentication(credential, challengeOf(request.hash as Hex), passkey)
  yield* recordPasskeyUse(passkey.id, counter)

  // Claimed before sending, so a replayed signature can never send it twice.
  const claimed = yield* db.update(signingRequests).set({ usedAt: now })
    .where(and(eq(signingRequests.id, request.id), isNull(signingRequests.usedAt))).returning()
    .pipe(Effect.orDie)
  if (claimed.length === 0) return yield* new SignatureRejected({ reason: "challenge" })

  return { request, passkey }
})
