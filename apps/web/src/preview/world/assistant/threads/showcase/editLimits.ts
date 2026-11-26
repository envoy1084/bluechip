// "Change my agent's limits": a trade refused by its limit, then the limits raised (looser, flagged) and lowered
// (tighter) with the change policy by policy, a change on its way, renewing and removing.
import { agentFor } from "../../cards.ts"
import { policyChangeCard } from "../../cards/agentCards.ts"
import { tradeCard } from "../../cards/tradeCards.ts"
import { agentOf, draftedAgent } from "../../castRecords.ts"
import { getAgent, getAgentUsage } from "../../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../../rounds.ts"

export const editLimits = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const cast = agentFor(mint, mint.cast.agents.find((agent) => agent.state === "active") ?? null)
  const agent = mint.cast.agents.includes(cast) ? agentOf(mint, cast) : draftedAgent(mint, cast, "active")

  return [
    {
      you: `Buy $100 of ${cast.stocks[0] === "NVDA" ? "Nvidia" : "it"} through ${cast.name}`,
      rounds: [[shows(mint, "proposeTrade", {}, tradeCard(mint, cast, "blocked", { dollars: 100 }))], [
        say(`Its stock cap refused it. Want me to change ${cast.name}'s limits?`)
      ]]
    },
    {
      you: "How much has it used today?",
      rounds: [[getAgentUsage(mint, cast), getAgent(mint, cast)], [
        say("| Limit | Used | Of |\n| --- | ---: | ---: |\n| Daily budget | $180 | $250 |\n| Trades today | 4 | 500 |")
      ]]
    },
    {
      you: "Raise its limits",
      rounds: [[
        say("Here's the change. It lets the agent do more, so it's marked looser."),
        shows(mint, "changeAgentPolicies", { agentId: cast.id }, policyChangeCard(mint, cast, agent, "update", true))
      ]]
    },
    {
      you: "Actually, make it more careful instead",
      rounds: [[
        shows(mint, "changeAgentPolicies", { agentId: cast.id }, policyChangeCard(mint, cast, agent, "update"))
      ]]
    },
    {
      you: "I approved it. Where is it?",
      rounds: [[
        say("On its way to Base."),
        shows(
          mint,
          "changeAgentPolicies",
          {},
          policyChangeCard(mint, cast, draftedAgent(mint, cast, "updating"), "update")
        )
      ]]
    },
    {
      you: "Renew it while we're at it",
      rounds: [[shows(mint, "renewAgent", { agentId: cast.id }, policyChangeCard(mint, cast, agent, "renew"))]]
    },
    {
      you: "And if I wanted to remove it?",
      rounds: [[shows(mint, "removeAgent", { agentId: cast.id }, policyChangeCard(mint, cast, agent, "remove"))]]
    }
  ]
}
