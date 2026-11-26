// "Every tool row": each tool with what it answered, the same tools with nothing to show, calls that failed, one with
// long arguments, a web search, and the tools whose answer is a card. A row still running shows only while a reply
// streams ("A tool takes 7 s" in the panel).
import { PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import {
  getActivity,
  getAgentPerformance,
  getAutomationPerformance,
  getPerformance,
  getPortfolio,
  getPrices,
  getStock,
  getStockFacts,
  getStockPerformance
} from "../../accountReads.ts"
import { agentFor } from "../../cards.ts"
import { tradeCard } from "../../cards/tradeCards.ts"
import { specOf } from "../../castRecords.ts"
import {
  checkSpec,
  explainDecision,
  getAgent,
  getAgentHistory,
  getAgentJournal,
  getAgentUsage,
  getQuote,
  listAgents,
  listAutomations,
  listMemories,
  listPolicies,
  listTemplates,
  searchHelp,
  searchMemory
} from "../../reads.ts"
import { fails, say, searched, shows, type ThreadContext, type Turn } from "../../rounds.ts"
import { cardTurn } from "./cardTurns.ts"

export const everyToolRow = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { mint, memories } = context
  const agent = agentFor(mint, null)

  const intent = tradeCard(mint, agent, "blocked")
  const refused = intent._tag === "Trade" ? intent.intent : null

  return [
    {
      you: "Check everything you can about my account",
      rounds: [
        [
          getPortfolio(mint),
          getPrices(mint, ["NVDA"]),
          getPrices(mint, ["AAPL", "MSFT", "AMZN"]),
          getStock(mint, "AAPL")
        ],
        [getStock(mint, "SPCX", false), getQuote(mint, "NVDA", 100), getActivity(mint, 3), getStockFacts(mint, "NVDA")],
        [
          listAgents(mint),
          getAgent(mint, agent),
          getAgentUsage(mint, agent),
          getAgentHistory(mint, agent, refused === null ? [] : [refused])
        ],
        [
          getAgentJournal(mint, agent),
          ...(refused === null ? [] : [explainDecision(mint, refused, "Its Max in one stock policy refused it.")])
        ],
        [
          listPolicies(mint),
          listTemplates(mint),
          checkSpec(mint, specOf(agent)),
          checkSpec(mint, specOf(agent), { spec: "draft" }, [
            new PolicyProblem({
              policy: "tradeSize",
              field: "maxPerTrade",
              message: "The largest trade is over the budget."
            })
          ])
        ],
        [listMemories(mint, memories), searchMemory(mint, "budget", memories.slice(0, 2)), listAutomations(mint, [])],
        [
          getPerformance(mint, 412),
          getStockPerformance(mint, "NVDA", 38.5),
          getAgentPerformance(mint, agent.id, -64),
          ...(mint.cast.automations[0] === undefined
            ? []
            : [getAutomationPerformance(mint, mint.cast.automations[0].id, 4)])
        ],
        [
          searchHelp(mint, "approvals", [
            ["approvals", "Approvals", "When you're asked", "Trades over the largest trade wait for you."]
          ]),
          searched(mint, "bluechip tokenized stocks Base", [
            { url: "https://www.base.org/ecosystem", title: "Base ecosystem" }
          ])
        ],
        [say("Every tool above answered. Each row says what it found in a few words.")]
      ]
    },
    {
      you: "And for an empty account?",
      rounds: [
        [getPortfolio(mint, true), getPrices(mint, []), getActivity(mint, 0), listAgents(mint, true)],
        [
          getAgentHistory(mint, agent, []),
          listMemories(mint, []),
          searchMemory(mint, "tesla", []),
          searchHelp(mint, "zzz", [])
        ],
        [
          ...(mint.cast.automations[0] === undefined
            ? []
            : [getAutomationPerformance(mint, mint.cast.automations[0].id, 0)]),
          shows(mint, "proposeRebalance", { agentId: agent.id }, [])
        ],
        [say("That's how each row reads with nothing to show.")]
      ]
    },
    {
      you: "Get me a Tesla quote and my portfolio",
      rounds: [[
        fails(mint, "getQuote", { symbol: "TSLA", side: "buy", dollars: 100, shares: null }, "Prices are paused."),
        fails(mint, "getPortfolio", {}, "Base didn't answer in time.")
      ], [
        say("Both failed: prices are paused for Tesla, and Base didn't answer for your portfolio. Try again shortly.")
      ]]
    },
    {
      you: "Check this spec with every policy spelled out",
      rounds: [[
        checkSpec(mint, specOf(agent), {
          name: agent.name,
          spec: specOf(agent).policies.map((policy) => ({
            id: policy.id,
            config: JSON.stringify(policy.config, (_, value) => typeof value === "bigint" ? value.toString() : value)
          })),
          note: "Every policy and its settings, as the model sends a whole spec to check. ".repeat(4)
        })
      ], [say("No problems with it.")]]
    },
    cardTurn(context, "Buy $50 of Apple and pause the picker", [["tradeSent", "applied"], ["pauseAgent", "pending"]], {
      after: "Tools whose answer is a card say nothing in their row: the card shows it."
    })
  ]
}
