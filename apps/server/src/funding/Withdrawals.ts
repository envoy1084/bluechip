import { ChainClient } from "@bluechip/chain/ChainClient"
import { usdc } from "@bluechip/chain/Contracts"
import { assetTokens } from "@bluechip/chain/funding/Balances"
import {
  type Conflict,
  InsufficientCash,
  InvalidRequest,
  type NotFound,
  type SignatureRejected,
  Unavailable
} from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { SigningRequest } from "@bluechip/domain/portfolio/Transfer"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { and, eq, isNotNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { encodeFunctionData, erc20Abi, getAddress, type Hex, isAddress, zeroAddress } from "viem"
import type { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { transfers } from "../db/schema/funding.ts"
import { LiveEvents } from "../live/LiveEvents.ts"
import type { Namera } from "../Namera.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { type OwnerPasskey, sendOperation, waitForOperation } from "../signing/OwnerOperations.ts"
import {
  claimSigningRequest,
  createSigningRequest,
  findPrepared,
  type Owner,
  ownerPasskey,
  type SigningRequestRow,
  webAuthnOptions
} from "../signing/SigningRequests.ts"
import { toTransfer } from "./TransferRecords.ts"

const toSigningRequest = Effect.fnUntraced(function*(row: SigningRequestRow) {
  return new SigningRequest({
    id: row.id as SigningRequestId,
    options: yield* webAuthnOptions(row),
    withdrawal: { amount: Usdc.make(BigInt(row.payload["amount"]!)), to: row.payload["to"] as Address },
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

        const existing = yield* findPrepared(
          owner,
          input.requestId,
          (payload) => payload["to"] === to && payload["amount"] === input.amount.toString()
        )
        if (Option.isSome(existing)) return yield* toSigningRequest(existing.value)

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

        const row = yield* createSigningRequest(owner, {
          requestId: input.requestId,
          kind: "withdrawal",
          payload: { amount: input.amount.toString(), to },
          calls: [{
            to: usdc,
            data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, input.amount] })
          }]
        })
        return yield* toSigningRequest(row)
      }, Effect.provideContext(context))

      const confirm = Effect.fn("Withdrawals.confirm")(function*(
        owner: Owner,
        id: SigningRequestId,
        credential: typeof AuthenticationCredential.Type
      ) {
        const { passkey, request } = yield* claimSigningRequest(owner, id, "withdrawal", credential)
        const userOpHash = yield* sendOperation(passkey, request.userOperation, credential)

        const [row] = yield* db.insert(transfers).values({
          id: typeid("transfer").toString() as `transfer_${string}`,
          userId: owner.id as `user_${string}`,
          kind: "withdrawal",
          asset: "USDC",
          amount: BigInt(request.payload["amount"]!),
          from: owner.account,
          to: request.payload["to"]!,
          status: "pending",
          userOpHash,
          createdAt: yield* DateTime.now
        }).returning().pipe(Effect.orDie)

        yield* track(row!.id, owner, passkey, userOpHash)
        return toTransfer(row!)
      }, Effect.provideContext(context))

      return { prepare, confirm }
    })
  )
}
