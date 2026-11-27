import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { AutomationRunner } from "../../../src/modules/automations/AutomationRunner.ts"
import { AROUND_THE_CLOCK, GUARDED, stopLoss, TEST_FIRE } from "../../fixtures/Automations.ts"
import { buy } from "../../fixtures/Legs.ts"
import { AnalyticsTest } from "../../utils/AnalyticsTest.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAutomations } from "../../utils/TestAutomations.ts"

// The server runs on the real clock (see `TestServer`); analytics goes to memory (`AnalyticsTest`).
layer(TestAutomations.layer, { excludeTestServices: true })("analytics: agents, intents and automations", (it) => {
  describe("agents", () => {
    it.effect("a Stock picker created and locked: agent_created, then agent_locked as their first", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked

        const told = yield* (yield* AnalyticsTest).told(user.id, "agent_created", "agent_locked")
        const locked = told[1]!.properties

        assert.deepStrictEqual(told[0], {
          event: "agent_created",
          properties: {
            template: "stockPicker",
            policies: locked["policies"],
            max_per_trade_bucket: "$100–500",
            daily_budget_bucket: "$100–500",
            stocks_count: 2,
            $set: { network: "local" }
          }
        })
        assert.isAbove((locked["policies"] as ReadonlyArray<string>).length, 1)
        assert.isAtLeast(locked["seconds_from_created"] as number, 0)
        assert.deepStrictEqual({ ...locked, seconds_from_created: 0, $set_once: null }, {
          template: "stockPicker",
          policies: locked["policies"],
          is_first: true,
          seconds_from_created: 0,
          $set: { network: "local", agents_count: 1, active_agents_count: 1 },
          $set_once: null
        })
      }))
  })

  describe("intents", () => {
    it.effect("a $50 agent buy: intent_created, decided passes, filled by the agent, ended filled", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next("IntentChanged", ({ intent }) => intent.id === created.id && intent.status === "filled")
        const told = yield* (yield* AnalyticsTest).told(
          user.id,
          "intent_created",
          "intent_decided",
          "trade_filled",
          "intent_ended"
        )

        assert.deepStrictEqual(
          told.map(({ event, properties }) => [
            event,
            properties["source"] ?? properties["decision"],
            properties["executor"] ?? null,
            properties["agent_id"] ?? null
          ]),
          [
            ["intent_created", "agent", "agent", agent.id],
            ["intent_decided", "passes", null, null],
            ["trade_filled", "agent", "agent", agent.id],
            ["intent_ended", "agent", "agent", null]
          ]
        )
        assert.deepStrictEqual([told[2]!.properties["usd"], told[2]!.properties["is_first"]], [50, true])
      }))

    it.effect("a $150 agent buy approved and signed: approval_requested, then approval_signed", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        const request = yield* user.api.intents.approve({
          params: { id: created.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })
        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        yield* user.events.next("IntentChanged", ({ intent }) => intent.id === created.id && intent.status === "filled")
        const told = yield* (yield* AnalyticsTest).told(user.id, "approval_requested", "approval_signed")

        assert.deepStrictEqual(told.map(({ event }) => event), ["approval_requested", "approval_signed"])
        assert.deepStrictEqual(
          { ...told[0]!.properties },
          { reason: "OverLargestTrade", usd_bucket: "$100–500", source: "agent", $set: { network: "local" } }
        )
        assert.strictEqual(told[1]!.properties["surface"], "web")
      }))
  })

  describe("automations", () => {
    it.effect("a stop-loss saved, then fired: automation_created, then automation_fired with its two sales", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )

        yield* (yield* AutomationRunner).fire(automation.id, "test:1", TEST_FIRE)
        const told = yield* (yield* AnalyticsTest).told(user.id, "automation_created", "automation_fired")

        assert.deepStrictEqual(told, [
          {
            event: "automation_created",
            properties: {
              trigger: automation.trigger.type,
              action: automation.action.type,
              conditions: automation.conditions.map((condition) => condition.type),
              created_by: "you",
              for: "agent",
              $set: { network: "local", automations_count: 1 }
            }
          },
          {
            event: "automation_fired",
            properties: {
              trigger: automation.trigger.type,
              action: automation.action.type,
              outcome: "proposed",
              legs: 2,
              $set: { network: "local" }
            }
          }
        ])
      }))

    it.effect("fired twice for one window (a restart mid-fire): automation_fired once", () =>
      Effect.gen(function*() {
        const { automation, user } = yield* (yield* TestAutomations).guarded((agentId) =>
          stopLoss(agentId, { symbol: GUARDED, settings: AROUND_THE_CLOCK })
        )
        const runner = yield* AutomationRunner

        yield* runner.fire(automation.id, "test:1", TEST_FIRE)
        yield* runner.fire(automation.id, "test:1", TEST_FIRE)
        const told = yield* (yield* AnalyticsTest).told(user.id, "automation_fired")

        assert.strictEqual(told.length, 1)
      }))
  })
})
