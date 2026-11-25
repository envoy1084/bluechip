import { ChainClient } from "@bluechip/chain/ChainClient"
import { Account, type Eligibility, Me, Passkey, User } from "@bluechip/domain/Account"
import type { Address, PasskeyId, UserId } from "@bluechip/domain/Ids"
import * as SmartAccount from "@namera-ai/sdk/effect/accounts/SmartAccount"
import { eq } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { toWebAuthnAccount } from "viem/account-abstraction"
import type { NewPasskey } from "../auth/WebAuthn.ts"
import { Database } from "../db/Database.ts"
import { accounts, passkeys, users } from "../db/schema/accounts.ts"
import { Namera } from "../Namera.ts"

type UserRow = typeof users.$inferSelect
type PasskeyRow = typeof passkeys.$inferSelect

const toUser = (row: UserRow) =>
  new User({
    id: row.id as UserId,
    displayName: row.displayName,
    eligibility: row.eligibility,
    createdAt: row.createdAt
  })

const toPasskey = (row: PasskeyRow) =>
  new Passkey({ id: row.id as PasskeyId, label: row.label, createdAt: row.createdAt, lastUsedAt: row.lastUsedAt })

/**
 * Whether the Kernel account has code on chain; `null` when the chain can't be read (the local fork may be off), so
 * a down chain never blocks signing in.
 */
const isDeployed = Effect.fnUntraced(
  function*(address: Address) {
    const chain = yield* ChainClient
    const detected = yield* SmartAccount.detect(chain.client, { address: address as `0x${string}` })
    return detected.type !== "undeployed"
  },
  Effect.timeout("3 seconds"),
  Effect.orElseSucceed(() => null)
)

/**
 * Creates the user, their first passkey and their Kernel account (address computed from the passkey, offline) in one
 * transaction.
 */
export const registerUser = Effect.fn("Accounts.register")(
  function*(input: { readonly displayName: string | undefined; readonly passkey: NewPasskey }) {
    const db = yield* Database
    const namera = yield* Namera
    const owner = toWebAuthnAccount({
      credential: { id: input.passkey.credentialId, publicKey: input.passkey.publicKey }
    })
    const kernel = yield* namera.kernelAccount(owner).pipe(Effect.orDie)
    const now = yield* DateTime.now
    const userId = typeid("user").toString() as `user_${string}`
    const user = yield* db.transaction((tx) =>
      Effect.gen(function*() {
        const [user] = yield* tx.insert(users).values({
          id: userId,
          displayName: input.displayName ?? null,
          createdAt: now
        })
          .returning()
        yield* tx.insert(passkeys).values({
          id: typeid("passkey").toString() as `passkey_${string}`,
          userId,
          credentialId: input.passkey.credentialId,
          coseKey: input.passkey.coseKey,
          publicKey: input.passkey.publicKey,
          counter: input.passkey.counter,
          transports: [...input.passkey.transports],
          createdAt: now,
          lastUsedAt: now
        })
        yield* tx.insert(accounts).values({ userId, address: kernel.address, createdAt: now })
        return user!
      })
    ).pipe(Effect.orDie)
    return new Me({ user: toUser(user), account: new Account({ address: kernel.address as Address, deployed: false }) })
  }
)

/** The user and their account, with whether it is deployed yet. */
export const findMe = Effect.fn("Accounts.me")(function*(userId: UserId) {
  const db = yield* Database
  const [row] = yield* db.select().from(users).innerJoin(accounts, eq(accounts.userId, users.id))
    .where(eq(users.id, userId as `user_${string}`))
    .pipe(Effect.orDie)
  if (row === undefined) return yield* Effect.die(new Error(`no account for ${userId}`))
  const address = row.accounts.address as Address
  return new Me({ user: toUser(row.users), account: new Account({ address, deployed: yield* isDeployed(address) }) })
})

export const setEligibility = Effect.fn("Accounts.setEligibility")(function*(userId: UserId, eligibility: Eligibility) {
  const db = yield* Database
  const [row] = yield* db.update(users).set({ eligibility }).where(eq(users.id, userId as `user_${string}`)).returning()
    .pipe(Effect.orDie)
  return toUser(row!)
})

export const listPasskeys = Effect.fn("Accounts.passkeys")(function*(userId: UserId) {
  const db = yield* Database
  const rows = yield* db.select().from(passkeys).where(eq(passkeys.userId, userId as `user_${string}`))
    .orderBy(passkeys.createdAt)
    .pipe(Effect.orDie)
  return rows.map(toPasskey)
})

/** The stored passkey a sign-in names, if this site knows it. */
export const findPasskey = Effect.fn("Accounts.findPasskey")(function*(credentialId: string) {
  const db = yield* Database
  const [row] = yield* db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).pipe(Effect.orDie)
  return Option.fromNullishOr(row)
})

export const recordPasskeyUse = Effect.fn("Accounts.recordPasskeyUse")(function*(id: string, counter: number) {
  const db = yield* Database
  yield* db.update(passkeys).set({ counter, lastUsedAt: yield* DateTime.now })
    .where(eq(passkeys.id, id as `passkey_${string}`))
    .pipe(Effect.orDie)
})
