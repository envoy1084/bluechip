import type { CurrentUser } from "@bluechip/domain/Auth"
import type { Address, PasskeyId, UserId } from "@bluechip/domain/Ids"
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { createHash, randomBytes } from "node:crypto"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { accounts } from "../db/schema/accounts.ts"
import { sessions } from "../db/schema/auth.ts"

/** How long a session lasts; signing in again starts a new one. */
const SESSION_DAYS = 30

const hash = (token: string) => createHash("sha256").update(token).digest("hex")

/** Sign-in sessions: a random token in the browser's cookie, only its hash stored. */
export class Sessions extends Context.Service<Sessions, {
  /** Starts a session for the passkey that signed in; returns its token for the cookie. */
  readonly create: (
    userId: UserId,
    passkeyId: PasskeyId
  ) => Effect.Effect<{ readonly token: string; readonly expiresAt: DateTime.Utc }>
  /** The user and account behind a live (unexpired, unrevoked) session token. */
  readonly user: (token: string) => Effect.Effect<Option.Option<CurrentUser["Service"]>>
  readonly revoke: (token: string) => Effect.Effect<void>
}>()("@bluechip/server/Sessions") {
  static readonly layer = Layer.effect(
    Sessions,
    Effect.gen(function*() {
      const db = yield* Database

      const create = Effect.fn("Sessions.create")(function*(userId: UserId, passkeyId: PasskeyId) {
        const token = randomBytes(32).toString("base64url")
        const createdAt = yield* DateTime.now
        const expiresAt = DateTime.add(createdAt, { days: SESSION_DAYS })
        yield* db.insert(sessions).values({
          id: typeid("session").toString() as `session_${string}`,
          userId: userId as `user_${string}`,
          passkeyId: passkeyId as `passkey_${string}`,
          tokenHash: hash(token),
          createdAt,
          expiresAt
        }).pipe(Effect.orDie)
        return { token, expiresAt }
      })

      const user = Effect.fn("Sessions.user")(function*(token: string) {
        const [row] = yield* db.select({
          userId: sessions.userId,
          address: accounts.address,
          passkeyId: sessions.passkeyId
        })
          .from(sessions)
          .innerJoin(accounts, eq(accounts.userId, sessions.userId))
          .where(and(
            eq(sessions.tokenHash, hash(token)),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, yield* DateTime.now),
            isNotNull(sessions.passkeyId)
          ))
          .pipe(Effect.orDie)
        return Option.fromNullishOr(row).pipe(
          Option.map(({ address, passkeyId, userId }) => ({
            id: userId as UserId,
            account: address as Address,
            passkey: passkeyId as PasskeyId
          }))
        )
      })

      const revoke = Effect.fn("Sessions.revoke")(function*(token: string) {
        yield* db.update(sessions)
          .set({ revokedAt: yield* DateTime.now })
          .where(and(eq(sessions.tokenHash, hash(token)), isNull(sessions.revokedAt)))
          .pipe(Effect.orDie)
      })

      return Sessions.of({ create, user, revoke })
    })
  )
}
