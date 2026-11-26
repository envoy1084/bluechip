// The mock API's trades and intents groups: your own trades prepared for Face ID and sent, agents' trades decided in
// the background, approvals prepared with the rest of their plan, and the intents list, all on the market slice.
import { BluechipApi } from "@bluechip/domain/Api"
import { Conflict, NotFound } from "@bluechip/domain/Errors"
import type { Intent, IntentStatus } from "@bluechip/domain/intents/Intent"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import * as Result from "effect/Result"
import { chatTrade } from "../../world/assistant.ts"
import type { MarketWorld } from "../../world/market/model.ts"
import { confirmPlan, prepareIntents, prepareTrade } from "../../world/market/signing.ts"
import { addIntent, advanceIntent, agentOf, canTrade, checkFunds, decide } from "../../world/market/trading.ts"
import { Preview } from "../Preview.ts"
import { decideLater, followTrade, inWorld } from "./flows.ts"
import { pageOf } from "./reads.ts"

const WAITING_FOR_YOU: ReadonlyArray<IntentStatus> = ["needsApproval", "awaitingSignature"]

// Newest first, as the server orders intents by their time-ordered ids; two made in one millisecond by id.
const newestFirst = (a: Intent, b: Intent) =>
  b.createdAt.epochMilliseconds - a.createdAt.epochMilliseconds || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

const intentOf = (world: MarketWorld, id: string) => world.market.intents.find((record) => record.intent.id === id)

const TradesHandlers = HttpApiBuilder.group(
  BluechipApi,
  "trades",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      prepare: ({ payload }) =>
        inWorld(preview, (world, now) =>
          Result.gen(function*() {
            const leg = { symbol: payload.symbol, side: payload.side, amount: payload.amount }
            yield* checkFunds(world.market, leg)
            return [yield* prepareTrade(world.market, leg, now), []] as const
          })),
      confirm: ({ params }) =>
        Effect.gen(function*() {
          const sent = yield* inWorld(preview, (world, now) =>
            Result.map(confirmPlan(world.market, params.id, now), (sent) => [sent, sent.events] as const))
          const trade = sent.trades[0]
          if (trade === undefined) {
            return yield* new NotFound({ resource: "signingRequest", id: params.id })
          }
          yield* followTrade(preview, trade.trade.id)
          return trade.trade
        }),
      trade: ({ params }) =>
        Effect.suspend(() => {
          const trade = preview.world.market.trades.find((candidate) => candidate.trade.id === params.id)?.trade ??
            chatTrade(preview.world.assistant, params.id)
          return trade === undefined ?
            Effect.fail(new NotFound({ resource: "trade", id: params.id })) :
            Effect.succeed(trade)
        })
    })
  })
)

const IntentsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "intents",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      preview: ({ payload }) =>
        inWorld(preview, (world, now) =>
          Result.gen(function*() {
            const agent = agentOf(world, payload.agentId)
            if (agent === undefined) return yield* Result.fail(new NotFound({ resource: "agent", id: payload.agentId }))
            return [yield* decide(world, agent, payload.leg, now), []] as const
          })),
      create: ({ payload }) =>
        Effect.gen(function*() {
          const { agentId, leg } = payload
          const reason = payload.reason === undefined ? {} : { reason: payload.reason }

          if (agentId === null) {
            return yield* inWorld(preview, (world, now) =>
              Result.gen(function*() {
                yield* checkFunds(world.market, leg)
                const { intent } = addIntent(world.market, {
                  agentId: null,
                  source: "owner",
                  leg,
                  ...reason,
                  status: "proposed",
                  decision: null,
                  at: now
                })
                const prepared = prepareIntents(world, intent.id, now)
                // A trade that can't be prepared leaves no intent behind.
                if (Result.isFailure(prepared)) world.market.intents.pop()
                const { events, request } = yield* prepared
                return [request, events] as const
              }))
          }

          const intent = yield* inWorld(preview, (world, now) =>
            Result.gen(function*() {
              const agent = agentOf(world, agentId)
              if (agent === undefined) return yield* Result.fail(new NotFound({ resource: "agent", id: agentId }))
              if (!canTrade(agent)) return yield* Result.fail(new Conflict({ reason: "agentBusy" }))
              const { events, intent } = addIntent(world.market, {
                agentId,
                source: "owner",
                leg,
                ...reason,
                status: "proposed",
                decision: null,
                at: now
              })
              return [intent, events] as const
            }))
          yield* decideLater(preview, intent.id)
          return intent
        }),
      list: ({ query }) =>
        Effect.sync(() => {
          const intents = preview.world.market.intents.map(({ intent }) => intent).filter((intent) =>
            (query.agentId === undefined || intent.agentId === query.agentId) &&
            (query.status === undefined || intent.status === query.status) &&
            (query.source === undefined || intent.source === query.source)
          ).sort(newestFirst)
          return pageOf(intents, query)
        }),
      intent: ({ params }) =>
        Effect.suspend(() => {
          const record = intentOf(preview.world, params.id)
          return record === undefined ?
            Effect.fail(new NotFound({ resource: "intent", id: params.id })) :
            Effect.succeed(record.intent)
        }),
      approvals: () =>
        Effect.sync(() =>
          preview.world.market.intents.map(({ intent }) => intent).filter((intent) =>
            (intent.agentId !== null || intent.source === "automation") && WAITING_FOR_YOU.includes(intent.status)
          ).sort(newestFirst)
        ),
      approve: ({ params }) =>
        inWorld(preview, (world, now) =>
          Result.gen(function*() {
            const record = intentOf(world, params.id)
            if (record === undefined) return yield* Result.fail(new NotFound({ resource: "intent", id: params.id }))
            if (!WAITING_FOR_YOU.includes(record.intent.status)) {
              return yield* Result.fail(new Conflict({ reason: "intentClosed" }))
            }
            const { events, request } = yield* prepareIntents(world, params.id, now)
            return [request, events] as const
          })),
      confirm: ({ params }) =>
        Effect.gen(function*() {
          const sent = yield* inWorld(preview, (world, now) =>
            Result.map(confirmPlan(world.market, params.id, now), (sent) => [sent, sent.events] as const))
          for (const trade of sent.trades) {
            yield* followTrade(preview, trade.trade.id)
          }
          if (sent.intent === null) {
            return yield* new NotFound({ resource: "signingRequest", id: params.id })
          }
          return sent.intent
        }),
      decline: ({ params }) => end(preview, params.id, "Declined"),
      cancel: ({ params }) => end(preview, params.id, "Cancelled")
    })
  })
)

const end = (preview: Preview["Service"], id: string, event: "Declined" | "Cancelled") =>
  inWorld(preview, (world, now) =>
    Result.gen(function*() {
      const record = intentOf(world, id)
      if (record === undefined) return yield* Result.fail(new NotFound({ resource: "intent", id }))
      const { events, intent } = yield* advanceIntent(world.market, record.intent.id, { _tag: event }, now)
      return [intent, events] as const
    }))

export const TradingGroupsLive = Layer.mergeAll(TradesHandlers, IntentsHandlers)
