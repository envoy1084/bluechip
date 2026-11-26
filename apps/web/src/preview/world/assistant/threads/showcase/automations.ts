// "Every automation card": new ones and changes in each state, pausing and resuming, one the catalog refused, and a
// drafted agent's automations kept, left out and started.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { AutomationId } from "@bluechip/domain/Ids"
import { agentFor, castAutomationDraft } from "../../cards.ts"
import { draftAgentCard } from "../../cards/agentCards.ts"
import { automationControlCard, draftOf } from "../../cards/automationCards.ts"
import { draftedAgent } from "../../castRecords.ts"
import { fails, say, shows, type ThreadContext, type Turn } from "../../rounds.ts"
import { cardTurn } from "./cardTurns.ts"

export const everyAutomationCard = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { mint } = context
  const agent = agentFor(mint, null)
  const saved = mint.cast.automations[0]
  const automation = saved === undefined ?
    { id: mint.id("automation") as AutomationId, name: "Weekly Apple", draft: draftOf("weeklyBuy", agent) } :
    castAutomationDraft(mint, saved)
  const techBuyer = {
    name: "Weekly tech buyer",
    template: "weeklyBuyer",
    preset: "balanced",
    stocks: ["AAPL", "MSFT", "NVDA"],
    targets: []
  } as const
  const buyer = draftedAgent(mint, techBuyer)
  const kept = draftAgentCard(mint, buyer)
  const someLeftOut: Card = kept._tag !== "DraftAgent" ? kept : {
    ...kept,
    automations: (kept.automations ?? []).map((one, index) => index === 1 ? { ...one, kept: false } : one)
  }
  const live = draftAgentCard(mint, draftedAgent(mint, { ...techBuyer, name: "Weekly chip buyer" }, "active"), {
    started: [0, 1, 2].map(() => mint.id("automation") as AutomationId)
  })

  return [
    cardTurn(context, "If Tesla has bad news, ask me whether to sell half", [["automationCreate", "pending"]]),
    cardTurn(context, "Save it", [["automationCreate", "applied"]], { after: "Saved. It watches the news from now." }),
    cardTurn(context, "Never mind that one", [["automationCreate", "dismissed"]]),
    cardTurn(context, `Make "${automation.name}" run on Tuesdays`, [["automationEdit", "pending"], [
      "automationEdit",
      "applied"
    ], ["automationEdit", "dismissed"]]),
    {
      you: "Buy $5,000 of Nvidia every hour",
      rounds: [[
        fails(
          mint,
          "createAutomation",
          { draft: { name: "Hourly Nvidia", amount: 5000 }, automationId: null },
          "Its buy of $5,000 is more than the agent's largest trade of $100, and schedules run at most daily."
        )
      ], [
        say(
          "I can't set that up: $5,000 is over the agent's largest trade, and schedules run at most once a day. " +
            "Want $100 every weekday instead?"
        )
      ]]
    },
    {
      you: `Pause "${automation.name}"`,
      rounds: [[
        shows(mint, "pauseAutomation", { automationId: automation.id }, [
          automationControlCard(mint, "pause", automation, "pending"),
          automationControlCard(mint, "pause", automation, "applied"),
          automationControlCard(mint, "pause", automation, "dismissed")
        ])
      ]]
    },
    {
      you: "Resume it",
      rounds: [[
        shows(mint, "pauseAutomation", { automationId: automation.id }, [
          automationControlCard(mint, "resume", automation, "pending"),
          automationControlCard(mint, "resume", automation, "applied")
        ])
      ]]
    },
    {
      you: "Draft a buyer for Apple, Microsoft and Nvidia, but skip the Microsoft buy",
      rounds: [[
        say("It comes with a weekly buy per stock. I left Microsoft's out; switch it back on if you like."),
        shows(mint, "draftAgent", { name: buyer.name }, someLeftOut)
      ]]
    },
    {
      you: "And the chip buyer I locked last week?",
      rounds: [[
        say("It's live, and its three weekly buys started with it."),
        shows(mint, "draftAgent", { name: "Weekly chip buyer" }, live)
      ]]
    }
  ]
}
