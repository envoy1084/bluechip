// "Every trade card, in each state": an agent's trades sent, on their way, failed, waiting for you, approved,
// declined, run out, refused and waiting for prices; your own trade fresh, run out, and with a plan's other legs;
// and a rebalance sent in waves.
import type { Card } from "@bluechip/domain/assistant/Card"
import { getPortfolio } from "../../accountReads.ts"
import { agentFor } from "../../cards.ts"
import { approvalCard, tradeCard, type TradeOutcome } from "../../cards/tradeCards.ts"
import { say, shows, type ThreadContext, type Turn } from "../../rounds.ts"

export const everyTrade = ({ mint, conversation }: ThreadContext): ReadonlyArray<Turn> => {
  const agent = agentFor(mint, mint.cast.agents.find((candidate) => candidate.template === "stockPicker") ?? null)
  const keeper = agentFor(mint, mint.cast.agents.find((candidate) => candidate.template === "rebalancer") ?? null)
  const at = conversation.hoursAgo
  const trade = (outcome: TradeOutcome, you: string, after: string, options: Parameters<typeof tradeCard>[3] = {}) => ({
    you,
    rounds: [
      [shows(
        mint,
        "proposeTrade",
        { agentId: agent.id, reason: you },
        tradeCard(mint, agent, outcome, {
          hoursAgo: at,
          ...options
        })
      )],
      [say(after)]
    ]
  })
  const plan: ReadonlyArray<Card> = [
    tradeCard(mint, keeper, "sent", { symbol: "AMZN", dollars: 120, hoursAgo: at, batch: { id: "plan-1", wave: 0 } }),
    tradeCard(mint, keeper, "sent", { symbol: "MSFT", dollars: 80, hoursAgo: at, batch: { id: "plan-1", wave: 0 } }),
    tradeCard(mint, keeper, "asking", {
      symbol: "NVDA",
      dollars: 640,
      hoursAgo: at,
      batch: { id: "plan-1", wave: 1 }
    })
  ]

  return [
    trade("sent", `Buy $50 of Nvidia through ${agent.name}`, "Sent and filled within its rules."),
    trade("sending", "And $40 of Apple", "On its way: Base is confirming it.", { symbol: "AAPL", dollars: 40 }),
    trade(
      "failed",
      "Sell 2 Microsoft shares",
      "Base didn't take this one, so nothing moved. Trying again usually works.",
      { symbol: "MSFT", sellShares: 2 }
    ),
    trade("asking", "Buy $400 more Nvidia", `That's over ${agent.name}'s largest trade, so it waits for your Face ID.`),
    trade("approved", "I said yes to that one", "Approved: it's ready to sign with Face ID.", { dollars: 300 }),
    trade("declined", "Skip the next big one", "Declined. Nothing was sent.", { dollars: 350 }),
    trade("expired", "What happened to yesterday's?", "It waited a day without an answer, so it ran out.", {
      dollars: 280
    }),
    trade(
      "blocked",
      "Buy $100 of Microsoft",
      "Its Max in one stock policy refused it: nothing was sent.",
      { symbol: "MSFT", dollars: 100 }
    ),
    trade("waiting", "Buy $30 of Apple tonight", "The market is closed, so it waits for prices.", {
      symbol: "AAPL",
      dollars: 30
    }),
    {
      you: "Buy $60 of Apple for me",
      rounds: [[
        say("Here it is, for your Face ID."),
        shows(
          mint,
          "proposeTrade",
          { agentId: null },
          approvalCard(mint, { symbol: "AAPL", dollars: 60, expired: false })
        )
      ]]
    },
    {
      you: "And the one from this morning?",
      rounds: [[
        say("Its request ran out. Approving prepares it again with a fresh quote."),
        shows(
          mint,
          "proposeTrade",
          { agentId: null },
          approvalCard(mint, { symbol: "NVDA", dollars: 45, expired: true })
        )
      ]]
    },
    {
      you: "Buy $25 each of Apple, Amazon and Alphabet at the weekend",
      rounds: [[
        say("One signature sends all three. The market is closed, so they trade at the pools' prices."),
        shows(
          mint,
          "proposeTrade",
          { agentId: null },
          approvalCard(mint, {
            symbol: "AAPL",
            dollars: 25,
            expired: false,
            together: ["AMZN", "GOOGL"],
            pricesPaused: true
          })
        )
      ]]
    },
    {
      you: `Rebalance ${keeper.name}`,
      rounds: [[
        getPortfolio(mint),
        say("Two waves: Amazon and Microsoft go out together first, then Nvidia once you approve it."),
        shows(mint, "proposeRebalance", { agentId: keeper.id, reason: "Back to the mix." }, plan)
      ]]
    }
  ]
}
