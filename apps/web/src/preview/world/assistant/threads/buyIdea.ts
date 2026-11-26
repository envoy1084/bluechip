// "Buy some Nvidia": a quote, a trade the agent sent, one over its largest trade waiting for you, your own trade whose
// Face ID request ran out and, for a heavy user, one its stock cap refused.
import { agentFor } from "../cards.ts"
import { approvalCard, tradeCard } from "../cards/tradeCards.ts"
import { getQuote } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const buyIdea = ({ mint, conversation }: ThreadContext): ReadonlyArray<Turn> => {
  const agent = agentFor(mint, mint.cast.agents.find((candidate) => candidate.id === conversation.agentId) ?? null)
  const at = conversation.hoursAgo
  const sent = tradeCard(mint, agent, "sent", { symbol: "NVDA", dollars: 50, hoursAgo: at })
  const asking = tradeCard(mint, agent, "asking", { symbol: "NVDA", dollars: 400, hoursAgo: at })
  const yours = approvalCard(mint, { symbol: "AAPL", dollars: 60, expired: true, hoursAgo: at })

  return [
    {
      you: "What's Nvidia trading at?",
      rounds: [
        [getQuote(mint, "NVDA", 50)],
        [
          say(
            "[[NVDA]] is at **$178.42** a share on Chainlink. In its pool, $50 buys about **0.28 shares**, 0.2% " +
              "above Chainlink's price, which is normal for a trade that size."
          )
        ]
      ]
    },
    {
      you: `Buy $50 of it through ${agent.name}`,
      rounds: [[
        say(`On it. ${agent.name}'s policies decide this one.`),
        shows(mint, "proposeTrade", {
          agentId: agent.id,
          symbol: "NVDA",
          side: "buy",
          dollars: 50,
          shares: null,
          reason: "You asked for $50 of Nvidia."
        }, sent)
      ], [say(`${agent.name} bought it within its rules. You can follow it on the card.`)]]
    },
    {
      you: "Buy another $400",
      rounds: [[
        shows(mint, "proposeTrade", {
          agentId: agent.id,
          symbol: "NVDA",
          side: "buy",
          dollars: 400,
          shares: null,
          reason: "You asked for $400 more of Nvidia."
        }, asking)
      ], [
        say(
          `$400 is more than ${agent.name}'s largest trade of $100, so it can't send it alone. It's waiting for ` +
            "your approval with Face ID on the card. If you'd rather it could, raise its largest trade on the " +
            "agent's page."
        )
      ]]
    },
    {
      you: "Then buy $60 of Apple for me directly",
      rounds: [[
        say("Here it is as your own trade. Nothing happens until you approve it."),
        shows(mint, "proposeTrade", {
          agentId: null,
          symbol: "AAPL",
          side: "buy",
          dollars: 60,
          shares: null,
          reason: "You asked to buy $60 of Apple yourself."
        }, yours)
      ]]
    },
    ...(mint.cast.scenario !== "heavy" ? [] : [{
      you: "And put $100 into Microsoft through it too",
      rounds: [[
        shows(mint, "proposeTrade", {
          agentId: agent.id,
          symbol: "MSFT",
          side: "buy",
          dollars: 100,
          shares: null,
          reason: "You asked for $100 of Microsoft."
        }, tradeCard(mint, agent, "blocked", { symbol: "MSFT", dollars: 100, hoursAgo: at }))
      ], [
        say(
          `${agent.name}'s stock cap refused it: Microsoft would be **34%** of your portfolio, and the agent may ` +
            "hold at most 30% of any one stock. Nothing was sent.\n\nYou could:\n\n" +
            "1. Buy less, about $40 fits under the cap.\n2. Raise the cap on the agent's page.\n" +
            "3. Buy it yourself, outside the agent's rules."
        )
      ]]
    }])
  ]
}
