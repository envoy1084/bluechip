import type { ChainClient } from "@bluechip/chain/ChainClient"
import { refusalFrom } from "@bluechip/chain/policies/Refusals"
import type { UserId } from "@bluechip/domain/Ids"
import { isEnded } from "@bluechip/domain/intents/Intent"
import { and, eq } from "drizzle-orm"
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
import type { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { accounts } from "../db/schema/accounts.ts"
import { agents, agentSessions } from "../db/schema/agents.ts"
import { trades } from "../db/schema/trading.ts"
import type { LiveEvents } from "../live/LiveEvents.ts"
import type { MarketPrices } from "../market/MarketPrices.ts"
import type { ReferencePrices } from "../market/ReferencePrices.ts"
import type { Namera } from "../Namera.ts"
import type { AccountBalances } from "../portfolio/AccountBalances.ts"
import { settleTrade } from "../trading/Settlement.ts"
import { decide, signForAgent, waitForAgentOperation } from "./AgentExecutor.ts"
import { advance, type IntentRow, intentRow } from "./IntentStore.ts"

/** What one step of an intent left to do: nothing, or decide it again at `until`. */
export const StepResult = Schema.TaggedUnion({
  Done: {},
  WaitUntil: { until: Schema.DateTimeUtc }
})

export type StepResult = typeof StepResult.Type

const done: StepResult = StepResult.cases.Done.make({})

/**
 * One account's trading desk: an entity per user, so its intents are decided and sent one at a time (an agent's
 * buy and another agent's sell never race on the same balances). `Step` runs one intent as far as it can go now.
 */
export const AccountDesk = Entity.make("AccountDesk", [
  Rpc.make("Step", { payload: { intentId: Schema.String }, success: StepResult })
    .annotate(ClusterSchema.Persisted, true)
])

// Follows an agent's sent operation to its receipt, records the fill, and ends the intent.
const finish = Effect.fnUntraced(function*(row: IntentRow, account: Hex, session: typeof agentSessions.$inferSelect) {
  const db = yield* Database
  const receipt = yield* waitForAgentOperation(row.agentId!, session, row.userOpHash as Hex)
  const [trade] = yield* db.select().from(trades).where(eq(trades.id, row.tradeId!)).pipe(Effect.orDie)
  const settled = trade === undefined ? undefined : yield* settleTrade(trade, account, receipt)
  const status = settled?.status ?? (receipt?.success === true ? "filled" : "failed")
  yield* advance(row, { _tag: status === "filled" ? "Filled" : "Failed" })
  return done
})

/**
 * Runs one agent intent as far as it can go now: cancelled when its agent is no longer trading, expired when it waited
 * too long, otherwise decided against the agent's policies and, when it passes, sent by the agent's key and followed
 * to its fill. Every step is saved first, so running it again after a restart picks up where it stopped.
 */
export const stepIntent = Effect.fnUntraced(function*(intentId: string) {
  const db = yield* Database
  let row = yield* intentRow(intentId)
  if (row === undefined || isEnded(row.status) || row.executor !== "agent") return done

  const [agent] = yield* db.select().from(agents).where(eq(agents.id, row.agentId!)).pipe(Effect.orDie)
  const [account] = yield* db.select().from(accounts).where(eq(accounts.userId, row.userId)).pipe(Effect.orDie)
  const [session] = agent?.currentSessionId == null ? [] : yield* db.select().from(agentSessions)
    .where(and(eq(agentSessions.id, agent.currentSessionId), eq(agentSessions.status, "active"))).pipe(Effect.orDie)
  const address = account!.address as Hex

  // A sent operation is only ever followed, never sent again.
  if (row.userOpHash !== null && session !== undefined) return yield* finish(row, address, session)

  const trading = agent !== undefined && !agent.paused && agent.status === "active" && session !== undefined
  if (!trading && ["proposed", "waiting", "deciding"].includes(row.status)) {
    yield* advance(row, { _tag: "Cancelled" }).pipe(Effect.ignore)
    return done
  }
  if (!["proposed", "waiting", "deciding"].includes(row.status)) return done

  const now = yield* DateTime.now
  if (row.status === "waiting" && row.expiresAt !== null && DateTime.isLessThan(row.expiresAt, now)) {
    yield* advance(row, { _tag: "Expired" }).pipe(Effect.ignore)
    return done
  }

  if (row.status !== "deciding") row = yield* advance(row, { _tag: "Decide" }, { sessionId: session!.id })
  const decided = yield* decide({ agentId: agent!.id, account: address, session: session!, leg: row.leg })
  const decision = decided.decision

  if (decision._tag === "Wait") {
    yield* advance(row, { _tag: "Decided", decision }, { retryAt: decision.until })
    return StepResult.cases.WaitUntil.make({ until: decision.until })
  }
  if (decision._tag !== "Passes") {
    const approval = decision._tag === "OverLargestTrade"
    yield* advance(row, { _tag: "Decided", decision }, approval ? { expiresAt: DateTime.add(now, { hours: 6 }) } : {})
    return done
  }

  const quote = decided.quote!
  const signed = yield* signForAgent(agent!.id, session!, decided.calls!, decision.callGasLimit)
  const [trade] = yield* db.insert(trades).values({
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
  }).returning().pipe(Effect.orDie)
  row = yield* advance(row, { _tag: "Decided", decision }, { userOpHash: signed.hash, tradeId: trade!.id })

  const sent = yield* signed.send.pipe(Effect.result)
  if (sent._tag === "Failure") {
    // Refused at the door (nothing was spent): said as the policy that refused it when one did.
    const refusal = refusalFrom(sent.failure.cause)
    yield* Effect.logWarning(`Intent ${row.id}: the bundler refused the agent's operation`, sent.failure)
    yield* settleTrade(trade!, address, undefined)
    yield* advance(
      row,
      { _tag: "Failed" },
      refusal === undefined ? {} : {
        decision: { _tag: "Refused", ...refusal }
      }
    )
    return done
  }
  row = yield* advance(row, { _tag: "Accepted" })
  return yield* finish(row, address, session!)
})

type DeskServices =
  | Database
  | LiveEvents
  | AccountBalances
  | Namera
  | AppConfig
  | ChainClient
  | ReferencePrices
  | MarketPrices

/** The desk's handler: steps run one at a time per account. */
export const AccountDeskLive = AccountDesk.toLayer(Effect.gen(function*() {
  const context = yield* Effect.context<DeskServices>()
  return AccountDesk.of({
    Step: ({ payload }) =>
      stepIntent(payload.intentId).pipe(
        // A step that failed (the database, a bug) is tried again in a minute, not straight away.
        Effect.catch((error) =>
          Effect.logWarning(`Intent ${payload.intentId} step failed`, error).pipe(
            Effect.andThen(DateTime.now),
            Effect.map((now) => StepResult.cases.WaitUntil.make({ until: DateTime.add(now, { minutes: 1 }) }))
          )
        ),
        Effect.provideContext(context)
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

/** Starts an agent intent on its way (once: the workflow is keyed by the intent). */
export const startIntent = (row: { readonly id: string; readonly userId: string }) =>
  ExecuteIntent.execute({ intentId: row.id, userId: row.userId as UserId }, { discard: true })

export const DeskLive = Layer.mergeAll(AccountDeskLive, ExecuteIntentLive)
