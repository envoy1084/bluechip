import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import type { AgentId, RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { storyOf } from "../../../src/features/agents/model/journalStory.ts"
import {
  addAgentFromTemplate,
  addAutomationRun,
  setAgentEndsIn,
  setAgentStateAction,
  setAgentUsage,
  setAutomationState
} from "../../../src/preview/panel/actions/agents.ts"
import { stockName } from "../../../src/preview/world/agents/stockName.ts"
import { previewUuid } from "../../../src/preview/world/ids.ts"
import { previewApi } from "../../utils/PreviewApi.ts"

const credential: typeof AuthenticationCredential.Type = {
  id: "cHJldmlldy1wYXNza2V5",
  rawId: "cHJldmlldy1wYXNza2V5",
  type: "public-key",
  clientExtensionResults: {},
  response: { clientDataJSON: "e30", authenticatorData: "cHJldmlldw", signature: "cHJldmlldw" }
}

describe("preview agents, policies and automations", () => {
  it.effect.each(["newPerson", "starter", "typical", "heavy"] as const)(
    "every read decodes for %s",
    (scenario) =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi(scenario)

        const agents = yield* client.agents.list()
        for (const record of store.world.agents.agents) {
          yield* client.agents.agent({ params: { id: record.id } })
          yield* client.agents.usage({ params: { id: record.id } })
          yield* client.agents.sessions({ params: { id: record.id } })
          yield* client.agents.journal({ params: { id: record.id }, query: { pageSize: 20 } })
          yield* client.automations.defaults({ params: { agentId: record.id } })
        }
        yield* client.policies.catalog()
        yield* client.policies.templates()
        yield* client.automations.catalog()
        const automations = yield* client.automations.list({ query: {} })
        for (const automation of automations) {
          yield* client.automations.automation({ params: { id: automation.id } })
        }

        assert.deepStrictEqual(
          [agents.length, automations.length],
          [
            store.cast.agents.filter((agent) => agent.state !== "removed").length,
            store.cast.automations.length
          ]
        )
      })
  )

  it.effect("heavy: an agent in every state the cast says", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("heavy")

      const agents = yield* Effect.forEach(store.cast.agents, (agent) =>
        client.agents.agent({ params: { id: agent.id } }))

      assert.deepStrictEqual(agents.map((agent) => [agent.status, agent.paused, agent.pendingSpec !== null]), [
        ["active", false, false],
        ["active", false, false],
        ["active", false, false],
        ["active", true, false],
        ["updating", false, true],
        ["draft", false, false],
        ["expired", false, false],
        ["locking", false, false],
        ["removed", false, false]
      ])
    }))

  it.effect("typical: the weekly buyer has used today's budget", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")

      const usage = yield* client.agents.usage({ params: { id: store.cast.agents[1]!.id } })

      const budget = usage.policies.find((counted) => counted.policy === "trade")!
      assert.deepStrictEqual(budget.used, budget.limit)
    }))

  it.effect("starter: one agent with a little of today's budget used, and a stop-loss that hasn't run", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("starter")
      const agentId = store.cast.agents[0]!.id

      const agents = yield* client.agents.list()
      const usage = yield* client.agents.usage({ params: { id: agentId } })
      const automations = yield* client.automations.list({ query: {} })

      const budget = usage.policies.find((counted) => counted.policy === "trade")!
      assert.deepStrictEqual(agents.map((agent) => [agent.status, agent.paused]), [["active", false]])
      assert.deepStrictEqual([budget.used, budget.limit], [BigInt(30_000_000), BigInt(100_000_000)])
      assert.deepStrictEqual(
        automations.map((automation) => [automation.status, automation.fires, automation.lastFiredAt]),
        [["active", 0, null]]
      )
    }))

  it.effect("heavy: a long journal pages through every entry once", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("heavy")
      const id = store.cast.agents[2]!.id

      const first = yield* client.agents.journal({ params: { id }, query: { pageSize: 20 } })
      const second = yield* client.agents.journal({
        params: { id },
        query: { pageSize: 20, pageToken: first.nextPageToken! }
      })

      assert.deepStrictEqual(
        new Set([...first.items, ...second.items].map((entry) => entry.id)).size,
        store.world.agents.agents[2]!.journal.length
      )
    }))

  it.effect("heavy: every journal entry reads into its parts, and the trades show every moment", () =>
    Effect.gen(function*() {
      const { store } = yield* previewApi("heavy")
      const stories = store.world.agents.agents.flatMap((record) =>
        record.journal.map((entry) => storyOf(entry, stockName))
      )

      assert.deepStrictEqual(
        [
          stories.filter((story) => story._tag === "Note"),
          new Set(stories.flatMap((story) => story._tag === "Trade" ? [story.moment] : []))
        ],
        [
          [],
          new Set([
            "filled",
            "sent",
            "blocked",
            "needsApproval",
            "waiting",
            "approved",
            "failed",
            "declined",
            "expired",
            "cancelled"
          ])
        ]
      )
    }))

  it.effect("heavy: the cast's automations pass their own checks, except the one that ended", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("heavy")
      const automations = yield* client.automations.list({ query: {} })

      const problems = yield* Effect.forEach(automations, (automation) =>
        Effect.map(
          client.automations.check({ payload: { draft: new AutomationDraft(automation) } }),
          (check) => [automation.name, check.problems.length] as const
        ))

      assert.deepStrictEqual(
        problems.filter(([, count]) => count > 0).map(([name]) => name),
        ["One-off Meta buy"]
      )
    }))

  it.effect("POST /api/agents, then confirm: a draft is prepared, then locking", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("newPerson")
      const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })

      const request = yield* client.agents.create({
        payload: { requestId: previewUuid(1) as RequestId, name: "Weekly Nvidia", template: "weeklyBuyer", spec }
      })
      const sent = yield* client.agents.confirm({ params: { id: request.id }, payload: { credential } })

      assert.deepStrictEqual([request.action, request.agent.status, sent.status], ["lock", "draft", "locking"])
    }))

  it.effect("POST /api/agents/:id/sessions, then confirm: the change is on its way", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const id = store.cast.agents[0]!.id
      const spec = draftSpec({ template: "stockPicker", preset: "conservative", stocks: ["NVDA"], targets: [] })

      const request = yield* client.agents.change({
        params: { id },
        payload: { requestId: previewUuid(2) as RequestId, spec }
      })
      const sent = yield* client.agents.confirm({ params: { id: request.id }, payload: { credential } })

      assert.deepStrictEqual([sent.status, sent.pendingSpec], ["updating", spec])
    }))

  it.effect("POST /api/agents/:id/renew: 409 for a draft", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("heavy")

      const error = yield* Effect.flip(
        client.agents.renew({
          params: { id: store.cast.agents[5]!.id },
          payload: { requestId: previewUuid(3) as RequestId }
        })
      )

      assert.deepStrictEqual(error._tag, "Conflict")
    }))

  it.effect("POST /api/agents/:id/remove: a draft is removed at once", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("heavy")

      const removed = yield* client.agents.remove({
        params: { id: store.cast.agents[5]!.id },
        payload: { requestId: previewUuid(4) as RequestId }
      })

      assert.deepStrictEqual("status" in removed ? removed.status : removed.action, "removed")
    }))

  it.effect("POST /api/agents/pause-all, then resume-all", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const paused = yield* client.agents.pauseAll()
      const resumed = yield* client.agents.resumeAll()

      assert.deepStrictEqual(
        [paused.map((agent) => agent.paused), resumed.map((agent) => agent.paused)],
        [[true, true, true], [false, false, false]]
      )
    }))

  it.effect("POST /api/agents/remove-all, then confirm: every locked agent is removing", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const removal = yield* client.agents.removeAll({ payload: { requestId: previewUuid(5) as RequestId } })
      const agents = yield* client.agents.confirmRemoveAll({ params: { id: removal.id }, payload: { credential } })

      assert.deepStrictEqual(agents.map((agent) => agent.status), ["removing", "removing", "removing"])
    }))

  it.effect("POST /api/templates, then DELETE: saved and gone", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("newPerson")
      const spec = draftSpec({ template: "stockPicker", preset: "active", stocks: ["AAPL"], targets: [] })

      const saved = yield* client.policies.saveTemplate({ payload: { name: "Mine", basedOn: "stockPicker", spec } })
      yield* client.policies.deleteTemplate({ params: { id: saved.id } })
      const templates = yield* client.policies.templates()

      assert.deepStrictEqual([saved.name, templates.saved.length, templates.builtIn.length], ["Mine", 0, 4])
    }))

  it.effect("POST /api/automations, PATCH to pause, DELETE: its list follows", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const agentId = store.cast.agents[0]!.id as AgentId
      const draft = new AutomationDraft({
        name: "Buy Nvidia on Mondays",
        agentId,
        trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
        conditions: [],
        action: {
          type: "buy",
          config: { amount: Usdc.make(BigInt(50_000_000)), split: [{ symbol: "NVDA", weight: 10_000 }] }
        },
        settings: DEFAULT_SETTINGS
      })

      const created = yield* client.automations.create({ payload: { requestId: previewUuid(6) as RequestId, draft } })
      const paused = yield* client.automations.update({ params: { id: created.id }, payload: { status: "paused" } })
      yield* client.automations.remove({ params: { id: created.id } })
      const left = yield* client.automations.list({ query: { agentId } })

      assert.deepStrictEqual(
        [created.status, paused.status, left.some((automation) => automation.id === created.id)],
        ["active", "paused", false]
      )
    }))

  it.effect.each(
    [
      ["active", "active", false, false],
      ["doneForToday", "active", false, false],
      ["paused", "active", true, false],
      ["draft", "draft", false, false],
      ["locking", "locking", false, false],
      ["updating", "updating", false, true],
      ["renewing", "updating", false, true],
      ["removing", "removing", false, false],
      ["expired", "expired", false, false],
      ["removed", "removed", false, false]
    ] as const
  )("panel: an agent set to %s reads as %s", ([state, status, paused, pending]) =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const id = store.cast.agents[0]!.id

      setAgentStateAction.def.apply(store.world, id, state)
      const agent = yield* client.agents.agent({ params: { id } })

      assert.deepStrictEqual([agent.status, agent.paused, agent.pendingSpec !== null], [status, paused, pending])
    }))

  it.effect("panel: a daily budget used up reads as used up", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const id = store.cast.agents[0]!.id

      setAgentUsage.def.apply(store.world, id, "trade", 1)
      const usage = yield* client.agents.usage({ params: { id } })

      const budget = usage.policies.find((counted) => counted.policy === "trade")!
      assert.deepStrictEqual(budget.used, budget.limit)
    }))

  it.effect("panel: a session ending in 3 days", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const id = store.cast.agents[0]!.id

      setAgentEndsIn.def.apply(store.world, id, 3)
      const agent = yield* client.agents.agent({ params: { id } })

      const days = (DateTime.toEpochMillis(agent.lockedUntil!) - Date.now()) / 86_400_000
      assert.deepStrictEqual(Math.round(days), 3)
    }))

  it.effect("panel: an agent added from a template is listed, locked", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("newPerson")

      addAgentFromTemplate.def.apply(store.world, "rebalancer", "balanced")
      const agents = yield* client.agents.list()

      assert.deepStrictEqual(agents.map((agent) => [agent.name, agent.status]), [["New rebalancer", "active"]])
    }))

  it.effect("panel: a run skipped for its cooldown leads its history and its agent's journal", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const automation = store.cast.automations[0]!

      addAutomationRun.def.apply(store.world, automation.id, "skipped", "cooldown")
      const detail = yield* client.automations.automation({ params: { id: automation.id } })
      const journal = yield* client.agents.journal({ params: { id: automation.agentId! }, query: {} })

      assert.deepStrictEqual(
        [detail.runs[0]!.outcome, detail.runs[0]!.reason, journal.items[0]!.entry],
        [
          "skipped",
          "It fired less than its cooldown ago.",
          `Automation "${automation.name}" skipped: It fired less than its cooldown ago.`
        ]
      )
    }))

  it.effect("panel: a failing automation is active with its last run failed", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const id = store.cast.automations[2]!.id

      setAutomationState.def.apply(store.world, id, "failing")
      const detail = yield* client.automations.automation({ params: { id } })

      assert.deepStrictEqual([detail.automation.status, detail.runs[0]!.outcome], ["active", "failed"])
    }))
})
