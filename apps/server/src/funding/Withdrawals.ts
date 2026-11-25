import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import { assetTokens } from "@bluechip/chain/funding/Balances"
import {
  Conflict,
  InsufficientCash,
  InvalidRequest,
  NotFound,
  SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { SigningRequest } from "@bluechip/domain/portfolio/Transfer"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { encodeFunctionData, erc20Abi, getAddress, type Hex, isAddress, zeroAddress } from "viem"
import { recordPasskeyUse } from "../accounts/Accounts.ts"
import { verifyAuthentication } from "../auth/WebAuthn.ts"
import { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { passkeys } from "../db/schema/accounts.ts"
import { signingRequests, transfers } from "../db/schema/funding.ts"
import { LiveEvents } from "../live/LiveEvents.ts"
import type { Namera } from "../Namera.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import {
  challengeOf,
  type OwnerPasskey,
  prepareOperation,
  sendOperation,
  waitForOperation
} from "../signing/OwnerOperations.ts"
import { toTransfer } from "./TransferRecords.ts"

// Long enough to read the amount and approve with Face ID; short enough that gas prices still hold.
const SIGNING_WINDOW = { minutes: 2 }

interface Owner {
  readonly id: UserId
  readonly account: Address
}

/** The passkey the account was created with: the one its validator checks. */
const ownerPasskey = Effect.fnUntraced(function*(userId: UserId) {
  const db = yield* Database
  const [row] = yield* db.select().from(passkeys).where(eq(passkeys.userId, userId as `user_${string}`))
    .orderBy(asc(passkeys.createdAt)).limit(1).pipe(Effect.orDie)
  if (row === undefined) return yield* Effect.die(new Error(`no passkey for ${userId}`))
  return row
})

const toSigningRequest = Effect.fnUntraced(function*(row: typeof signingRequests.$inferSelect) {
  const config = yield* AppConfig
  const passkey = yield* ownerPasskey(row.userId as UserId)
  return new SigningRequest({
    id: row.id as SigningRequestId,
    options: {
      challenge: challengeOf(row.hash as Hex),
      rpId: config.rpId,
      allowCredentials: [{ id: passkey.credentialId, type: "public-key", transports: passkey.transports }],
      userVerification: "required",
      timeout: 120_000
    },
    withdrawal: { amount: Usdc.make(BigInt(row.withdrawal.amount)), to: row.withdrawal.to as Address },
    deploysAccount: row.deploysAccount,
    expiresAt: row.expiresAt
  })
})

/**
 * USDC withdrawals, signed by the account's passkey: `prepare` builds the user operation and returns its hash for the
 * browser to sign, `confirm` checks that signature and sends it, then follows it to its receipt in the background
 * (pending withdrawals are picked up again after a restart).
 */
export class Withdrawals extends Context.Service<Withdrawals, {
  readonly prepare: (
    owner: Owner,
    input: { readonly requestId: string; readonly to: string; readonly amount: Usdc }
  ) => Effect.Effect<SigningRequest, InsufficientCash | InvalidRequest | Conflict | Unavailable>
  readonly confirm: (
    owner: Owner,
    id: SigningRequestId,
    credential: typeof AuthenticationCredential.Type
  ) => Effect.Effect<ReturnType<typeof toTransfer>, NotFound | SignatureRejected | Unavailable>
}>()("@bluechip/server/Withdrawals") {
  static readonly layer = Layer.effect(
    Withdrawals,
    Effect.gen(function*() {
      const db = yield* Database
      const chain = yield* ChainClient
      const live = yield* LiveEvents
      const balances = yield* AccountBalances
      const context = yield* Effect.context<Namera | Database | AppConfig>()
      const scope = yield* Effect.scope

      /** Follows a sent withdrawal to its receipt, then tells its owner and refreshes balances. */
      const track = Effect.fnUntraced(
        function*(transferId: string, owner: Owner, passkey: OwnerPasskey, userOpHash: Hex) {
          const outcome = yield* waitForOperation(passkey, userOpHash).pipe(Effect.result)
          const [row] = yield* db.update(transfers).set(
            outcome._tag === "Success"
              ? { status: outcome.success.success ? "confirmed" : "failed", txHash: outcome.success.txHash }
              : { status: "failed" }
          ).where(eq(transfers.id, transferId as `transfer_${string}`)).returning().pipe(Effect.orDie)
          // Fresh balances before the events, so a client that refetches on them already sees the money gone.
          yield* balances.invalidate(owner.account as Hex)
          if (row !== undefined) {
            yield* live.publish(LiveEvent.cases.TransferUpdated.make({ transfer: toTransfer(row) }), owner.id)
          }
          yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), owner.id)
        },
        Effect.provideContext(context),
        Effect.forkIn(scope),
        Effect.asVoid
      )

      const pending = yield* db.select().from(transfers)
        .where(and(eq(transfers.kind, "withdrawal"), eq(transfers.status, "pending"), isNotNull(transfers.userOpHash)))
        .pipe(Effect.orDie)
      for (const row of pending) {
        const passkey = yield* ownerPasskey(row.userId as UserId).pipe(Effect.provideContext(context))
        yield* track(row.id, { id: row.userId as UserId, account: row.from as Address }, passkey, row.userOpHash as Hex)
      }

      const prepare = Effect.fn("Withdrawals.prepare")(function*(
        owner: Owner,
        input: { readonly requestId: string; readonly to: string; readonly amount: Usdc }
      ) {
        if (!isAddress(input.to, { strict: false })) {
          return yield* new InvalidRequest({ field: "to", problem: "invalid" })
        }
        const to = getAddress(input.to)
        const refused = [zeroAddress, getAddress(owner.account), ...assetTokens.map((token) => getAddress(token))]
        if (refused.includes(to)) return yield* new InvalidRequest({ field: "to", problem: "notAllowed" })
        if (input.amount <= BigInt(0)) return yield* new InvalidRequest({ field: "amount", problem: "outOfRange" })

        const [existing] = yield* db.select().from(signingRequests).where(and(
          eq(signingRequests.userId, owner.id as `user_${string}`),
          eq(signingRequests.requestId, input.requestId)
        )).pipe(Effect.orDie)
        const now = yield* DateTime.now
        if (existing !== undefined) {
          const same = existing.withdrawal.to === to && existing.withdrawal.amount === input.amount.toString()
          if (!same || existing.usedAt !== null || DateTime.isGreaterThan(now, existing.expiresAt)) {
            return yield* new Conflict({ reason: "requestIdReused" })
          }
          return yield* toSigningRequest(existing)
        }

        const cash = yield* chain.use(
          "read cash",
          (client) =>
            client.readContract({
              address: usdc,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [owner.account as Hex]
            })
        ).pipe(Effect.catch(() => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 }))))
        if (input.amount > cash) return yield* new InsufficientCash({ available: cash })

        const passkey = yield* ownerPasskey(owner.id)
        const prepared = yield* prepareOperation(passkey, [{
          to: usdc,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, input.amount] })
        }])
        const [row] = yield* db.insert(signingRequests).values({
          id: typeid("signing").toString() as `signing_${string}`,
          userId: owner.id as `user_${string}`,
          requestId: input.requestId,
          withdrawal: { amount: input.amount.toString(), to },
          userOperation: prepared.userOperation,
          hash: prepared.hash,
          deploysAccount: prepared.deploysAccount,
          createdAt: now,
          expiresAt: DateTime.add(now, SIGNING_WINDOW)
        }).returning().pipe(Effect.orDie)
        return yield* toSigningRequest(row!)
      }, Effect.provideContext(context))

      const confirm = Effect.fn("Withdrawals.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const [request] = yield* db.select().from(signingRequests).where(and(
          eq(signingRequests.id, id as `signing_${string}`),
          eq(signingRequests.userId, owner.id as `user_${string}`)
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
        // Claim the request before sending, so a replayed signature can never send it twice.
        const claimed = yield* db.update(signingRequests).set({ usedAt: now })
          .where(and(eq(signingRequests.id, request.id), isNull(signingRequests.usedAt))).returning()
          .pipe(Effect.orDie)
        if (claimed.length === 0) return yield* new SignatureRejected({ reason: "challenge" })

        const userOpHash = yield* sendOperation(passkey, request.userOperation, credential)
        const [row] = yield* db.insert(transfers).values({
          id: typeid("transfer").toString() as `transfer_${string}`,
          userId: owner.id as `user_${string}`,
          kind: "withdrawal",
          asset: "USDC",
          amount: BigInt(request.withdrawal.amount),
          from: owner.account,
          to: request.withdrawal.to,
          status: "pending",
          userOpHash,
          createdAt: now
        }).returning().pipe(Effect.orDie)
        yield* track(row!.id, owner, passkey, userOpHash)
        return toTransfer(row!)
      }, Effect.provideContext(context))

      return { prepare, confirm }
    })
  )
}
