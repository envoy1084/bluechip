// "Set up a weekly buyer": templates read and the spec checked, the agent drafted (now live, its automation started),
// what it can never do, and its policies saved as a template.
import type { AutomationId } from "@bluechip/domain/Ids"
import { agentFor } from "../cards.ts"
import { draftAgentCard, saveTemplateCard } from "../cards/agentCards.ts"
import { agentOf, draftedAgent, specOf } from "../castRecords.ts"
import { checkSpec, listTemplates } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const newAgent = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const weekly = mint.cast.agents.find((agent) => agent.template === "weeklyBuyer")
  const cast = agentFor(mint, weekly ?? null)
  const agent = weekly === undefined ? draftedAgent(mint, cast) : agentOf(mint, weekly)
  const started = mint.cast.automations.flatMap((automation) =>
    automation.agentId === agent.id && automation.kind === "weeklyBuy" ? [automation.id as AutomationId] : []
  )

  return [
    {
      you: "Set up an agent that buys Apple every week, $50 at a time",
      rounds: [
        [listTemplates(mint), checkSpec(mint, specOf(cast))],
        [
          say("A **Weekly buyer** fits: it only ever buys, on a schedule. Here's the draft."),
          shows(
            mint,
            "draftAgent",
            { name: agent.name, draft: { template: "weeklyBuyer", preset: cast.preset, stocks: cast.stocks } },
            draftAgentCard(mint, agent, { started })
          )
        ],
        [
          say(
            "It buys Apple every Monday at 10:00 New York time, up to its daily budget. Lock it with Face ID and the " +
              "weekly buy starts with it."
          )
        ]
      ]
    },
    {
      you: "Can it ever sell?",
      rounds: [[
        say(
          "No. Its policies are locked onchain, and they only allow buys. It also can never:\n\n" +
            "- trade any stock but Apple\n- spend more than its daily budget\n- touch your cash reserve\n" +
            "- change its own policies\n\nTo sell, you'd do it yourself, or set up a different agent."
        )
      ]]
    },
    {
      you: "Save this setup so I can reuse it",
      rounds: [[
        shows(
          mint,
          "saveTemplate",
          { name: "Weekly Apple", agentId: agent.id },
          saveTemplateCard(mint, cast, "Weekly Apple", "applied")
        ),
        say("Saved. It's under your templates when you start a new agent.")
      ]]
    }
  ]
}
