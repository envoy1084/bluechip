import type { Call } from "@bluechip/chain/account/Owners"
import type { RecoveryKeyId, RecoveryRequestId, UserId } from "@bluechip/domain/Ids"
import { RecoveryKey, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { passkeys } from "../accounts/tables.ts"
import { recoveryKeys, recoveryRequests } from "./tables.ts"

export type RecoveryKeyRow = typeof recoveryKeys.$inferSelect
export type RecoveryRequestRow = typeof recoveryRequests.$inferSelect

/** A recovery key row with its passkey's label and keys. */
export interface StoredKey {
  readonly key: RecoveryKeyRow
  readonly passkey: typeof passkeys.$inferSelect
}

/**
 * The account's recovery key and its recoveries as stored: reading the one in force and the latest recovery, and
 * saving each step. Rows become domain values here.
 */
export class RecoveryStore extends Context.Service<RecoveryStore, {
  readonly toKey: (stored: StoredKey) => RecoveryKey | null
  readonly toRequest: (row: RecoveryRequestRow) => Effect.Effect<RecoveryRequest>
  /** The user's recovery key not removed (nor a draft never signed, unless `drafts`). */
  readonly keyOf: (userId: UserId, options?: { readonly drafts?: boolean }) => Effect.Effect<Option.Option<StoredKey>>
  readonly key: (id: string) => Effect.Effect<StoredKey>
  readonly insertKey: (input: {
    readonly userId: UserId
    readonly passkeyId: string
    readonly guardAddress: string
    readonly guardKey: (id: RecoveryKeyId) => string
  }) => Effect.Effect<RecoveryKeyRow>
  readonly saveKey: (id: string, changes: Partial<RecoveryKeyRow>) => Effect.Effect<RecoveryKeyRow>
  /** The user's latest recovery that got past its draft. */
  readonly latest: (userId: UserId) => Effect.Effect<Option.Option<RecoveryRequestRow>>
  readonly request: (id: string) => Effect.Effect<Option.Option<RecoveryRequestRow>>
  readonly insertRequest: (input: {
    readonly userId: UserId
    readonly recoveryKeyId: string
    readonly newPasskeyId: string
    readonly calls: ReadonlyArray<Call>
  }) => Effect.Effect<RecoveryRequestRow>
  readonly saveRequest: (id: string, changes: Partial<RecoveryRequestRow>) => Effect.Effect<RecoveryRequestRow>
  /** Recovery keys and recoveries with an operation on their way, everyone's. */
  readonly inFlight: Effect.Effect<{
    readonly keys: ReadonlyArray<RecoveryKeyRow>
    readonly requests: ReadonlyArray<RecoveryRequestRow>
  }>
}>()("@bluechip/server/RecoveryStore") {
  static readonly layer = Layer.effect(
    RecoveryStore,
    Effect.gen(function*() {
      const db = yield* Database

      const toKey = ({ key, passkey }: StoredKey) =>
        key.status === "draft" || key.status === "removed" ? null : new RecoveryKey({
          id: key.id as RecoveryKeyId,
          label: passkey.label,
          status: key.status,
          createdAt: key.createdAt
        })

      const toRequest = Effect.fnUntraced(function*(row: RecoveryRequestRow) {
        const [passkey] = yield* db.select({ label: passkeys.label }).from(passkeys)
          .where(eq(passkeys.id, row.newPasskeyId)).pipe(Effect.orDie)
        return new RecoveryRequest({
          id: row.id as RecoveryRequestId,
          status: row.status === "draft" ? "requesting" : row.status,
          newPasskey: passkey?.label ?? null,
          requestedAt: row.requestedAt,
          executableAt: row.executableAt,
          cancelledAt: row.cancelledAt,
          cancelledFrom: row.cancelledFrom,
          executedAt: row.executedAt
        })
      })

      const keyOf = Effect.fn("RecoveryStore.keyOf")(
        function*(userId: UserId, options: { readonly drafts?: boolean } = {}) {
          const [row] = yield* db.select({ key: recoveryKeys, passkey: passkeys }).from(recoveryKeys)
            .innerJoin(passkeys, eq(passkeys.id, recoveryKeys.passkeyId))
            .where(and(
              eq(recoveryKeys.userId, userId as `user_${string}`),
              ne(recoveryKeys.status, "removed"),
              options.drafts === true ? undefined : ne(recoveryKeys.status, "draft")
            ))
            .orderBy(desc(recoveryKeys.createdAt)).limit(1).pipe(Effect.orDie)
          return Option.fromNullishOr(row)
        }
      )

      const key = Effect.fn("RecoveryStore.key")(function*(id: string) {
        const [row] = yield* db.select({ key: recoveryKeys, passkey: passkeys }).from(recoveryKeys)
          .innerJoin(passkeys, eq(passkeys.id, recoveryKeys.passkeyId))
          .where(eq(recoveryKeys.id, id as `recoverykey_${string}`)).pipe(Effect.orDie)
        if (row === undefined) return yield* Effect.die(new Error(`no recovery key ${id}`))
        return row
      })

      const insertKey = Effect.fn("RecoveryStore.insertKey")(function*(input: {
        readonly userId: UserId
        readonly passkeyId: string
        readonly guardAddress: string
        readonly guardKey: (id: RecoveryKeyId) => string
      }) {
        const id = typeid("recoverykey").toString() as `recoverykey_${string}`
        const [row] = yield* db.insert(recoveryKeys).values({
          id,
          userId: input.userId as `user_${string}`,
          passkeyId: input.passkeyId as `passkey_${string}`,
          guardAddress: input.guardAddress,
          guardKey: input.guardKey(id as RecoveryKeyId),
          status: "draft",
          createdAt: yield* DateTime.now
        }).returning().pipe(Effect.orDie)
        return row!
      })

      const saveKey = Effect.fn("RecoveryStore.saveKey")(function*(id: string, changes: Partial<RecoveryKeyRow>) {
        const [row] = yield* db.update(recoveryKeys).set(changes)
          .where(eq(recoveryKeys.id, id as `recoverykey_${string}`)).returning().pipe(Effect.orDie)
        return row!
      })

      const latest = Effect.fn("RecoveryStore.latest")(function*(userId: UserId) {
        const [row] = yield* db.select().from(recoveryRequests).where(and(
          eq(recoveryRequests.userId, userId as `user_${string}`),
          ne(recoveryRequests.status, "draft")
        )).orderBy(desc(recoveryRequests.requestedAt)).limit(1).pipe(Effect.orDie)
        return Option.fromNullishOr(row)
      })

      const request = Effect.fn("RecoveryStore.request")(function*(id: string) {
        const [row] = yield* db.select().from(recoveryRequests)
          .where(eq(recoveryRequests.id, id as `recovery_${string}`)).pipe(Effect.orDie)
        return Option.fromNullishOr(row)
      })

      const insertRequest = Effect.fn("RecoveryStore.insertRequest")(function*(input: {
        readonly userId: UserId
        readonly recoveryKeyId: string
        readonly newPasskeyId: string
        readonly calls: ReadonlyArray<Call>
      }) {
        const [row] = yield* db.insert(recoveryRequests).values({
          id: typeid("recovery").toString() as `recovery_${string}`,
          userId: input.userId as `user_${string}`,
          recoveryKeyId: input.recoveryKeyId as `recoverykey_${string}`,
          newPasskeyId: input.newPasskeyId as `passkey_${string}`,
          calls: [...input.calls],
          status: "draft",
          requestedAt: yield* DateTime.now
        }).returning().pipe(Effect.orDie)
        return row!
      })

      const saveRequest = Effect.fn("RecoveryStore.saveRequest")(
        function*(id: string, changes: Partial<RecoveryRequestRow>) {
          const [row] = yield* db.update(recoveryRequests).set(changes)
            .where(eq(recoveryRequests.id, id as `recovery_${string}`)).returning().pipe(Effect.orDie)
          return row!
        }
      )

      const inFlight = Effect.gen(function*() {
        const keys = yield* db.select().from(recoveryKeys).where(and(
          isNotNull(recoveryKeys.userOpHash),
          inArray(recoveryKeys.status, ["locking", "removing"])
        )).pipe(Effect.orDie)
        const requests = yield* db.select().from(recoveryRequests).where(and(
          isNotNull(recoveryRequests.userOpHash),
          inArray(recoveryRequests.status, ["requesting", "executing"])
        )).pipe(Effect.orDie)
        return { keys, requests }
      })

      return RecoveryStore.of({
        toKey,
        toRequest,
        keyOf,
        key,
        insertKey,
        saveKey,
        latest,
        request,
        insertRequest,
        saveRequest,
        inFlight
      })
    })
  )
}
