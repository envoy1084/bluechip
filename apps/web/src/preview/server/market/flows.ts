// How the mock API changes the market slice: a change made at once (its live events sent after it), and what the
// server does in the background, on short timers so a screen visibly moves: an agent's intent decided, then its trade
// sending, confirming and filled.
import type { LiveEvent } from "@bluechip/domain/Events"
import type { IntentId, TradeId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import type { PreviewStore } from "../../store.ts"
import type { MarketWorld } from "../../world/market/model.ts"
import { advanceIntent, advanceTrade, agentOf, decide, sendIntent } from "../../world/market/trading.ts"

/** Changes the world with `change`, then sends its events; fails, changing nothing visible, when it does. */
export const inWorld = <A, E>(
  preview: PreviewStore,
  change: (world: MarketWorld, now: number) => Result.Result<readonly [A, ReadonlyArray<LiveEvent>], E>
): Effect.Effect<A, E> =>
  Effect.suspend(() => {
    const made: { result?: Result.Result<readonly [A, ReadonlyArray<LiveEvent>], E> } = {}
    preview.update((world) => {
      made.result = change(world, Date.now())
    })
    const result = made.result!
    if (Result.isFailure(result)) return Effect.fail(result.failure)

    const [value, events] = result.success
    for (const event of events) preview.emit(event)
    return Effect.succeed(value)
  })

const step = (preview: PreviewStore, change: (world: MarketWorld, now: number) => ReadonlyArray<LiveEvent>) =>
  inWorld(preview, (world, now) => Result.succeed([undefined, change(world, now)] as const))

/** A sent trade's progress: accepted by the bundler, then filled on Base. */
export const followTrade = (preview: PreviewStore, id: TradeId) =>
  Effect.gen(function*() {
    yield* Effect.sleep("1500 millis")
    yield* step(preview, (world, now) => advanceTrade(world.market, id, "confirming", now))
    yield* Effect.sleep("1800 millis")
    yield* step(preview, (world, now) => advanceTrade(world.market, id, "filled", now))
  }).pipe(Effect.forkDetach, Effect.asVoid)

/** An agent's intent decided by its policies in the background, then sent when it passes. */
export const decideLater = (preview: PreviewStore, id: IntentId) =>
  Effect.gen(function*() {
    yield* Effect.sleep("500 millis")
    yield* step(preview, (world, now) => {
      const moved = advanceIntent(world.market, id, { _tag: "Decide" }, now)
      return Result.isSuccess(moved) ? moved.success.events : []
    })

    yield* Effect.sleep("900 millis")
    const tradeId = yield* inWorld(preview, (world, now) => {
      const intent = world.market.intents.find((record) => record.intent.id === id)?.intent
      const agent = intent?.agentId == null ? undefined : agentOf(world, intent.agentId)
      if (intent === undefined || agent === undefined) return Result.succeed([null, []] as const)

      const decided = decide(world, agent, intent.leg, now)
      // Funds that changed since it was asked show as the policy the simulation would trip.
      const decision = Result.isSuccess(decided) ?
        decided.success :
        {
          _tag: "Refused" as const,
          policy: "cashReserve" as const,
          error: "UnderCashReserve",
          stock: null,
          message: "Would leave too little in cash."
        }
      if (decision._tag === "Passes") {
        const sent = sendIntent(world.market, id, { _tag: "Decided", decision }, now)
        return Result.succeed([sent.trade?.trade.id ?? null, sent.events] as const)
      }

      const moved = advanceIntent(world.market, id, { _tag: "Decided", decision }, now)
      return Result.succeed([null, Result.isSuccess(moved) ? moved.success.events : []] as const)
    })
    if (tradeId !== null) yield* followTrade(preview, tradeId)
  }).pipe(Effect.forkDetach, Effect.asVoid)
