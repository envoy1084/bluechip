import { ChainClient } from "@bluechip/chain/ChainClient"
import { Account, type Eligibility, Me, Passkey, User } from "@bluechip/domain/Account"
import { zoneOf } from "@bluechip/domain/automations/Time"
import { InvalidRequest } from "@bluechip/domain/Errors"
import type { Address, PasskeyId, UserId } from "@bluechip/domain/Ids"
import * as SmartAccount from "@namera-ai/sdk/effect/accounts/SmartAccount"
import { and, asc, eq, isNotNull, ne } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { toWebAuthnAccount } from "viem/account-abstraction"
import { Database } from "../../platform/db/Database.ts"
import { Namera } from "../../platform/namera/Namera.ts"
import { count, UsersEligibility, UsersSignedUp } from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import type { NewPasskey } from "../auth/WebAuthn.ts"
import { accounts, passkeys, users } from "./tables.ts"

export type PasskeyRow = typeof passkeys.$inferSelect

/** A passkey that signs for the account, with the account's address. */
export type Signer = PasskeyRow & { readonly account: string }

/** A passkey row as the API shows it; `current` is the one that signed in the session asking. */
export const toPasskey = (row: PasskeyRow, current?: string) =>
  new Passkey({
    id: row.id as PasskeyId,
    role: row.role,
    status: row.status,
    label: row.label,
    synced: row.synced,
    current: row.id === current,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt
  })

const toUser = (row: typeof users.$inferSelect) =>
  new User({
    id: row.id as UserId,
    displayName: row.displayName,
    eligibility: row.eligibility,
    timeZone: row.timeZone,
    createdAt: row.createdAt
  })

/**
 * Users, their passkeys and their Kernel accounts. The account's owners are its active `owner` passkeys, each
 * installed on Namera's `WebAuthnValidator` with a threshold of one, so any of them signs.
 */
