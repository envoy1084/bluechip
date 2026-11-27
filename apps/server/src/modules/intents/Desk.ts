import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import type { ChainError } from "@bluechip/chain/ChainError"
import { refusalFrom } from "@bluechip/chain/policies/Refusals"
import { Conflict, NotFound, SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import type { Address, SigningRequestId, UserId } from "@bluechip/domain/Ids"
import { type IntentStatus, isEnded, type WaitReason } from "@bluechip/domain/intents/Intent"
import { Trade } from "@bluechip/domain/trading/Trade"
import { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import * as Array from "effect/Array"
import * as ClusterSchema from "effect/cluster/ClusterSchema"
import * as Entity from "effect/cluster/Entity"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Rpc from "effect/rpc/Rpc"
import * as Schema from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"
import * as Workflow from "effect/workflow/Workflow"
import { typeid } from "typeid-js"
import type { Hex } from "viem"
import { Accounts } from "../accounts/Accounts.ts"
import type { SessionRow } from "../agents/AgentSessions.ts"
import { AgentStore } from "../agents/AgentStore.ts"
import { shareOf } from "../signing/OwnerOperations.ts"
import type { TradeRow } from "../trading/TradeLedger.ts"
import { TradeLedger } from "../trading/TradeLedger.ts"
import { Trades } from "../trading/Trades.ts"
import { AgentExecutor, type Decided } from "./AgentExecutor.ts"
import { type IntentRow, IntentStore } from "./IntentStore.ts"

// Waits that hold for every leg of an operation alike: the legs wait together instead of trying one by one.
const TOGETHER: ReadonlyArray<WaitReason> = ["dayEnding", "pricesPaused", "pricesStale", "noGas"]

// Intents not decided yet, or deciding again.
const PENDING: ReadonlyArray<IntentStatus> = ["proposed", "waiting", "deciding"]

/** What one step of an intent left to do: nothing, or decide it again at `until`. */
export const StepResult = Schema.TaggedUnion({
  Done: {},
  WaitUntil: { until: Schema.DateTimeUtc }
})

export type StepResult = typeof StepResult.Type

/**
 * One account's trading desk: an entity per user, so its intents are decided and sent one at a time, yours and its
 * agents' alike (an agent's buy and your own sale never race on the same balances). `Step` runs one intent as far as
 * it can go now; `Send` sends a trade you signed with your passkey. A send is never replayed after a restart: the
 * passkey's signature is claimed once.
 */
export const AccountDesk = Entity.make("AccountDesk", [
  Rpc.make("Step", { payload: { intentId: Schema.String }, success: StepResult })
    .annotate(ClusterSchema.Persisted, true),
  Rpc.make("Send", {
    payload: {
      userId: Schema.String,
      account: Schema.String,
      signingRequestId: Schema.String,
      credential: AuthenticationCredential
    },
    success: Trade,
    error: Schema.Union([NotFound, Conflict, SignatureRejected, Unavailable])
  })
])

/**
 * The desk's handler: steps run one at a time per account. A step runs one agent intent as far as it can go now:
 * cancelled when its agent is no longer trading, expired when it waited too long, otherwise decided against the
 * agent's policies and, when it passes, sent by the agent's key and followed to its fill. An intent of a plan of
 * several trades goes out with the other legs of its wave in one operation, after the plan's earlier operations.
 * Every step is saved first, so running it again after a restart picks up where it stopped.
 */
export const AccountDeskLive = AccountDesk.toLayer(Effect.gen(function*() {
  const intents = yield* IntentStore
  const agentStore = yield* AgentStore
  const accounts = yield* Accounts
  const executor = yield* AgentExecutor
  const ledger = yield* TradeLedger
  const trades = yield* Trades
  const deployment = yield* ChainDeployment
  const done: StepResult = StepResult.cases.Done.make({})
  const waitUntil = (until: DateTime.Utc): StepResult => StepResult.cases.WaitUntil.make({ until })
  const earliest = (results: ReadonlyArray<StepResult>): StepResult =>
    results.reduce<StepResult>(
      (soonest, result) =>
        result._tag === "WaitUntil" && (soonest._tag === "Done" || DateTime.isLessThan(result.until, soonest.until)) ?
          result :
          soonest,
      done
    )

  // The intents sent in `row`'s operation: its own, or every leg of its plan that went with it.
  const operationOf = Effect.fnUntraced(function*(row: IntentRow) {
    if (row.batchId === null) return [row]
    return (yield* intents.batch(row.userId, row.batchId)).filter((other) => other.userOpHash === row.userOpHash)
  })

  // Follows a sent operation to its receipt, records each of its trades (the operation's gas shared between them),
  // and ends their intents.
  const finish = Effect.fnUntraced(function*(operation: ReadonlyArray<IntentRow>, account: Hex, session: SessionRow) {
    const receipt = yield* executor.wait(operation[0]!.agentId!, session, operation[0]!.userOpHash as Hex)

    for (const [index, sent] of operation.entries()) {
      if (isEnded(sent.status)) continue
      let row = sent
      // Stopped between sending and saving that the bundler took it: a receipt says it did.
      if (row.status === "sending" && receipt !== undefined) row = yield* intents.advance(row, { _tag: "Accepted" })
      const trade = yield* ledger.row(row.tradeId!)
      const settled = trade === undefined ?
        undefined :
        yield* ledger.settle(trade, account, receipt && shareOf(receipt, index, operation.length))
      const status = settled?.status ?? (receipt?.success === true ? "filled" : "failed")
      yield* intents.advance(row, { _tag: status === "filled" ? "Filled" : "Failed" })
    }
  })

  // An intent that asks you first (an automation's, or one proposing your own trade) goes to your approvals; an
  // agent's is cancelled instead when the agent can't trade.
  const ask = Effect.fnUntraced(function*(row: IntentRow) {
    if (row.status !== "proposed") return done
    if (row.agentId !== null && !(yield* agentStore.tradingState(row.agentId)).canTrade) {
      yield* intents.advance(row, { _tag: "Cancelled" }).pipe(Effect.ignore)
      return done
    }
    const deciding = yield* intents.advance(row, { _tag: "Decide" })
    yield* intents.advance(deciding, { _tag: "Decided", decision: { _tag: "Ask" } }, {
      expiresAt: DateTime.add(yield* DateTime.now, { hours: 6 })
    })
    return done
  })

  // Signs one operation for every leg decided together, records a trade per leg, sends it and follows it to its fill.
  const send = Effect.fnUntraced(function*(
    rows: ReadonlyArray<IntentRow>,
    decided: Decided,
    context: { readonly agentId: string; readonly address: Hex; readonly session: SessionRow }
  ) {
    const now = yield* DateTime.now
    const signed = yield* executor.sign(context.agentId, context.session, decided.calls!, decided.gas!)
    const recorded: Array<{ readonly row: IntentRow; readonly trade: TradeRow }> = []
    for (const [index, row] of rows.entries()) {
      const quote = decided.quotes![index]!
      const trade = yield* ledger.record({
        id: typeid("trade").toString() as `trade_${string}`,
        userId: row.userId,
        intentId: row.id,
        agentId: context.agentId as `agent_${string}`,
        source: "agent",
        symbol: quote.symbol,
        side: quote.side,
        status: "confirming",
        usdc: quote.usdc,
        shares: quote.shares,
        price: quote.price,
        reference: quote.reference.price,
        referenceStatus: quote.reference.status,
        gapBps: quote.gapBps,
        userOpHash: signed.hash,
        createdAt: now
      })
      const sending = yield* intents.advance(
        row,
        { _tag: "Decided", decision: decided.decision },
        { userOpHash: signed.hash, tradeId: trade.id }
      )
      recorded.push({ row: sending, trade })
    }

    const sent = yield* signed.send.pipe(Effect.result)
    if (sent._tag === "Failure") {
      // Refused at the door (nothing was spent): said as the policy that refused it when one did.
      const refusal = refusalFrom(deployment, sent.failure.cause)
      yield* Effect.logWarning(`Intents ${rows.map((row) => row.id)}: the bundler refused the agent's operation`)
      for (const { row, trade } of recorded) {
        yield* ledger.settle(trade, context.address, undefined)
        yield* intents.advance(
          row,
          { _tag: "Failed" },
          refusal === undefined ? {} : { decision: { _tag: "Refused", ...refusal } }
        )
      }
      return done
    }

    const accepted = []
    for (const { row } of recorded) accepted.push(yield* intents.advance(row, { _tag: "Accepted" }))
    yield* finish(accepted, context.address, context.session)
    return done
  })

  // Decides `rows` (one agent's legs, one per stock) together and sends them in one operation when they pass. A wait
  // that holds for every leg keeps them waiting together; anything else that stops a batch (a refusal, one leg over
  // the largest trade, gas, Base not answering) decides each leg on its own instead, so one leg doesn't hold the rest.
  const run: (
    rows: ReadonlyArray<IntentRow>,
    context: { readonly agentId: string; readonly address: Hex; readonly session: SessionRow }
  ) => Effect.Effect<StepResult, ChainError | Conflict> = Effect.fnUntraced(function*(rows, context) {
    const now = yield* DateTime.now
    const live: Array<IntentRow> = []
    for (const row of rows) {
      if (row.status === "waiting" && row.expiresAt !== null && DateTime.isLessThan(row.expiresAt, now)) {
        yield* intents.advance(row, { _tag: "Expired" }).pipe(Effect.ignore)
      } else {
        live.push(row)
      }
    }
    if (live.length === 0) return done

    // Decided by another leg's step already, and not due yet.
    const due = (row: IntentRow) =>
      row.status !== "waiting" || row.retryAt === null || DateTime.isLessThan(row.retryAt, now)
    if (!live.some(due)) return earliest(live.map((row) => waitUntil(row.retryAt!)))

    const deciding: Array<IntentRow> = []
    for (const row of live) {
      deciding.push(
        row.status === "deciding"
          ? row
          : yield* intents.advance(row, { _tag: "Decide" }, { sessionId: context.session.id })
      )
    }
    const decided = yield* executor.decide({
      agentId: context.agentId,
      account: context.address,
      session: context.session,
      legs: deciding.map((row) => row.leg)
    })
    const decision = decided.decision

    if (decision._tag === "Passes") return yield* send(deciding, decided, context)
    if (decision._tag === "Wait" && (deciding.length === 1 || TOGETHER.includes(decision.reason))) {
      for (const row of deciding) {
        yield* intents.advance(row, { _tag: "Decided", decision }, { retryAt: decision.until })
      }
      return waitUntil(decision.until)
    }
    if (deciding.length === 1) {
      const approval = decision._tag === "OverLargestTrade"
      yield* intents.advance(
        deciding[0]!,
        { _tag: "Decided", decision },
        approval ? { expiresAt: DateTime.add(now, { hours: 6 }) } : {}
      )
      return done
    }

    yield* Effect.logInfo(`Intents ${deciding.map((row) => row.id)}: not sent together (${decision._tag}), one by one`)
    const results: Array<StepResult> = []
    for (const row of deciding) results.push(yield* run([row], context))
    return earliest(results)
  })

  const step = Effect.fn("AccountDesk.step")(function*(intentId: string) {
    const row = yield* intents.find(intentId)
    if (row === undefined || isEnded(row.status)) return done
    if (row.ask || row.executor === "owner") return yield* ask(row)

    const { agent, canTrade, session } = yield* agentStore.tradingState(row.agentId!)
    const address = (yield* accounts.me(row.userId as UserId)).account.address as Hex

    // A sent operation is only ever followed, never sent again.
    if (row.userOpHash !== null && session !== undefined) {
      yield* finish(yield* operationOf(row), address, session)
      return done
    }

    // A plan's earlier operations go first; each leg still to decide goes with the others of its wave.
    const batch = row.batchId === null ? [row] : yield* intents.batch(row.userId, row.batchId)
    const waves = Array.dedupe(batch.map((other) => other.wave ?? 0)).filter((wave) => wave <= (row.wave ?? 0))
    let result: StepResult = done
    for (const wave of waves) {
      const pending = batch.filter((other) =>
        (other.wave ?? 0) === wave && other.userOpHash === null && !other.ask && PENDING.includes(other.status)
      )
      if (pending.length === 0) continue

      if (!canTrade) {
        for (const other of pending) yield* intents.advance(other, { _tag: "Cancelled" }).pipe(Effect.ignore)
        continue
      }
      result = yield* run(pending, { agentId: agent!.id, address, session: session! })
      if (result._tag === "WaitUntil" && wave < (row.wave ?? 0)) return result
    }
    return result
  })

  return AccountDesk.of({
    Send: ({ payload }) =>
      trades.confirm(
        { id: payload.userId as UserId, account: payload.account as Address },
        payload.signingRequestId as SigningRequestId,
        payload.credential
      ),
    Step: ({ payload }) =>
      step(payload.intentId).pipe(
        // A step that failed (the database, a bug) is tried again in a minute, not straight away.
        Effect.catch((error) =>
          Effect.logWarning(`Intent ${payload.intentId} step failed`, error).pipe(
            Effect.andThen(DateTime.now),
            Effect.map((now) => StepResult.cases.WaitUntil.make({ until: DateTime.add(now, { minutes: 1 }) }))
          )
        )
      )
  })
}))

/**
 * An agent intent from start to end: each step runs on the account's desk; while it waits (prices, gas, the end of
 * a day), the workflow sleeps durably and steps again. One execution per intent, however often it is started.
 */
export const ExecuteIntent = Workflow.make("ExecuteIntent", {
  payload: { intentId: Schema.String, userId: Schema.String },
  idempotencyKey: ({ intentId }) => intentId
})

export const ExecuteIntentLive = ExecuteIntent.toLayer(Effect.fnUntraced(function*({ intentId, userId }) {
  const desk = yield* AccountDesk.client
  for (let attempt = 0;; attempt++) {
    const result = yield* Activity.make({
      name: `step-${attempt}`,
      success: StepResult,
      execute: desk(userId).Step({ intentId }).pipe(Effect.orDie)
    })
    if (result._tag === "Done") return

    const wait = DateTime.distance(yield* DateTime.now, result.until)
    yield* DurableClock.sleep({ name: `wait-${attempt}`, duration: wait })
  }
}))

export const DeskLive = Layer.mergeAll(AccountDeskLive, ExecuteIntentLive)
