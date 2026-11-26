// "Approve the rebalance": a rebalancer's plan as several trades (one waiting for you, one sent, one waiting for
// prices), why the big one needs you, with a table, and its rules offered as a template.
import type { Card } from "@bluechip/domain/assistant/Card"
import { agentFor } from "../cards.ts"
import { saveTemplateCard } from "../cards/agentCards.ts"
import { tradeCard } from "../cards/tradeCards.ts"
import { getAgent } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const approval = ({ mint, conversation }: ThreadContext): ReadonlyArray<Turn> => {
  const agent = agentFor(mint, mint.cast.agents.find((candidate) => candidate.id === conversation.agentId) ?? null)
  const at = conversation.hoursAgo
  const plan: ReadonlyArray<Card> = [
    tradeCard(mint, agent, "asking", { symbol: "NVDA", dollars: 820, hoursAgo: at }),
    tradeCard(mint, agent, "sent", { symbol: "AMZN", dollars: 140, hoursAgo: at }),
    tradeCard(mint, agent, "waiting", { symbol: "MSFT", dollars: 95, hoursAgo: at })
  ]

  return [
    {
      you: `Rebalance ${agent.name} back to its mix`,
      rounds: [
        [getAgent(mint, agent)],
        [
          say("Three stocks drifted past its 5% trigger. Here's the plan."),
          shows(mint, "proposeRebalance", { agentId: agent.id, reason: "Back to the target mix." }, plan)
        ],
        [
          say(
            "Amazon went through. Microsoft waits for prices, since the market is closed. Nvidia is bigger than the " +
              "agent's largest trade, so it's waiting for your Face ID."
          )
        ]
      ]
    },
    {
      you: "Why does the Nvidia one need me?",
      rounds: [[
        say(
          `Nvidia fell the furthest behind, so bringing it back means an **$820** buy, and ${agent.name}'s largest trade is ` +
            "$500. Anything over that waits for you.\n\n" +
            "| Stock | Target | Now | Trade |\n| --- | ---: | ---: | ---: |\n" +
            "| [[NVDA]] | 20% | 13.1% | buy $820 |\n| [[AMZN]] | 20% | 18.6% | buy $140 |\n" +
            "| [[MSFT]] | 20% | 19.1% | buy $95 |\n| [[AAPL]] | 20% | 20.3% | none |\n| Cash | 20% | 28.9% | pays for the buys |\n\n" +
            "Approve it on the card above and the mix is back on target."
        )
      ]]
    },
    {
      you: `Save ${agent.name}'s rules as a template called Even five`,
      rounds: [[
        shows(
          mint,
          "saveTemplate",
          { name: "Even five", agentId: agent.id },
          saveTemplateCard(mint, agent, "Even five", "pending")
        ),
        say("Confirm on the card and it's saved.")
      ]]
    }
  ]
}
