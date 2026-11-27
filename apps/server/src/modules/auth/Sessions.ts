import { Device } from "@bluechip/domain/Account"
import type { CurrentUser, RecoveringUser } from "@bluechip/domain/Auth"
import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address, PasskeyId, SessionId, UserId } from "@bluechip/domain/Ids"
import { and, desc, eq, gt, isNotNull, isNull, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { createHash, randomBytes } from "node:crypto"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { count, DevicesSignedOut } from "../../platform/telemetry/Metrics.ts"
import { accounts, passkeys } from "../accounts/tables.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { sessions } from "./tables.ts"

/** How long a session lasts; signing in again starts a new one. */
const SESSION_DAYS = 30

/** How long a session signed in with the recovery passkey lasts: long enough to make a recovery, no longer. */
const RECOVERY_MINUTES = 15

const hash = (token: string) => createHash("sha256").update(token).digest("hex")

type Scope = typeof sessions.$inferSelect["scope"]

/**
 * Sign-in sessions: a random token in the browser's cookie, only its hash stored. Each is a device the user can see
 * and sign out; `recovery` sessions (signed in with the recovery passkey) only reach the recovery's routes.
 */
export class Sessions extends Context.Service<Sessions, {
  /**
   * Starts a session for the passkey that signed in, on `device`; returns its token for the cookie and whether the
   * user had never signed in on that device before.
   */
  readonly create: (input: {
    readonly userId: UserId
    readonly passkeyId: PasskeyId
    readonly device: string
    readonly scope?: Scope | undefined
  }) => Effect.Effect<{
    readonly id: SessionId
    readonly token: string
    readonly expiresAt: DateTime.Utc
    readonly newDevice: boolean
  }>
  /** The user and account behind a live (unexpired, unrevoked) account session; marks it seen. */
  readonly user: (token: string) => Effect.Effect<Option.Option<CurrentUser["Service"]>>
  /** Who is behind a live recovery session. */
  readonly recovering: (token: string) => Effect.Effect<Option.Option<RecoveringUser["Service"]>>
  readonly revoke: (token: string) => Effect.Effect<void>
  /** The user's devices signed in, most recently seen first. */
  readonly devices: (userId: UserId, current: SessionId) => Effect.Effect<ReadonlyArray<Device>>
  /** Signs out one of the user's devices. */
  readonly signOut: (userId: UserId, id: SessionId) => Effect.Effect<void, NotFound>
  /** Signs out every device of the user's but `keep` (none when it is omitted). */
  readonly signOutAll: (userId: UserId, keep?: SessionId | undefined) => Effect.Effect<void>
  /** Signs out every device that signed in with one passkey (one that was removed). */
  readonly signOutPasskey: (passkeyId: string) => Effect.Effect<void>
}>()("@bluechip/server/Sessions") {
  static readonly layer = Layer.effect(
    Sessions,
    Effect.gen(function*() {
      const db = yield* Database
      const audit = yield* AuditLog
      const live = yield* LiveEvents

      const signedOut = (userId: UserId, subjectId: string, data: object) =>
        Effect.andThen(
          audit.record({ userId, actor: "owner", action: "device.signedOut", subjectType: "session", subjectId, data }),
          live.publish(LiveEvent.cases.AccountChanged.make({}), userId)
        )

      const create = Effect.fn("Sessions.create")(function*(input: {
        readonly userId: UserId
        readonly passkeyId: PasskeyId
        readonly device: string
        readonly scope?: Scope | undefined
      }) {
        const scope = input.scope ?? "account"
        const token = randomBytes(32).toString("base64url")
        const createdAt = yield* DateTime.now
        const expiresAt = scope === "recovery" ?
          DateTime.add(createdAt, { minutes: RECOVERY_MINUTES }) :
          DateTime.add(createdAt, { days: SESSION_DAYS })
        const [seen] = yield* db.select({ id: sessions.id }).from(sessions).where(and(
          eq(sessions.userId, input.userId as `user_${string}`),
          eq(sessions.device, input.device),
          eq(sessions.scope, "account")
        )).limit(1).pipe(Effect.orDie)
        const id = typeid("session").toString() as `session_${string}`

        yield* db.insert(sessions).values({
          id,
          userId: input.userId as `user_${string}`,
          passkeyId: input.passkeyId as `passkey_${string}`,
          tokenHash: hash(token),
          scope,
          device: input.device,
          createdAt,
          lastSeenAt: createdAt,
          expiresAt
        }).pipe(Effect.orDie)
        return { id: id as SessionId, token, expiresAt, newDevice: scope === "account" && seen === undefined }
      })

      const liveSession = (token: string, scope: Scope, now: DateTime.Utc) =>
        db.select({
          id: sessions.id,
          userId: sessions.userId,
          address: accounts.address,
          passkeyId: sessions.passkeyId,
          lastSeenAt: sessions.lastSeenAt
        })
          .from(sessions)
          .innerJoin(accounts, eq(accounts.userId, sessions.userId))
          .where(and(
            eq(sessions.tokenHash, hash(token)),
            eq(sessions.scope, scope),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
            isNotNull(sessions.passkeyId)
          ))
          .pipe(Effect.orDie)

      const user = Effect.fn("Sessions.user")(function*(token: string) {
        const now = yield* DateTime.now
        const [row] = yield* liveSession(token, "account", now)
        if (row === undefined) return Option.none()

        // At most one write a minute per device: every request reads the session.
        if (row.lastSeenAt === null || DateTime.isLessThan(row.lastSeenAt, DateTime.subtract(now, { minutes: 1 }))) {
          yield* db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.id)).pipe(Effect.orDie)
        }
        return Option.some({
          id: row.userId as UserId,
          account: row.address as Address,
          passkey: row.passkeyId as PasskeyId,
          session: row.id as SessionId
        })
      })

      const recovering = Effect.fn("Sessions.recovering")(function*(token: string) {
        const [row] = yield* liveSession(token, "recovery", yield* DateTime.now)
        return Option.fromNullishOr(row).pipe(
          Option.map((found) => ({
            id: found.userId as UserId,
            account: found.address as Address,
            passkey: found.passkeyId as PasskeyId,
            session: found.id as SessionId
          }))
        )
      })

      const revoke = Effect.fn("Sessions.revoke")(function*(token: string) {
        yield* db.update(sessions)
          .set({ revokedAt: yield* DateTime.now })
          .where(and(eq(sessions.tokenHash, hash(token)), isNull(sessions.revokedAt)))
          .pipe(Effect.orDie)
      })

      const devices = Effect.fn("Sessions.devices")(function*(userId: UserId, current: SessionId) {
        const rows = yield* db.select({ session: sessions, passkey: passkeys.label }).from(sessions)
          .leftJoin(passkeys, eq(passkeys.id, sessions.passkeyId))
          .where(and(
            eq(sessions.userId, userId as `user_${string}`),
            eq(sessions.scope, "account"),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, yield* DateTime.now),
            isNotNull(sessions.passkeyId)
          ))
          .orderBy(desc(sessions.lastSeenAt))
          .pipe(Effect.orDie)
        return rows.map(({ passkey, session }) =>
          new Device({
            id: session.id as SessionId,
            device: session.device,
            passkey,
            current: session.id === current,
            signedInAt: session.createdAt,
            lastSeenAt: session.lastSeenAt ?? session.createdAt
          })
        )
      })

      const signOut = Effect.fn("Sessions.signOut")(function*(userId: UserId, id: SessionId) {
        const revoked = yield* db.update(sessions).set({ revokedAt: yield* DateTime.now }).where(and(
          eq(sessions.id, id as `session_${string}`),
          eq(sessions.userId, userId as `user_${string}`),
          isNull(sessions.revokedAt)
        )).returning({ id: sessions.id, device: sessions.device }).pipe(Effect.orDie)
        if (revoked.length === 0) return yield* new NotFound({ resource: "device", id })
        yield* signedOut(userId, id, { device: revoked[0]!.device })
        yield* count(DevicesSignedOut, { scope: "one" })
      })

      const signOutAll = Effect.fn("Sessions.signOutAll")(function*(userId: UserId, keep?: SessionId | undefined) {
        yield* db.update(sessions).set({ revokedAt: yield* DateTime.now }).where(and(
          eq(sessions.userId, userId as `user_${string}`),
          isNull(sessions.revokedAt),
          keep === undefined ? undefined : ne(sessions.id, keep as `session_${string}`)
        )).pipe(Effect.orDie)
        yield* signedOut(userId, keep ?? userId, { everywhere: true, kept: keep ?? null })
        yield* count(DevicesSignedOut, { scope: keep === undefined ? "all" : "others" })
      })

      const signOutPasskey = Effect.fn("Sessions.signOutPasskey")(function*(passkeyId: string) {
        yield* db.update(sessions).set({ revokedAt: yield* DateTime.now }).where(and(
          eq(sessions.passkeyId, passkeyId as `passkey_${string}`),
          isNull(sessions.revokedAt)
        )).pipe(Effect.orDie)
      })

      return Sessions.of({ create, user, recovering, revoke, devices, signOut, signOutAll, signOutPasskey })
    })
  )
}
