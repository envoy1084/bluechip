// The Card gallery's cards for what tools read, one by one: each read tool's card with data, with nothing in it and
// failed, the day's brief (busy and quiet) and a rebalance plan (with the mix, without it, nothing to trade, failed),
// all made from the scenario's cast. A card being read shows only while a reply streams ("A tool takes 7 s").
import type { Card } from "@bluechip/domain/assistant/Card"
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { Intent } from "@bluechip/domain/intents/Intent"
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
import { agentFor, castAutomationDraft } from "../../cards.ts"
import { draftOf } from "../../cards/automationCards.ts"
import { tradeCard } from "../../cards/tradeCards.ts"
import { automationOf } from "../../castRecords.ts"
import {
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
import { fails, type Round, say, shows, type ThreadContext, type Turn } from "../../rounds.ts"

const STATUS: Readonly<Record<"active" | "paused" | "done" | "failing", Automation["status"]>> = {
  active: "active",
  paused: "paused",
  done: "done",
  failing: "active"
}

const intentOf = (card: Card): Intent => {
  if (card._tag !== "Trade") throw new Error("A trade card has its intent.")
  return card.intent
}

export const resultGallery = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { memories, mint } = context
  const agent = agentFor(mint, null)
  const keeper = agentFor(mint, mint.cast.agents.find((candidate) => candidate.template === "rebalancer") ?? null)
  const top = mint.cast.holdings[0]?.symbol ?? "AAPL"
  const held = mint.cast.holdings.slice(0, 3).map((holding) => holding.symbol)
  const turn = (you: string, round: Round): Turn => ({ you, rounds: [round] })

  const blocked = intentOf(tradeCard(mint, agent, "blocked"))
  const waiting = intentOf(tradeCard(mint, agent, "waiting", { waitReason: "pricesPaused" }))
  const asking = intentOf(tradeCard(mint, agent, "asking"))
  const history = [
    intentOf(tradeCard(mint, agent, "sent", { hoursAgo: 3 })),
    asking,
    blocked,
    intentOf(tradeCard(mint, agent, "sent", { hoursAgo: 30, sellShares: 0.5 }))
  ]

  const automations = mint.cast.automations.length === 0 ?
    [automationOf(mint, draftOf("weeklyBuy", agent), { createdFrom: null })] :
    mint.cast.automations.map((saved) => {
      const { draft, id, name } = castAutomationDraft(mint, saved)
      return automationOf(mint, draft, { createdFrom: null, id, name, status: STATUS[saved.state] })
    })
  const automationId = automations[0]!.id

  const plan = [
    tradeCard(mint, keeper, "proposed", { symbol: keeper.stocks[0] ?? "AMZN", sellShares: 0.4 }),
    tradeCard(mint, keeper, "proposed", { symbol: keeper.stocks[1] ?? "MSFT", dollars: 60 })
  ]

  return [
    { you: "Now the cards for what tools read", rounds: [[say("Each with data, with nothing in it, then failed.")]] },
    turn("Your portfolio", [getPortfolio(mint)]),
    turn("An empty portfolio", [getPortfolio(mint, true)]),
    turn("A portfolio that couldn't be read", [fails(mint, "getPortfolio", {}, "Base didn't answer in time.")]),
    turn("How you're doing, up", [getPerformance(mint, 412)]),
    turn("How you're doing, below zero", [getPerformance(mint, -86)]),
    turn("How you're doing before any trade", [getPerformance(mint, 0, true)]),
    turn("Results that couldn't be read", [fails(mint, "getPerformance", {}, "The ledger is catching up.")]),
    turn("A stock, with your results and its facts", [
      getStock(mint, top),
      getStockPerformance(mint, top, 38.5),
      getStockFacts(mint, top)
    ]),
    turn("A stock without a price", [getStock(mint, "SPCX", false)]),
    turn("A stock that couldn't be looked up", [fails(mint, "getStock", { symbol: "TSLA" }, "Base didn't answer.")]),
    turn("Prices of a few stocks", [getPrices(mint, held.length === 0 ? ["AAPL", "MSFT", "NVDA"] : held)]),
    turn("Prices of no stocks", [getPrices(mint, [])]),
    turn("Prices that couldn't be checked", [fails(mint, "getPrices", { symbols: [] }, "Prices are paused.")]),
    turn("A quote", [getQuote(mint, "NVDA", 100)]),
    turn("A quote that couldn't be got", [
      fails(mint, "getQuote", { symbol: "TSLA", side: "buy", dollars: 100, shares: null }, "Prices are paused.")
    ]),
    turn("One agent", [getAgent(mint, agent)]),
    turn("An agent that couldn't be read", [fails(mint, "getAgent", { agentId: agent.id }, "No such agent.")]),
    turn("Your agents", [listAgents(mint)]),
    turn("No agents yet", [listAgents(mint, true)]),
    turn("Agents that couldn't be read", [fails(mint, "listAgents", {}, "")]),
    turn("What an agent used today", [getAgentUsage(mint, agent)]),
    turn("Nothing used yet", [getAgentUsage(mint, agent, true)]),
    turn("Usage that couldn't be read", [fails(mint, "getAgentUsage", { agentId: agent.id }, "Base didn't answer.")]),
    turn("An agent's results", [getAgentPerformance(mint, agent.id, 120)]),
    turn("An agent's results, below zero", [getAgentPerformance(mint, agent.id, -64)]),
    turn("An agent that hasn't traded", [getAgentPerformance(mint, agent.id, 0, 0)]),
    turn("Agent results that couldn't be read", [
      fails(mint, "getAgentPerformance", { agentId: agent.id }, "The ledger is catching up.")
    ]),
    turn("Your recent activity", [getActivity(mint, 6)]),
    turn("No activity", [getActivity(mint, 0)]),
    turn("Activity that couldn't be read", [
      fails(mint, "getActivity", { kind: "trades", period: "7d" }, "Base didn't answer in time.")
    ]),
    turn("An agent's trades", [getAgentHistory(mint, agent, history)]),
    turn("An agent with no trades", [getAgentHistory(mint, agent, [])]),
    turn("Trades that couldn't be read", [fails(mint, "getAgentHistory", { agentId: agent.id }, "")]),
    turn("An agent's journal", [
      getAgentJournal(mint, agent, [
        `Bought $50.00 of its first stock within its rules. Why: you asked for it.`,
        "Its weekly buy ran: nothing drifted past the trigger, so it skipped.",
        "Asked you to approve a $400.00 buy, over its largest trade of $100."
      ])
    ]),
    turn("An empty journal", [getAgentJournal(mint, agent)]),
    turn("A journal that couldn't be read", [fails(mint, "getAgentJournal", { agentId: agent.id }, "")]),
    turn("Why one was blocked", [
      explainDecision(
        mint,
        blocked,
        "Its Max in one stock policy refused it: the stock would be over its share of your money."
      )
    ]),
    turn("Why one waits", [
      explainDecision(mint, waiting, "Prices are paused and this agent doesn't trade on them. It tries again later.")
    ]),
    turn("Why one needs you", [
      explainDecision(mint, asking, "It's over the agent's largest trade, so it waits for your approval.")
    ]),
    turn("A decision that couldn't be looked into", [
      fails(mint, "explainDecision", { intentId: blocked.id }, "No such trade.")
    ]),
    turn("Your automations", [listAutomations(mint, automations)]),
    turn("No automations", [listAutomations(mint, [])]),
    turn("Automations that couldn't be read", [fails(mint, "listAutomations", { agentId: null }, "")]),
    turn("An automation's results", [getAutomationPerformance(mint, automationId, 4)]),
    turn("An automation that hasn't run", [getAutomationPerformance(mint, automationId, 0)]),
    turn("Automation results that couldn't be read", [
      fails(mint, "getAutomationPerformance", { automationId }, "The ledger is catching up.")
    ]),
    turn("The templates", [listTemplates(mint)]),
    turn("Templates that couldn't be read", [fails(mint, "listTemplates", {}, "")]),
    turn("The policies", [listPolicies(mint)]),
    turn("Policies that couldn't be read", [fails(mint, "listPolicies", {}, "")]),
    turn("What you remember", [listMemories(mint, memories)]),
    turn("Nothing remembered", [listMemories(mint, [])]),
    turn("A search of before", [searchMemory(mint, "budget", memories.slice(0, 2))]),
    turn("A search that found nothing", [searchMemory(mint, "tesla", [])]),
    turn("Memories that couldn't be read", [fails(mint, "listMemories", {}, "")]),
    turn("A help answer", [
      searchHelp(mint, "approvals", [
        [
          "approvals",
          "Approvals",
          "When you're asked",
          "A trade over the agent's largest trade waits for your Face ID. Nothing moves until you approve it."
        ],
        ["agents", "How agents work", "Policies", "Every agent carries policies locked onchain."]
      ])
    ]),
    turn("Help with no answer", [searchHelp(mint, "zzz", [])]),
    turn("Help that couldn't be searched", [fails(mint, "searchHelp", { query: "gas" }, "")]),
    turn("How was my day?", [
      getPortfolio(mint),
      getActivity(mint, 3),
      shows(mint, "proposeTrade", {}, tradeCard(mint, agent, "asking"))
    ]),
    turn("A quiet day", [getPortfolio(mint), getActivity(mint, 0)]),
    turn("A rebalance, with the mix before and after", [
      getPortfolio(mint),
      shows(mint, "proposeRebalance", { agentId: keeper.id }, plan)
    ]),
    turn("A rebalance on its own", [shows(mint, "proposeRebalance", { agentId: keeper.id }, plan)]),
    turn("A rebalance with nothing to trade", [shows(mint, "proposeRebalance", { agentId: keeper.id }, [])]),
    turn("A rebalance that couldn't be planned", [
      fails(mint, "proposeRebalance", { agentId: keeper.id }, "It isn't a rebalancer.")
    ])
  ]
}
