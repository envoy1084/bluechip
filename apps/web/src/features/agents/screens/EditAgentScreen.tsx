import type { Agent } from "@bluechip/domain/agents/Agent"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AgentId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ReactNode, useState } from "react"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { agentAtom } from "../atoms/agents.ts"
import { ChangeProgress } from "../components/edit/ChangeProgress.tsx"
import { ChangeReview } from "../components/edit/ChangeReview.tsx"
import { EditAgentNotFound } from "../components/edit/EditAgentNotFound.tsx"
import { EditRulesStep } from "../components/edit/EditRulesStep.tsx"
import { NotChangeable } from "../components/edit/NotChangeable.tsx"

/** Changing an agent's rules: loads the agent and the stocks, then the edit flow. */
export function EditAgentScreen({ agentId }: Readonly<{ agentId: AgentId }>) {
  const agent = useAtomValue(agentAtom(agentId))
  const stocks = useAtomValue(stocksAtom)
  const refreshAgent = useAtomRefresh(agentAtom(agentId))
  const refreshStocks = useAtomRefresh(stocksAtom)

  if (AsyncResult.isSuccess(agent) && AsyncResult.isSuccess(stocks)) {
    return <EditFlow agent={agent.value} stocks={stocks.value} />
  }
  if (Option.getOrUndefined(AsyncResult.error(agent)) instanceof NotFoundError) return <EditAgentNotFound />

  const failed = AsyncResult.isFailure(agent) || AsyncResult.isFailure(stocks)
  return (
    <AppPage title="Edit rules">
      {failed ?
        (
          <LoadProblem
            what="this agent"
            onRetry={() => {
              refreshAgent()
              refreshStocks()
            }}
          />
        ) :
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-8 w-72" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        )}
    </AppPage>
  )
}

/**
 * The agent's rules, changed and reviewed against the ones in force, then locked with Face ID as a new session; once
 * the change lands the page goes back to the agent. Only an active agent's rules can change.
 */
function EditFlow({ agent, stocks }: Readonly<{ agent: Agent; stocks: ReadonlyArray<Stock> }>) {
  const [step, setStep] = useState<"rules" | "review">("rules")
  const [spec, setSpec] = useState(agent.spec)
  const [sent, setSent] = useState<{ readonly agent: Agent; readonly attempt: number } | null>(null)

  const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
  const send = (next: Agent) => setSent((last) => ({ agent: next, attempt: (last?.attempt ?? 0) + 1 }))
  const page = (children: ReactNode, wide = false) => (
    <AppPage
      title="Edit rules"
      icon={<AgentAvatar agentId={agent.id} size="md" />}
      sub={
        <>
          <Link to="/agents" className="hover:text-ink">Agents</Link> /{" "}
          <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="hover:text-ink">{agent.name}</Link>
        </>
      }
      width={wide ? "wide" : "default"}
    >
      {children}
    </AppPage>
  )

  if (sent !== null) return page(<ChangeProgress key={sent.attempt} sent={sent.agent} spec={spec} onSent={send} />)
  if (agent.status !== "active") return page(<NotChangeable agent={agent} status={agent.status} />)

  if (step === "review") {
    return page(
      <ChangeReview agent={agent} spec={spec} nameOf={nameOf} onBack={() => setStep("rules")} onSent={send} />
    )
  }

  return page(
    <EditRulesStep
      agent={agent}
      spec={spec}
      stocks={stocks}
      nameOf={nameOf}
      onChange={setSpec}
      onReview={() => setStep("review")}
    />,
    true
  )
}
