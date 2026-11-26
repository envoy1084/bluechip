// "How is Microsoft doing?": a web search with its research card and an answer citing it, then the agent read and a
// tighter set of policies offered for Face ID.
import { agentFor, makeCard, roundOf } from "../cards.ts"
import { policyChangeCard } from "../cards/agentCards.ts"
import { agentOf } from "../castRecords.ts"
import { getAgent } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const research = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const picker = agentFor(mint, mint.cast.agents.find((agent) => agent.template === "stockPicker") ?? null)
  const found = makeCard(mint, "research", "applied", null)

  return [
    {
      you: "How is Microsoft doing?",
      rounds: [[
        ...roundOf(mint, { ...found, lead: "" }),
        say(
          "[[MSFT]] had a strong quarter. The short version:\n\n" +
            "- **Cloud is the engine.** Azure grew **39%**, faster than most expected " +
            "([Microsoft](https://news.microsoft.com/source/fy26-q1-earnings)).\n" +
            "- **It keeps spending on AI.** Data centre spending went up again, which some investors worry about " +
            "([Reuters](https://www.reuters.com/technology/microsoft-capex-ai-2026)).\n" +
            "- **The OpenAI deal changed.** It now owns about 27% of the new company " +
            "([FT](https://www.ft.com/content/microsoft-openai-stake)).\n\n" +
            "These are other people's views, not advice. You hold 14 shares, about **$7,170** at today's price."
        )
      ]]
    },
    {
      you: `Should ${picker.name} buy more of it?`,
      rounds: [
        [getAgent(mint, picker)],
        [
          say(
            `That's your call, but ${picker.name} can already buy Microsoft. If you'd like it to go slower while ` +
              "spending is this high, here's a tighter version: a smaller daily budget and largest trade."
          ),
          shows(
            mint,
            "changeAgentPolicies",
            { agentId: picker.id },
            policyChangeCard(mint, picker, agentOf(mint, picker), "update")
          )
        ]
      ]
    }
  ]
}
