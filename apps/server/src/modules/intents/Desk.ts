import { refusalFrom } from "@bluechip/chain/policies/Refusals"
import type { UserId } from "@bluechip/domain/Ids"
import { isEnded } from "@bluechip/domain/intents/Intent"
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
import { TradeLedger } from "../trading/TradeLedger.ts"
import { AgentExecutor } from "./AgentExecutor.ts"
import { type IntentRow, IntentStore } from "./IntentStore.ts"

/** What one step of an intent left to do: nothing, or decide it again at `until`. */
export const StepResult = Schema.TaggedUnion({
  Done: {},
  WaitUntil: { until: Schema.DateTimeUtc }
})

export type StepResult = typeof StepResult.Type

/**
 * One account's trading desk: an entity per user, so its intents are decided and sent one at a time (an agent's
 * buy and another agent's sell never race on the same balances). `Step` runs one intent as far as it can go now.
 */
export const AccountDesk = Entity.make("AccountDesk", [
  Rpc.make("Step", { payload: { intentId: Schema.String }, success: StepResult })
    .annotate(ClusterSchema.Persisted, true)
])

/**
 * The desk's handler: steps run one at a time per account. A step runs one agent intent as far as it can go now:
 * cancelled when its agent is no longer trading, expired when it waited too long, otherwise decided against the
 * agent's policies and, when it passes, sent by the agent's key and followed to its fill. Every step is saved first,
 * so running it again after a restart picks up where it stopped.
 */
export const AccountDeskLive = AccountDesk.toLayer(Effect.gen(function*() {
  const intents = yield* IntentStore
  const agentStore = yield* AgentStore
  const accounts = yield* Accounts
  const executor = yield* AgentExecutor
  const ledger = yield* TradeLedger
  const done: StepResult = StepResult.cases.Done.make({})

  // Follows an agent's sent operation to its receipt, records the fill, and ends the intent.
  const finish = Effect.fnUntraced(function*(row: IntentRow, account: Hex, session: SessionRow) {
    const receipt = yield* executor.wait(row.agentId!, session, row.userOpHash as Hex)
    const trade = yield* ledger.row(row.tradeId!)
    const settled = trade === undefined ? undefined : yield* ledger.settle(trade, account, receipt)
    const status = settled?.status ?? (receipt?.success === true ? "filled" : "failed")
    yield* intents.advance(row, { _tag: status === "filled" ? "Filled" : "Failed" })
    return done
  })

  const step = Effect.fn("AccountDesk.step")(function*(intentId: string) {
    let row = yield* intents.find(intentId)
    if (row === undefined || isEnded(row.status) || row.executor !== "agent") return done

    const { agent, canTrade, session } = yield* agentStore.tradingState(row.agentId!)
    const address = (yield* accounts.me(row.userId as UserId)).account.address as Hex

    // A sent operation is only ever followed, never sent again.
    if (row.userOpHash !== null && session !== undefined) return yield* finish(row, address, session)

    if (!canTrade && ["proposed", "waiting", "deciding"].includes(row.status)) {
      yield* intents.advance(row, { _tag: "Cancelled" }).pipe(Effect.ignore)
      return done
    }
    if (!["proposed", "waiting", "deciding"].includes(row.status)) return done

    const now = yield* DateTime.now
    if (row.status === "waiting" && row.expiresAt !== null && DateTime.isLessThan(row.expiresAt, now)) {
      yield* intents.advance(row, { _tag: "Expired" }).pipe(Effect.ignore)
      return done
    }

    if (row.status !== "deciding") row = yield* intents.advance(row, { _tag: "Decide" }, { sessionId: session!.id })
    const decided = yield* executor.decide({ agentId: agent!.id, account: address, session: session!, leg: row.leg })
    const decision = decided.decision

    if (decision._tag === "Wait") {
      yield* intents.advance(row, { _tag: "Decided", decision }, { retryAt: decision.until })
      return StepResult.cases.WaitUntil.make({ until: decision.until })
    }
    if (decision._tag !== "Passes") {
      const approval = decision._tag === "OverLargestTrade"
      yield* intents.advance(
        row,
        { _tag: "Decided", decision },
        approval ? { expiresAt: DateTime.add(now, { hours: 6 }) } : {}
      )
      return done
    }

    const quote = decided.quote!
    const signed = yield* executor.sign(agent!.id, session!, decided.calls!, decision.callGasLimit)
    const trade = yield* ledger.record({
      id: typeid("trade").toString() as `trade_${string}`,
      userId: row.userId,
      intentId: row.id,
      agentId: agent!.id,
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
    row = yield* intents.advance(row, { _tag: "Decided", decision }, { userOpHash: signed.hash, tradeId: trade.id })

    const sent = yield* signed.send.pipe(Effect.result)
    if (sent._tag === "Failure") {
      // Refused at the door (nothing was spent): said as the policy that refused it when one did.
      const refusal = refusalFrom(sent.failure.cause)
      yield* Effect.logWarning(`Intent ${row.id}: the bundler refused the agent's operation`, sent.failure)
      yield* ledger.settle(trade, address, undefined)
      yield* intents.advance(
        row,
        { _tag: "Failed" },
        refusal === undefined ? {} : { decision: { _tag: "Refused", ...refusal } }
      )
      return done
    }
    row = yield* intents.advance(row, { _tag: "Accepted" })
    return yield* finish(row, address, session!)
  })

  return AccountDesk.of({
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
