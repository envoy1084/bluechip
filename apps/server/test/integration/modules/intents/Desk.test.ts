import { IntentId, TradeId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { AgentStore } from "../../../../src/modules/agents/AgentStore.ts"
import { AgentExecutor } from "../../../../src/modules/intents/AgentExecutor.ts"
import { AccountDesk } from "../../../../src/modules/intents/Desk.ts"
import { IntentStore } from "../../../../src/modules/intents/IntentStore.ts"
import { TradeLedger } from "../../../../src/modules/trading/TradeLedger.ts"
import { buy } from "../../../fixtures/Legs.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("AccountDesk", (it) => {
  describe("Step", () => {
    it.effect("run twice after a restart between sending and saving it, follows the sent operation to one fill", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const intents = yield* IntentStore
        const executor = yield* AgentExecutor
        const ledger = yield* TradeLedger
        const { session } = yield* (yield* AgentStore).tradingState(agent.id)

        // What a step leaves behind when the server stops right after sending: the operation signed, its hash stored
        // (the intent `sending`), and handed to the bundler.
        const { row: proposed } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("AAPL", 50)
        })
        const deciding = yield* intents.advance(proposed, { _tag: "Decide" }, { sessionId: session!.id })
        const decided = yield* executor.decide({
          agentId: agent.id,
          account: user.account,
          session: session!,
          legs: [deciding.leg]
        })
        const signed = yield* executor.sign(agent.id, session!, decided.calls!, decided.gas!)
        const quote = decided.quotes![0]!
        const trade = yield* ledger.record({
          id: typeid("trade").toString() as `trade_${string}`,
          userId: deciding.userId,
          intentId: deciding.id,
          agentId: agent.id as `agent_${string}`,
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
          createdAt: yield* DateTime.now
        })
        yield* intents.advance(deciding, { _tag: "Decided", decision: decided.decision }, {
          userOpHash: signed.hash,
          tradeId: trade.id
        })
        yield* signed.send

        const desk = (yield* AccountDesk.client)(me.id)
        const first = yield* desk.Step({ intentId: deciding.id })
        const again = yield* desk.Step({ intentId: deciding.id })
        const intent = yield* user.api.intents.intent({ params: { id: IntentId.make(deciding.id) } })
        const fill = yield* user.api.trades.trade({ params: { id: TradeId.make(trade.id) } })
        const usage = yield* user.api.agents.usage({ params: { id: agent.id } })

        assert.deepStrictEqual(
          [
            [first._tag, again._tag],
            intent.status,
            fill.status,
            usage.policies.find((policy) => policy.policy === "tradesPerDay")?.used
          ],
          [["Done", "Done"], "filled", "filled", BigInt(1)]
        )
      }))
  })

  describe("Step, a plan of several trades", () => {
    it.effect("its two buys in one wave: one operation, both filled, counted as one trade", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const intents = yield* IntentStore
        const batch = { id: randomUUID(), wave: 0 }
        const { row: nvidia } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("NVDA", 50),
          batch
        })
        const { row: apple } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("AAPL", 40),
          batch
        })

        const result = yield* (yield* AccountDesk.client)(me.id).Step({ intentId: apple.id })
        const legs = yield* Effect.forEach([nvidia, apple], (row) =>
          Effect.gen(function*() {
            const intent = yield* user.api.intents.intent({ params: { id: IntentId.make(row.id) } })
            const trade = yield* user.api.trades.trade({ params: { id: intent.tradeId! } })
            return { status: intent.status, txHash: trade.txHash }
          }))
        const usage = yield* user.api.agents.usage({ params: { id: agent.id } })

        assert.deepStrictEqual(
          [
            result._tag,
            legs.map((leg) => leg.status),
            legs[0]!.txHash === legs[1]!.txHash,
            usage.policies.filter((policy) => policy.policy !== "gasBudget" && policy.policy !== "slippageBudget")
              .map((policy) => [policy.policy, policy.used])
          ],
          ["Done", ["filled", "filled"], true, [["trade", BigInt(90_000_000)], ["tradesPerDay", BigInt(1)]]]
        )
      }))

    it.effect("one of its buys over the largest trade: each decided alone, the other sent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const intents = yield* IntentStore
        const batch = { id: randomUUID(), wave: 0 }
        const { row: nvidia } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("NVDA", 150),
          batch
        })
        const { row: apple } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("AAPL", 40),
          batch
        })

        yield* (yield* AccountDesk.client)(me.id).Step({ intentId: nvidia.id })
        const statuses = yield* Effect.forEach(
          [nvidia, apple],
          (row) => user.api.intents.intent({ params: { id: IntentId.make(row.id) } }).pipe(Effect.map((i) => i.status))
        )

        assert.deepStrictEqual(statuses, ["needsApproval", "filled"])
      }))

    it.effect("two pieces of one stock: the second's step sends the first's operation, then its own", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const intents = yield* IntentStore
        const id = randomUUID()
        const { row: first } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("AAPL", 40),
          batch: { id, wave: 0 }
        })
        const { row: second } = yield* intents.insert({ id: me.id, account: user.account }, {
          requestId: randomUUID(),
          agentId: agent.id,
          leg: buy("AAPL", 40),
          batch: { id, wave: 1 }
        })

        yield* (yield* AccountDesk.client)(me.id).Step({ intentId: second.id })
        const legs = yield* Effect.forEach([first, second], (row) =>
          Effect.gen(function*() {
            const intent = yield* user.api.intents.intent({ params: { id: IntentId.make(row.id) } })
            const trade = yield* user.api.trades.trade({ params: { id: intent.tradeId! } })
            return { status: intent.status, txHash: trade.txHash }
          }))
        const usage = yield* user.api.agents.usage({ params: { id: agent.id } })

        assert.deepStrictEqual(
          [
            legs.map((leg) => leg.status),
            legs[0]!.txHash === legs[1]!.txHash,
            usage.policies.find((policy) => policy.policy === "tradesPerDay")?.used
          ],
          [["filled", "filled"], false, BigInt(2)]
        )
      }))
  })
})