export class Accounts extends Context.Service<Accounts, {
  /**
   * Creates the user, their first passkey and their Kernel account (address computed from the passkey, offline) in
   * one transaction.
   */
  readonly register: (input: {
    readonly displayName: string | undefined
    readonly passkey: NewPasskey
    readonly label: string
  }) => Effect.Effect<{ readonly me: Me; readonly passkeyId: PasskeyId }>
  /** The user and their account, with whether it is deployed yet. */
  readonly me: (userId: UserId) => Effect.Effect<Me>
  readonly setEligibility: (userId: UserId, eligibility: Eligibility) => Effect.Effect<User>
  readonly setDisplayName: (userId: UserId, displayName: string | null) => Effect.Effect<User>
  /** Sets the user's time zone; `InvalidRequest` for a name that is no IANA zone. */
  readonly setTimeZone: (userId: UserId, timeZone: string) => Effect.Effect<User, InvalidRequest>
  /**
   * The account's owner passkeys, oldest first: those that own it and those on their way in or out (not one prepared
   * but never signed), marking the one that signed in the current session.
   */
  readonly passkeys: (userId: UserId, current: PasskeyId) => Effect.Effect<ReadonlyArray<Passkey>>
  /** The stored passkey a sign-in names, if this site knows it. */
  readonly findPasskey: (credentialId: string) => Effect.Effect<Option.Option<PasskeyRow>>
  /** One of the account's owners (the oldest): any of them signs, so it prepares and follows operations. */
  readonly ownerPasskey: (userId: UserId) => Effect.Effect<Signer>
  /** The account's owner with this WebAuthn credential id, if it is one. */
  readonly ownerByCredential: (userId: UserId, credentialId: string) => Effect.Effect<Option.Option<Signer>>
  /** The account's owners, oldest first. */
  readonly owners: (userId: UserId) => Effect.Effect<ReadonlyArray<PasskeyRow>>
  /** One of the user's passkeys, by id. */
  readonly passkey: (userId: UserId, id: string) => Effect.Effect<Option.Option<PasskeyRow>>
  /** Stores a new passkey of the user's, not yet onchain (`pending`). */
  readonly insertPasskey: (userId: UserId, input: {
    readonly passkey: NewPasskey
    readonly label: string
    readonly role: PasskeyRow["role"]
  }) => Effect.Effect<PasskeyRow>
  readonly savePasskey: (id: string, changes: Partial<PasskeyRow>) => Effect.Effect<PasskeyRow>
  /** Passkeys with an owner operation on its way, everyone's. */
  readonly passkeysInFlight: Effect.Effect<ReadonlyArray<PasskeyRow>>
  readonly recordPasskeyUse: (id: string, counter: number) => Effect.Effect<void>
}>()("@bluechip/server/Accounts") {
  static readonly layer = Layer.effect(
    Accounts,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const namera = yield* Namera
      const analytics = yield* Analytics

      const register = Effect.fn("Accounts.register")(function*(input: {
        readonly displayName: string | undefined
        readonly passkey: NewPasskey
        readonly label: string
      }) {
        const owner = toWebAuthnAccount({
          credential: { id: input.passkey.credentialId, publicKey: input.passkey.publicKey }
        })
        const kernel = yield* namera.kernelAccount(owner).pipe(Effect.orDie)
        const now = yield* DateTime.now
        const userId = typeid("user").toString() as `user_${string}`
        const passkeyId = typeid("passkey").toString() as `passkey_${string}`

        const user = yield* db.transaction((tx) =>
          Effect.gen(function*() {
            const [user] = yield* tx.insert(users).values({
              id: userId,
              displayName: input.displayName ?? null,
              createdAt: now
            }).returning()
            yield* tx.insert(passkeys).values({
              id: passkeyId,
              userId,
              credentialId: input.passkey.credentialId,
              coseKey: input.passkey.coseKey,
              publicKey: input.passkey.publicKey,
              counter: input.passkey.counter,
              transports: [...input.passkey.transports],
              label: input.label,
              synced: input.passkey.synced,
              createdAt: now,
              lastUsedAt: now
            })
            yield* tx.insert(accounts).values({ userId, address: kernel.address, createdAt: now })
            return user!
          })
        ).pipe(Effect.orDie)

        const me = new Me({
          user: toUser(user),
          account: new Account({ address: kernel.address as Address, deployed: false })
        })
        yield* count(UsersSignedUp, {})
        return { me, passkeyId: passkeyId as PasskeyId }
      })

      const me = Effect.fn("Accounts.me")(function*(userId: UserId) {
        const [row] = yield* db.select().from(users).innerJoin(accounts, eq(accounts.userId, users.id))
          .where(eq(users.id, userId as `user_${string}`))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* Effect.die(new Error(`no account for ${userId}`))

        const address = row.accounts.address as Address
        if (row.accounts.deployedAt !== null) {
          return new Me({ user: toUser(row.users), account: new Account({ address, deployed: true }) })
        }

        // `null` when the chain can't be read (the local fork may be off), so a down chain never blocks signing in.
        const deployed = yield* SmartAccount.detect(chain.client, { address: address as `0x${string}` }).pipe(
          Effect.map((detected) => detected.type !== "undeployed"),
          Effect.timeout("3 seconds"),
          Effect.orElseSucceed(() => null)
        )
        if (deployed === true) {
          yield* db.update(accounts).set({ deployedAt: yield* DateTime.now })
            .where(eq(accounts.userId, row.accounts.userId))
            .pipe(Effect.orDie)
        }
        return new Me({ user: toUser(row.users), account: new Account({ address, deployed }) })
      })

      const setEligibility = Effect.fn("Accounts.setEligibility")(
        function*(userId: UserId, eligibility: Eligibility) {
          const [row] = yield* db.update(users).set({ eligibility }).where(eq(users.id, userId as `user_${string}`))
            .returning()
            .pipe(Effect.orDie)
          yield* count(UsersEligibility, { answer: eligibility })
          if (eligibility !== "unknown") {
            const answer = eligibility === "us" ? "us_person" as const : "eligible" as const
            yield* analytics.capture(userId, { _tag: "eligibility_answered", answer }, {
              id: `${userId}:${answer}`,
              set: { eligibility: answer }
            })
          }
          return toUser(row!)
        }
      )

      const setDisplayName = Effect.fn("Accounts.setDisplayName")(
        function*(userId: UserId, displayName: string | null) {
          const [row] = yield* db.update(users).set({ displayName: displayName?.trim() || null })
            .where(eq(users.id, userId as `user_${string}`))
            .returning()
            .pipe(Effect.orDie)
          return toUser(row!)
        }
      )

      const setTimeZone = Effect.fn("Accounts.setTimeZone")(function*(userId: UserId, timeZone: string) {
        if (Option.isNone(zoneOf(timeZone))) return yield* new InvalidRequest({ field: "timeZone", problem: "invalid" })
        const [row] = yield* db.update(users).set({ timeZone }).where(eq(users.id, userId as `user_${string}`))
          .returning()
          .pipe(Effect.orDie)
        return toUser(row!)
      })

      const listPasskeys = Effect.fn("Accounts.passkeys")(function*(userId: UserId, current: PasskeyId) {
        const rows = yield* db.select().from(passkeys).where(and(
          eq(passkeys.userId, userId as `user_${string}`),
          eq(passkeys.role, "owner"),
          ne(passkeys.status, "removed")
        )).orderBy(asc(passkeys.createdAt)).pipe(Effect.orDie)
        return rows.filter((row) => row.status !== "pending" || row.userOpHash !== null)
          .map((row) => toPasskey(row, current))
      })

      const findPasskey = Effect.fn("Accounts.findPasskey")(function*(credentialId: string) {
        const [row] = yield* db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).pipe(
          Effect.orDie
        )
        return Option.fromNullishOr(row)
      })

      const addressOf = Effect.fnUntraced(function*(userId: UserId) {
        const [row] = yield* db.select({ address: accounts.address }).from(accounts)
          .where(eq(accounts.userId, userId as `user_${string}`)).pipe(Effect.orDie)
        if (row === undefined) return yield* Effect.die(new Error(`no account for ${userId}`))
        return row.address
      })

      const owners = Effect.fn("Accounts.owners")(function*(userId: UserId) {
        return yield* db.select().from(passkeys).where(and(
          eq(passkeys.userId, userId as `user_${string}`),
          eq(passkeys.role, "owner"),
          eq(passkeys.status, "active")
        )).orderBy(asc(passkeys.createdAt)).pipe(Effect.orDie)
      })

      const ownerPasskey = Effect.fn("Accounts.ownerPasskey")(function*(userId: UserId) {
        const [row] = yield* owners(userId)
        if (row === undefined) return yield* Effect.die(new Error(`no owner passkey for ${userId}`))
        return { ...row, account: yield* addressOf(userId) }
      })

      const ownerByCredential = Effect.fn("Accounts.ownerByCredential")(
        function*(userId: UserId, credentialId: string) {
          const row = (yield* owners(userId)).find((owner) => owner.credentialId === credentialId)
          return row === undefined ? Option.none<Signer>() : Option.some({ ...row, account: yield* addressOf(userId) })
        }
      )

      const passkey = Effect.fn("Accounts.passkey")(function*(userId: UserId, id: string) {
        const [row] = yield* db.select().from(passkeys).where(and(
          eq(passkeys.userId, userId as `user_${string}`),
          eq(passkeys.id, id as `passkey_${string}`)
        )).pipe(Effect.orDie)
        return Option.fromNullishOr(row)
      })

      const insertPasskey = Effect.fn("Accounts.insertPasskey")(function*(userId: UserId, input: {
        readonly passkey: NewPasskey
        readonly label: string
        readonly role: PasskeyRow["role"]
      }) {
        const now = yield* DateTime.now
        const [row] = yield* db.insert(passkeys).values({
          id: typeid("passkey").toString() as `passkey_${string}`,
          userId: userId as `user_${string}`,
          credentialId: input.passkey.credentialId,
          coseKey: input.passkey.coseKey,
          publicKey: input.passkey.publicKey,
          counter: input.passkey.counter,
          transports: [...input.passkey.transports],
          label: input.label,
          synced: input.passkey.synced,
          role: input.role,
          status: "pending",
          createdAt: now
        }).returning().pipe(Effect.orDie)
        return row!
      })

      const savePasskey = Effect.fn("Accounts.savePasskey")(function*(id: string, changes: Partial<PasskeyRow>) {
        const [row] = yield* db.update(passkeys).set(changes).where(eq(passkeys.id, id as `passkey_${string}`))
          .returning().pipe(Effect.orDie)
        return row!
      })

      const passkeysInFlight = db.select().from(passkeys).where(isNotNull(passkeys.userOpHash)).pipe(Effect.orDie)

      const recordPasskeyUse = Effect.fn("Accounts.recordPasskeyUse")(function*(id: string, counter: number) {
        yield* db.update(passkeys).set({ counter, lastUsedAt: yield* DateTime.now })
          .where(eq(passkeys.id, id as `passkey_${string}`))
          .pipe(Effect.orDie)
      })

      return Accounts.of({
        register,
        me,
        setEligibility,
        setDisplayName,
        setTimeZone,
        passkeys: listPasskeys,
        findPasskey,
        ownerPasskey,
        ownerByCredential,
        owners,
        passkey,
        insertPasskey,
        savePasskey,
        passkeysInFlight,
        recordPasskeyUse
      })
    })
  )
}
