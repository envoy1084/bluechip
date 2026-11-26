// "Card gallery": every card the chat draws, in every state it can be in (what tools read too, in `resultGallery.ts`),
// one after another with a short ask between them, so they can be reviewed in order. Confirm failing (answered already,
// no longer valid) is a panel setting, since it happens when you press the button, not in a stored card.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Card, CardStatus } from "@bluechip/domain/assistant/Card"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import type { AutomationId } from "@bluechip/domain/Ids"
import type { WaitReason } from "@bluechip/domain/intents/Intent"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../../../cast.ts"
import { agentFor, type CardKind, castAutomationDraft, makeCard, roundOf } from "../../cards.ts"
import { draftAgentCard, policyChangeCard } from "../../cards/agentCards.ts"
import { automationCard, automationControlCard, draftOf } from "../../cards/automationCards.ts"
import { approvalCard, tradeCard, type TradeOutcome } from "../../cards/tradeCards.ts"
import { draftedAgent } from "../../castRecords.ts"
import { type Round, say, shows, type ThreadContext, type Turn } from "../../rounds.ts"
import { resultGallery } from "./resultGallery.ts"

const STATES: ReadonlyArray<CardStatus> = ["pending", "applied", "dismissed"]

const STATE_WORDS: Readonly<Record<CardStatus, string>> = {
  pending: "waiting for you",
  applied: "confirmed",
  dismissed: "dismissed"
}

const WAITS: ReadonlyArray<readonly [WaitReason, string]> = [
  ["pricesPaused", "prices paused"],
  ["pricesStale", "prices too old"],
  ["noGas", "no ETH for gas"],
  ["gasPrice", "gas too dear"],
  ["gasSpent", "gas budget spent"],
  ["dayEnding", "the day's last minute"],
  ["unavailable", "Base not answering"]
]

const TRADES: ReadonlyArray<readonly [TradeOutcome, string]> = [
  ["proposed", "just asked"],
  ["deciding", "being checked"],
  ["sending", "being sent"],
  ["confirming", "confirming on Base"],
  ["sent", "filled"],
  ["failed", "failed on Base"],
  ["asking", "over its largest trade"],
  ["approved", "approved, to sign"],
  ["declined", "declined"],
  ["expired", "run out"],
  ["cancelled", "cancelled"],
  ["blocked", "refused by a policy"]
]

const KIND_WORDS: Readonly<Record<string, string>> = {
  pauseAgent: "Pause an agent",
  resumeAgent: "Resume an agent",
  pauseAll: "Pause every agent",
  saveTemplate: "Save a template",
  automationCreate: "A new automation",
  automationEdit: "Change an automation",
  errorBudget: "Stopped: the day's budget",
  errorRounds: "Stopped: too many steps",
  errorCancelled: "Stopped: you pressed Stop",
  errorInterrupted: "Stopped: the connection dropped",
  errorUnavailable: "Stopped: the model is unavailable"
}

