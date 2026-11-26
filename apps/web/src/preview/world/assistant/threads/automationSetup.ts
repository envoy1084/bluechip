// "Protect my Tesla": a stop-loss drafted and left out, a news automation saved instead, then it and the agent paused.
import type { AutomationId } from "@bluechip/domain/Ids"
import { agentFor, castAutomationDraft } from "../cards.ts"
import { agentControlCard } from "../cards/agentCards.ts"
import { automationCard, automationControlCard, draftOf } from "../cards/automationCards.ts"
import { agentOf } from "../castRecords.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const automationSetup = ({ mint, conversation }: ThreadContext): ReadonlyArray<Turn> => {
  const agent = agentFor(mint, mint.cast.agents.find((candidate) => candidate.id === conversation.agentId) ?? null)
  const saved = mint.cast.automations.find((automation) => automation.kind === "newsSell")
  const news = saved === undefined ?
    { id: mint.id("automation") as AutomationId, name: "Sell Tesla on bad news", draft: draftOf("newsSell", agent) } :
    castAutomationDraft(mint, saved)

  return [
    {
      you: "If Tesla drops 10% from its high, sell half",
      rounds: [[
        say("Here's that as an automation. Nothing runs until you save it."),
        shows(
          mint,
          "createAutomation",
          { automationId: null },
          automationCard(mint, draftOf("stopLoss", agent), { status: "dismissed" })
        )
      ]]
    },
    {
      you: "Actually, just ask me first if there's bad news about Tesla",
      rounds: [[
        shows(
          mint,
          "createAutomation",
          { automationId: null },
          automationCard(mint, news.draft, { status: "applied", automationId: news.id })
        )
      ], [
        say(
          `Saved. When a story about Tesla mentions a recall or an investigation, ${agent.name} asks you whether to ` +
            "sell half. It waits at least a day between asks."
        )
      ]]
    },
    {
      you: "Pause that for now",
      rounds: [[
        shows(
          mint,
          "pauseAutomation",
          { automationId: news.id },
          automationControlCard(mint, "pause", news, "applied")
        ),
        say("Paused. Resume it from the card or the automation's page.")
      ]]
    },
    {
      you: `And pause ${agent.name} too`,
      rounds: [[
        shows(
          mint,
          "pauseAgent",
          { agentId: agent.id },
          agentControlCard(mint, "pause", [agentOf(mint, { ...agent, state: "active" })], "applied")
        ),
        say(`${agent.name} is paused. Its rules stay locked, and nothing it proposes is sent until you resume it.`)
      ]]
    }
  ]
}
