import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { resultCardsOf, resultKind, resultState } from "../../../src/features/assistant/model/resultCards.ts"
import { entriesOf } from "../../../src/features/assistant/model/thread.ts"
import { toolSummary } from "../../../src/features/assistant/model/toolSummary.ts"
import { worstCaseLines, worstCaseOf } from "../../../src/features/assistant/model/worstCase.ts"
import { previewApi } from "../../utils/PreviewApi.ts"

// Each result card and the states it can be stored in; one being read shows only while a reply streams.
const RESULT_STATES: Readonly<Record<string, ReadonlyArray<string>>> = {
  portfolio: ["ready", "empty", "error"],
  performance: ["ready", "empty", "error"],
  stock: ["ready", "empty", "error"],
  prices: ["ready", "empty", "error"],
  quote: ["ready", "error"],
  agent: ["ready", "error"],
  agents: ["ready", "empty", "error"],
  usage: ["ready", "empty", "error"],
  agentResults: ["ready", "empty", "error"],
  activity: ["ready", "empty", "error"],
  decision: ["ready", "error"],
  automations: ["ready", "empty", "error"],
  automationResults: ["ready", "empty", "error"],
  templates: ["ready", "error"],
  policies: ["ready", "error"],
  memories: ["ready", "empty", "error"],
  help: ["ready", "empty", "error"],
  brief: ["ready", "empty"],
  rebalance: ["ready", "empty", "error"]
}

