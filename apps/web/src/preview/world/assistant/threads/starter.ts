// A person who just started: how to begin, their first agent drafted and locked from chat, and what it bought.
import { getActivity, getPortfolio } from "../accountReads.ts"
import { agentFor } from "../cards.ts"
import { draftAgentCard } from "../cards/agentCards.ts"
import { approvalCard } from "../cards/tradeCards.ts"
import { agentOf, specOf } from "../castRecords.ts"
import { checkSpec, listTemplates, searchHelp } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const howToStart = ({ mint }: ThreadContext): ReadonlyArray<Turn> => [
  {
    you: "How do I start?",
    rounds: [
      [searchHelp(mint, "getting started", [
        ["funding", "Adding money", "Deposits", "Send USDC on Base to your account's address."],
        ["agents", "How agents work", "Your first agent", "Pick a template, your stocks and a preset."]
      ])],
      [
        say(
          "Three steps:\n\n1. **Add money**: send USDC on Base to your account ([Adding money](/help/funding)).\n" +
            "2. **Buy something yourself**, to see how a trade works.\n3. **Make an agent** to trade for you inside " +
            "rules you set.\n\nWant to try a small first buy?"
        )
      ]
    ]
  },
  {
    you: "Yes, $20 of Apple",
    rounds: [[
      say("Here it is. Your first trade also sets up your account onchain, in the same Face ID."),
      shows(
        mint,
        "proposeTrade",
        { agentId: null, symbol: "AAPL", dollars: 20 },
        approvalCard(mint, {
          symbol: "AAPL",
          dollars: 20,
          expired: true,
          setsUpAccount: true,
          hoursAgo: 40
        })
      )
    ]]
  }
]

export const firstAgent = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const cast = agentFor(mint, mint.cast.agents[0] ?? null)
  return [
    {
      you: "Make me a careful agent for Nvidia and Microsoft",
      rounds: [
        [listTemplates(mint), checkSpec(mint, specOf(cast))],
        [
          say("A **Stock picker** on the conservative preset: $100 a day at most, $50 a trade."),
          shows(mint, "draftAgent", { name: cast.name }, draftAgentCard(mint, agentOf(mint, cast)))
        ],
        [say("You locked it with Face ID, so it's live now.")]
      ]
    },
    {
      you: "What can it never do?",
      rounds: [[
        say(
          "It can never:\n\n- trade anything but Nvidia and Microsoft\n- spend more than $100 a day\n" +
            "- go below your cash reserve\n- change its own rules"
        )
      ]]
    }
  ]
}

export const whatDidItBuy = ({ mint }: ThreadContext): ReadonlyArray<Turn> => [
  {
    you: "What did my agent buy?",
    rounds: [[getActivity(mint, 2), getPortfolio(mint)], [
      say(
        "Two buys so far:\n\n| Stock | Shares | Spent |\n| --- | ---: | ---: |\n| [[NVDA]] | 0.17 | $24.85 |\n" +
          "| [[AAPL]] | 0.105 | $24.87 |\n\nYou have **$150** left in cash."
      )
    ]]
  }
]
