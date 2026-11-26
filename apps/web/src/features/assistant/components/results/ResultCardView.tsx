import type { StockSymbol } from "@bluechip/domain/market/Market"
import { type ResultCard, resultState } from "../../model/resultCards.ts"
import { failedText, RESULT_LOOK } from "../../model/resultText.ts"
import { ActivityResult, DecisionResult, HistoryResult, JournalResult } from "./ActivityResults.tsx"
import { AgentPerformanceResult, AgentResult, AgentsResult, UsageResult } from "./AgentResults.tsx"
import {
  AutomationPerformanceResult,
  AutomationsResult,
  HelpResult,
  MemoriesResult,
  PoliciesResult,
  TemplatesResult
} from "./CatalogResults.tsx"
import { LookedResult, PerformanceResult, PortfolioResult, QuoteResult } from "./MoneyResults.tsx"
import { BriefResult, RebalanceResult } from "./PlanResults.tsx"
import { PricesResult, StockResult } from "./StockResults.tsx"

/** One result card in the conversation, drawn for what its tool read. */
export function ResultCardView(
  { card, nameOf }: Readonly<{ card: ResultCard; nameOf: (symbol: StockSymbol) => string }>
) {
  const state = resultState(card)

  switch (card._tag) {
    case "Loading":
      return <LookedResult look={RESULT_LOOK[card.tool]} state="loading" />
    case "Failed":
      return <LookedResult look={RESULT_LOOK[card.tool]} state="error" message={failedText(card.tool, card.problem)} />
    case "Stock":
      return <StockResult read={card.read} state={state} nameOf={nameOf} />
    case "Rebalance":
      return <RebalanceResult legs={card.legs} portfolio={card.portfolio} state={state} nameOf={nameOf} />
    case "Brief":
      return <BriefResult brief={card.brief} nameOf={nameOf} />
  }

  const { agentId, read } = card
  switch (read.tool) {
    case "getPortfolio":
      return <PortfolioResult portfolio={read.value} state={state} nameOf={nameOf} />
    case "getPerformance":
      return <PerformanceResult performance={read.value} state={state} />
    case "getPrices":
      return <PricesResult stocks={read.value} state={state} />
    case "getQuote":
      return <QuoteResult quote={read.value} nameOf={nameOf} />
    case "getAgent":
      return <AgentResult agent={read.value.agent} description={read.value.description} />
    case "listAgents":
      return <AgentsResult agents={read.value} state={state} nameOf={nameOf} />
    case "getAgentUsage":
      return <UsageResult usage={read.value} agentId={agentId} state={state} />
    case "getAgentPerformance":
      return <AgentPerformanceResult performance={read.value} state={state} />
    case "getActivity":
      return <ActivityResult items={read.value} state={state} nameOf={nameOf} />
    case "getAgentHistory":
      return (
        <HistoryResult
          intents={read.value.intents}
          agentId={agentId ?? read.value.intents[0]?.agentId ?? null}
          state={state}
          nameOf={nameOf}
        />
      )
    case "getAgentJournal":
      return <JournalResult entries={read.value} agentId={agentId ?? read.value[0]?.agentId ?? null} state={state} />
    case "explainDecision":
      return <DecisionResult intent={read.value.intent} explanation={read.value.explanation} nameOf={nameOf} />
    case "listAutomations":
      return <AutomationsResult automations={read.value} state={state} />
    case "getAutomationPerformance":
      return <AutomationPerformanceResult performance={read.value} state={state} />
    case "listTemplates":
      return <TemplatesResult builtIn={read.value.builtIn} saved={read.value.saved} />
    case "listPolicies":
      return <PoliciesResult policies={read.value} />
    case "listMemories":
      return <MemoriesResult found={read.value} search={false} state={state} />
    case "searchMemory":
      return <MemoriesResult found={read.value} search state={state} />
    case "searchHelp":
      return <HelpResult passages={read.value} state={state} />
    case "getStock":
    case "getStockFacts":
    case "getStockPerformance":
    case "proposeRebalance":
      // Drawn as their own cards above: a stock read, a rebalance plan.
      return null
  }
}
