import { ChainClient } from "@bluechip/chain/ChainClient"
import { Account, type Eligibility, Me, Passkey, User } from "@bluechip/domain/Account"
import type { Address, PasskeyId, UserId } from "@bluechip/domain/Ids"
import * as SmartAccount from "@namera-ai/sdk/effect/accounts/SmartAccount"
import { eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { toWebAuthnAccount } from "viem/account-abstraction"
import type { NewPasskey } from "../auth/WebAuthn.ts"
import { Database } from "../db/Database.ts"
import { accounts, passkeys, users } from "../db/schema/accounts.ts"
import { Namera } from "../Namera.ts"

type PasskeyRow = typeof passkeys.$inferSelect

const toUser = (row: typeof users.$inferSelect) =>
  new User({
    id: row.id as UserId,
    displayName: row.displayName,
    eligibility: row.eligibility,
    createdAt: row.createdAt
  })

/** Users, their passkeys and their Kernel accounts. */
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
  /** The user's passkeys, marking the one that signed in the current session. */
  readonly passkeys: (userId: UserId, current: PasskeyId) => Effect.Effect<ReadonlyArray<Passkey>>
  /** The stored passkey a sign-in names, if this site knows it. */
  readonly findPasskey: (credentialId: string) => Effect.Effect<Option.Option<PasskeyRow>>
  /** The passkey the account was created with: the one its validator checks. */
  readonly ownerPasskey: (userId: UserId) => Effect.Effect<PasskeyRow>
  readonly recordPasskeyUse: (id: string, counter: number) => Effect.Effect<void>
}>()("@bluechip/server/Accounts") {
  static readonly layer = Layer.effect(
    Accounts,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const namera = yield* Namera

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

      const listPasskeys = Effect.fn("Accounts.passkeys")(function*(userId: UserId, current: PasskeyId) {
        const rows = yield* db.select().from(passkeys).where(eq(passkeys.userId, userId as `user_${string}`))
          .orderBy(passkeys.createdAt)
          .pipe(Effect.orDie)
        return rows.map((row) =>
          new Passkey({
            id: row.id as PasskeyId,
            label: row.label,
            synced: row.synced,
            current: row.id === current,
            createdAt: row.createdAt,
            lastUsedAt: row.lastUsedAt
          })
        )
      })

      const findPasskey = Effect.fn("Accounts.findPasskey")(function*(credentialId: string) {
        const [row] = yield* db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).pipe(
          Effect.orDie
        )
        return Option.fromNullishOr(row)
      })

      const ownerPasskey = Effect.fn("Accounts.ownerPasskey")(function*(userId: UserId) {
        const [row] = yield* db.select().from(passkeys).where(eq(passkeys.userId, userId as `user_${string}`))
          .orderBy(passkeys.createdAt).limit(1).pipe(Effect.orDie)
        if (row === undefined) return yield* Effect.die(new Error(`no passkey for ${userId}`))
        return row
      })

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
        passkeys: listPasskeys,
        findPasskey,
        ownerPasskey,
        recordPasskeyUse
      })
    })
  )
}
