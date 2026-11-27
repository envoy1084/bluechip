import { Devnet } from "@bluechip/devnet/Devnet"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import { randomUUID } from "node:crypto"
import { IntentsBlocked, TradesFilled, TradesValue } from "../../../../src/platform/telemetry/Metrics.ts"
import { buy } from "../../../fixtures/Legs.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"
import { TestTraces } from "../../../utils/TestTraces.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer.pipe(Layer.provideMerge(TestTraces.layer)), { excludeTestServices: true })(
  "traces and metrics",
  (it) => {
    describe("an agent's $50 buy, from POST /api/intents to its fill", () => {
      it.effect("one trace, named by route, with the chain and bundler calls in it and no SQL noise", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const traces = yield* TestTraces
          const filledBefore =
            (yield* Metric.value(Metric.withAttributes(TradesFilled.metric as Metric.Counter<number>, {
              side: "buy",
              source: "agent",
              executor: "agent",
              symbol: "NVDA"
            }))).count

          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
          })
          assert.instanceOf(created, Intent)
          yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === created.id && intent.status === "filled"
          )

          const request = yield* traces.request("POST /api/intents", user.id)
          const spans = traces.exported(request.traceId)
          const names = new Set(spans.map((span) => span.name))
          assert.deepStrictEqual(
            [
              "Intents.create",
              "AgentExecutor.decide",
              "simulateAsAgent",
              "bundler.eth_estimateUserOperationGas",
              "bundler.eth_sendUserOperation",
              "bundler.eth_getUserOperationReceipt",
              "TradeLedger.settle"
            ].filter((name) => !names.has(name)),
            []
          )
          assert.deepStrictEqual(traces.noise(request.traceId), [])
          assert.strictEqual(request.attributes.get("user.id"), user.id)
          assert.isTrue(spans.length < traces.made(request.traceId))
          const simulation = spans.find((span) => span.name === "simulateAsAgent")!
          assert.strictEqual(simulation.attributes.get("simulation.result"), "passes")
          const settle = spans.find((span) => span.name === "TradeLedger.settle")!
          assert.deepStrictEqual(
            [
              settle.attributes.get("trade.side"),
              settle.attributes.get("stock.symbol"),
              settle.attributes.get("trade.usd")
            ],
            ["buy", "NVDA", 50]
          )

          const filledAfter =
            (yield* Metric.value(Metric.withAttributes(TradesFilled.metric as Metric.Counter<number>, {
              side: "buy",
              source: "agent",
              executor: "agent",
              symbol: "NVDA"
            }))).count
          assert.strictEqual(filledAfter - filledBefore, 1)
        }))

      it.effect("trades.value adds the fill's dollars", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const attributes = { side: "buy", source: "agent", executor: "agent", symbol: "AAPL" }
          const before =
            (yield* Metric.value(Metric.withAttributes(TradesValue.metric as Metric.Counter<number>, attributes))).count

          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 20) }
          })
          assert.instanceOf(created, Intent)
          yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === created.id && intent.status === "filled"
          )

          assert.strictEqual(
            ((yield* Metric.value(Metric.withAttributes(TradesValue.metric as Metric.Counter<number>, attributes)))
              .count) - before,
            20
          )
        }))

      it.effect("intents.blocked counts the refusing policy", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(300_000_000))
          const attributes = { policy: "stockCap", source: "agent" }
          const before =
            (yield* Metric.value(Metric.withAttributes(IntentsBlocked.metric as Metric.Counter<number>, attributes)))
              .count

          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 100) }
          })
          assert.instanceOf(created, Intent)
          yield* user.events.next("IntentChanged", ({ intent }) =>
            intent.id === created.id && intent.status === "blocked")

          assert.strictEqual(
            ((yield* Metric.value(Metric.withAttributes(IntentsBlocked.metric as Metric.Counter<number>, attributes)))
              .count) - before,
            1
          )
        }))
    })

    describe("a buy signed with your passkey, POST /api/trades/:id/confirm", () => {
      it.effect("the confirm's trace names its route and carries the bundler's send, without SQL noise", () =>
        Effect.gen(function*() {
          const { user } = yield* (yield* TestAgents).locked
          const traces = yield* TestTraces
          const attributes = { side: "buy", source: "you", executor: "owner", symbol: "NVDA" }
          const before =
            (yield* Metric.value(Metric.withAttributes(TradesFilled.metric as Metric.Counter<number>, attributes)))
              .count

          const prepared = yield* user.api.trades.prepare({
            payload: {
              requestId: RequestId.make(randomUUID()),
              symbol: "NVDA",
              side: "buy",
              amount: { usdc: Usdc.make(BigInt(20_000_000)) }
            }
          })
          const sent = yield* user.api.trades.confirm({
            params: { id: prepared.id },
            payload: { credential: user.authenticator.authenticate(prepared.options) }
          })
          yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id && trade.status === "filled")

          const request = yield* traces.request("POST /api/trades/:id/confirm", user.id)
          const spans = traces.exported(request.traceId)
          assert.isTrue(spans.some((span) => span.name === "bundler.eth_sendUserOperation"))
          assert.deepStrictEqual(traces.noise(request.traceId), [])
          assert.strictEqual(
            ((yield* Metric.value(Metric.withAttributes(TradesFilled.metric as Metric.Counter<number>, attributes)))
              .count) - before,
            1
          )
        }))
    })
  }
)