describe("preview assistant showcase", () => {
  it.effect("showcase chats: starter 17, typical 15, heavy 18, each in the list", () =>
    Effect.gen(function*() {
      const counts: Array<number> = []
      for (const scenario of ["starter", "typical", "heavy"] as const) {
        const { client, store } = yield* previewApi(scenario)
        const page = yield* client.assistant.conversations({ query: { pageSize: 100 } })
        const listed = page.items.map((conversation) => conversation.id)
        counts.push(store.world.assistant.showcase.filter((entry) => listed.includes(entry.id)).length)
      }

      assert.deepStrictEqual(counts, [17, 15, 18])
    }))

  for (const scenario of ["starter", "typical", "heavy"] as const) {
    it.effect(`${scenario}: the showcase chats show every card, state and tool row on the checklist`, () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi(scenario)
        const shown = new Set<string>()
        const now = Date.now()
        for (const entry of store.world.assistant.showcase) {
          const thread = yield* client.assistant.conversation({ params: { id: entry.id } })
          if (thread.conversation.agentId !== null) shown.add("about an agent")
          for (const turn of entriesOf(thread.messages)) {
            if (turn._tag !== "Bluechip") continue
            for (const result of resultCardsOf(turn)) {
              shown.add(`result ${resultKind(result)}.${resultState(result)}`)
              if (result._tag === "Rebalance" && result.legs.length > 0) {
                shown.add(result.portfolio === null ? "result rebalance.noMix" : "result rebalance.mix")
              }
            }
          }
          for (const message of thread.messages) {
            for (const part of message.parts) {
              if (part.type === "toolResult") {
                const summary = toolSummary(part.name, part.result)
                shown.add(`tool ${part.isFailure ? "failed" : "done"}`)
                if (!part.isFailure && summary !== null) shown.add(`tool ${part.name}`)
                if (summary !== null) shown.add(`says ${summary}`)
              }
              if (part.type === "error") shown.add("error part")
              if (part.type === "text" && /\|.*\|/.test(part.text) && /\[\[[A-Z]+\]\]/.test(part.text)) {
                shown.add("table with chips")
              }
              if (part.type === "text" && part.text.includes("```")) shown.add("code")
              if (part.type !== "card") continue
              const card = part.card
              shown.add(card._tag)
              if ("status" in card) shown.add(`${card._tag}.${card.status}`)
              if ("action" in card) shown.add(`${card._tag}.${card.action}`)
              switch (card._tag) {
                case "Error":
                  shown.add(`Error.${card.reason}`)
                  break
                case "Trade":
                  shown.add(`Trade.${card.intent.status}`)
                  if (card.intent.status === "filled" && card.intent.tradeId !== null) {
                    // The receipt the card shows once it fills, read as the web app reads it.
                    const trade = yield* client.trades.trade({ params: { id: card.intent.tradeId } })
                    if (trade.status === "filled") shown.add("Trade.receipt")
                  }
                  if (card.intent.batch !== null) shown.add("Trade.batch")
                  if (card.intent.agentId === null) shown.add("Trade.yours")
                  if (card.intent.leg.side === "sell") shown.add("Trade.sell")
                  if (card.intent.decision?._tag === "Wait") shown.add(`Trade.wait.${card.intent.decision.reason}`)
                  break
                case "Approval":
                  if (card.request.quote.symbol === card.intent.leg.symbol) shown.add("Approval.orderPreview")
                  if (card.request.together.length > 0) shown.add("Approval.together")
                  if (card.request.warnings.length > 0) shown.add("Approval.warnings")
                  if (card.request.deploysAccount) shown.add("Approval.setsUpAccount")
                  shown.add(
                    DateTime.toEpochMillis(card.request.expiresAt) < now ? "Approval.expired" : "Approval.fresh"
                  )
                  break
                case "DraftAgent": {
                  const automations = card.automations ?? []
                  shown.add(`DraftAgent.${card.agent.status}`)
                  if (worstCaseLines(worstCaseOf(card.agent.spec)).length > 1) shown.add("DraftAgent.worstCase")
                  if (automations.length === 0) shown.add("DraftAgent.noAutomations")
                  if (automations.some((one) => !one.kept)) shown.add("DraftAgent.leftOut")
                  if (automations.some((one) => one.automationId !== null)) shown.add("DraftAgent.started")
                  if (
                    card.agent.status === "active" && automations.some((one) => one.kept && one.automationId === null)
                  ) {
                    shown.add("DraftAgent.starting")
                  }
                  break
                }
                case "PolicyChange":
                  shown.add(`PolicyChange.${card.action}.${card.request === null ? "done" : card.agent.status}`)
                  if (card.changes !== null) shown.add(`PolicyChange.${card.changes.overall}`)
                  break
                case "Automation":
                  if (card.description.settings.length > 0) shown.add("Automation.settings")
                  break
              }
            }
          }
        }

        const checklist = [
          "about an agent",
          "tool done",
          "tool failed",
          "error part",
          "table with chips",
          "code",
          ...[
            "getPortfolio",
            "getPrices",
            "getStock",
            "getQuote",
            "getActivity",
            "listAgents",
            "getAgent",
            "getAgentHistory",
            "listPolicies",
            "listTemplates",
            "checkAgentSpec",
            "listMemories",
            "searchMemory",
            "searchHelp",
            "getPerformance",
            "getStockPerformance",
            "getAgentPerformance",
            "getAutomationPerformance",
            "getStockFacts",
            "proposeRebalance"
          ].map((tool) => `tool ${tool}`),
          ...[
            "No stocks",
            "Nothing yet",
            "No agents yet",
            "No trades yet",
            "Nothing found",
            "Nothing to trade",
            "No problems",
            "1 problem",
            "SpaceX, no price"
          ].map((summary) => `says ${summary}`),
          ...[
            "proposed",
            "deciding",
            "sending",
            "confirming",
            "filled",
            "failed",
            "needsApproval",
            "awaitingSignature",
            "declined",
            "expired",
            "cancelled",
            "blocked",
            "waiting"
          ].map((status) => `Trade.${status}`),
          ...["pricesPaused", "pricesStale", "noGas", "gasPrice", "gasSpent", "dayEnding", "unavailable"]
            .map((reason) => `Trade.wait.${reason}`),
          "Trade.batch",
          "Trade.yours",
          "Trade.sell",
          "Approval.fresh",
          "Approval.expired",
          "Approval.together",
          "Approval.warnings",
          "Approval.setsUpAccount",
          "DraftAgent.draft",
          "DraftAgent.locking",
          "DraftAgent.active",
          "DraftAgent.noAutomations",
          "DraftAgent.leftOut",
          "DraftAgent.started",
          "DraftAgent.starting",
          "PolicyChange.update.active",
          "PolicyChange.update.updating",
          "PolicyChange.renew.active",
          "PolicyChange.renew.expired",
          "PolicyChange.remove.active",
          "PolicyChange.remove.removing",
          "PolicyChange.remove.done",
          "PolicyChange.tighter",
          "PolicyChange.looser",
          ...["AgentControl", "SaveTemplate", "Automation", "AutomationControl", "Memory"].flatMap((tag) =>
            ["pending", "applied", "dismissed"].map((status) => `${tag}.${status}`)
          ),
          "AgentControl.pause",
          "AgentControl.resume",
          "AgentControl.pauseAll",
          "Automation.create",
          "Automation.edit",
          "Automation.settings",
          "AutomationControl.pause",
          "AutomationControl.resume",
          "Memory.confirm",
          "Memory.saved",
          "Memory.forgotten",
          "Research",
          ...["budget", "rounds", "cancelled", "interrupted", "unavailable"].map((reason) => `Error.${reason}`),
          "Trade.receipt",
          "Approval.orderPreview",
          "DraftAgent.worstCase",
          ...Object.entries(RESULT_STATES).flatMap(([kind, states]) =>
            states.map((state) => `result ${kind}.${state}`)
          ),
          "result rebalance.mix",
          "result rebalance.noMix"
        ]

        // What the checklist names that no showcase chat shows.
        assert.deepStrictEqual(checklist.filter((variant) => !shown.has(variant)), [])
      }))
  }
})
