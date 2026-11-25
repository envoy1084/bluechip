import type { Address, UserId } from "@bluechip/domain/Ids"
import { and, eq, gt, isNull } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { createHash, randomBytes } from "node:crypto"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { accounts } from "../db/schema/accounts.ts"
import { sessions } from "../db/schema/auth.ts"

/** How long a session lasts; signing in again starts a new one. */
export const sessionDays = 30

const hash = (token: string) => createHash("sha256").update(token).digest("hex")

/** Starts a session and returns its token for the cookie; only the token's hash is stored. */
export const createSession = Effect.fn("Sessions.create")(function*(userId: UserId) {
  const db = yield* Database
  const token = randomBytes(32).toString("base64url")
  const createdAt = yield* DateTime.now
  const expiresAt = DateTime.add(createdAt, { days: sessionDays })
  yield* db.insert(sessions).values({
    id: typeid("session").toString() as `session_${string}`,
    userId: userId as `user_${string}`,
    tokenHash: hash(token),
    createdAt,
    expiresAt
  }).pipe(Effect.orDie)
  return { token, expiresAt }
})

/** The user and account behind a live (unexpired, unrevoked) session token. */
export const findSessionUser = Effect.fn("Sessions.find")(function*(token: string) {
  const db = yield* Database
  const now = yield* DateTime.now
  const [row] = yield* db.select({ userId: sessions.userId, address: accounts.address })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.userId, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .pipe(Effect.orDie)
  return Option.fromNullishOr(row).pipe(
    Option.map(({ address, userId }) => ({ id: userId as UserId, account: address as Address }))
  )
})

export const revokeSession = Effect.fn("Sessions.revoke")(function*(token: string) {
  const db = yield* Database
  yield* db.update(sessions)
    .set({ revokedAt: yield* DateTime.now })
    .where(and(eq(sessions.tokenHash, hash(token)), isNull(sessions.revokedAt)))
    .pipe(Effect.orDie)
})