export const cardGallery = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { mint } = context
  const cast = agentFor(mint, null)
  const keeper = agentFor(mint, mint.cast.agents.find((agent) => agent.template === "rebalancer") ?? null)
  const turn = (you: string, round: Round): Turn => ({ you, rounds: [round] })
  const card = (name: string, shown: Card | ReadonlyArray<Card>): Round => [shows(mint, name, {}, shown)]
  const made = (kind: CardKind, status: CardStatus): Round => {
    const result = makeCard(mint, kind, status, null)
    context.keep(result.memories)
    return roundOf(mint, result)
  }
  const drafted = (name: string, status: Agent["status"], template: CastAgent["template"] = "weeklyBuyer") =>
    draftedAgent(mint, { name, template, preset: "balanced", stocks: ["AAPL", "MSFT"], targets: [] }, status)
  const leftOut = (shown: Card): Card =>
    shown._tag !== "DraftAgent" ? shown : {
      ...shown,
      automations: (shown.automations ?? []).map((one, index) => index === 0 ? one : { ...one, kept: false })
    }
  const saved = mint.cast.automations[0]
  const automation = saved === undefined ?
    { id: mint.id("automation") as AutomationId, name: "Weekly Apple", draft: draftOf("weeklyBuy", cast) } :
    castAutomationDraft(mint, saved)
  const withSettings = new AutomationDraft({
    ...draftOf("priceAlert", null),
    settings: {
      cooldownMinutes: 240,
      maxFires: 3,
      expiresAt: DateTime.add(mint.at(0), { days: 30 }),
      quietHours: null,
      marketHoursOnly: true,
      actDirectly: false
    }
  })

  return [
    { you: "Show me every card, one at a time", rounds: [[say("Here they are, starting with trades.")]] },
    ...TRADES.map(([outcome, words]) =>
      turn(`An agent's trade, ${words}`, card("proposeTrade", tradeCard(mint, cast, outcome)))
    ),
    ...WAITS.map(([reason, words]) =>
      turn(`A trade waiting: ${words}`, card("proposeTrade", tradeCard(mint, cast, "waiting", { waitReason: reason })))
    ),
    turn("An agent's sell", card("proposeTrade", tradeCard(mint, cast, "sent", { sellShares: 1.5 }))),
    turn("Your own trade, once signed", card("proposeTrade", tradeCard(mint, cast, "sent", { yours: true }))),
    turn(
      "A plan sent in waves",
      card("proposeRebalance", [
        tradeCard(mint, keeper, "sent", { symbol: "AMZN", batch: { id: "gallery", wave: 0 } }),
        tradeCard(mint, keeper, "confirming", { symbol: "MSFT", batch: { id: "gallery", wave: 0 } }),
        tradeCard(mint, keeper, "asking", { symbol: "NVDA", batch: { id: "gallery", wave: 1 } })
      ])
    ),
    turn("A plan with nothing to trade", [shows(mint, "proposeRebalance", {}, []), say("Nothing drifted: no trades.")]),
    turn(
      "Your trade for Face ID",
      card("proposeTrade", approvalCard(mint, { symbol: "AAPL", dollars: 60, expired: false }))
    ),
    turn(
      "One whose request ran out",
      card("proposeTrade", approvalCard(mint, { symbol: "NVDA", dollars: 45, expired: true }))
    ),
    turn(
      "Several stocks, one signature, market closed",
      card(
        "proposeTrade",
        approvalCard(mint, {
          symbol: "AAPL",
          dollars: 25,
          expired: false,
          together: ["AMZN", "GOOGL"],
          pricesPaused: true
        })
      )
    ),
    turn(
      "Your first trade, which sets up your account",
      card("proposeTrade", approvalCard(mint, { symbol: "AAPL", dollars: 20, expired: false, setsUpAccount: true }))
    ),
    turn(
      "A draft agent with its automations",
      card("draftAgent", draftAgentCard(mint, drafted("Weekly duo", "draft")))
    ),
    turn(
      "A draft with an automation left out",
      card("draftAgent", leftOut(draftAgentCard(mint, drafted("Weekly duo, trimmed", "draft"))))
    ),
    turn(
      "A draft without automations",
      card("draftAgent", draftAgentCard(mint, drafted("Duo picker", "draft", "stockPicker")))
    ),
    turn("A draft being locked", card("draftAgent", draftAgentCard(mint, drafted("Weekly duo, locking", "locking")))),
    turn(
      "Live, its automations starting",
      card("draftAgent", draftAgentCard(mint, drafted("Weekly duo, starting", "active")))
    ),
    turn(
      "Live, its automations started",
      card(
        "draftAgent",
        draftAgentCard(mint, drafted("Weekly duo, live", "active"), {
          started: [mint.id("automation") as AutomationId, mint.id("automation") as AutomationId]
        })
      )
    ),
    turn(
      "Tighter rules for an agent",
      card("changeAgentPolicies", policyChangeCard(mint, cast, drafted(cast.name, "active", cast.template), "update"))
    ),
    turn(
      "Looser rules, flagged",
      card(
        "changeAgentPolicies",
        policyChangeCard(mint, cast, drafted(cast.name, "active", cast.template), "update", true)
      )
    ),
    turn(
      "A change already on its way",
      card("changeAgentPolicies", policyChangeCard(mint, cast, drafted(cast.name, "updating", cast.template), "update"))
    ),
    turn(
      "Renew a running agent",
      card("renewAgent", policyChangeCard(mint, cast, drafted(cast.name, "active"), "renew"))
    ),
    turn(
      "Renew one that ran out",
      card("renewAgent", policyChangeCard(mint, cast, drafted(cast.name, "expired"), "renew"))
    ),
    turn("Remove an agent", card("removeAgent", policyChangeCard(mint, cast, drafted(cast.name, "active"), "remove"))),
    turn(
      "One being removed",
      card("removeAgent", policyChangeCard(mint, cast, drafted(cast.name, "removing"), "remove"))
    ),
    turn("A removed draft", card("removeAgent", policyChangeCard(mint, cast, drafted("Old draft", "draft"), "remove"))),
    ...(["pauseAgent", "resumeAgent", "pauseAll", "saveTemplate", "automationCreate", "automationEdit"] as const)
      .flatMap((kind) =>
        STATES.map((status) => turn(`${KIND_WORDS[kind]}, ${STATE_WORDS[status]}`, made(kind, status)))
      ),
    turn(
      "An automation with settings",
      card("createAutomation", automationCard(mint, withSettings, { status: "pending" }))
    ),
    ...(["pause", "resume"] as const).flatMap((action) =>
      STATES.map((status) =>
        turn(
          `${action === "pause" ? "Pause" : "Resume"} an automation, ${STATE_WORDS[status]}`,
          card("pauseAutomation", automationControlCard(mint, action, automation, status))
        )
      )
    ),
    ...STATES.map((status) => turn(`A memory to confirm, ${STATE_WORDS[status]}`, made("memoryConfirm", status))),
    turn("A memory saved", made("memorySaved", "applied")),
    turn("A memory forgotten", made("memoryForgotten", "applied")),
    turn("Research with citations", made("research", "applied")),
    ...(["errorBudget", "errorRounds", "errorCancelled", "errorInterrupted", "errorUnavailable"] as const).map((kind) =>
      turn(KIND_WORDS[kind], made(kind, "applied"))
    ),
    ...resultGallery(context),
    { you: "That's all of them?", rounds: [[say("That's every card. Try confirming or dismissing the ones waiting.")]] }
  ]
}
