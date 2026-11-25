import type { Agent } from "@bluechip/domain/agents/Agent"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import { AgentId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Schema from "effect/Schema"
import { type ReactNode, useState } from "react"
import { agentAtom } from "../../../atoms/agents.ts"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { ChangeProgress } from "./-components/edit/ChangeProgress.tsx"
import { ChangeReview } from "./-components/edit/ChangeReview.tsx"
import { EditRulesStep } from "./-components/edit/EditRulesStep.tsx"
import { NotChangeable } from "./-components/edit/NotChangeable.tsx"

export const Route = createFileRoute("/_app/agents/$agentId_/edit")({ component: EditAgentPage })

const isAgentId = Schema.is(AgentId)

function NotFound() {
  return (
    <AppPage title="Edit rules">
      <Empty>
        <EmptyTitle>We don't have that agent</EmptyTitle>
        <EmptyDescription>Check the link, or pick one from your agents.</EmptyDescription>
        <Button variant="secondary" nativeButton={false} render={<Link to="/agents" />}>See your agents</Button>
      </Empty>
    </AppPage>
  )
}

function EditAgentPage() {
  const { agentId } = Route.useParams()
  return isAgentId(agentId) ? <KnownAgent agentId={agentId} /> : <NotFound />
}

function KnownAgent({ agentId }: Readonly<{ agentId: AgentId }>) {
  const agent = useAtomValue(agentAtom(agentId))
  const stocks = useAtomValue(stocksAtom)
  const refreshAgent = useAtomRefresh(agentAtom(agentId))
  const refreshStocks = useAtomRefresh(stocksAtom)

  if (AsyncResult.isSuccess(agent) && AsyncResult.isSuccess(stocks)) {
    return <EditFlow agent={agent.value} stocks={stocks.value} />
  }
  if (Option.getOrUndefined(AsyncResult.error(agent)) instanceof NotFoundError) return <NotFound />

  const failed = AsyncResult.isFailure(agent) || AsyncResult.isFailure(stocks)
  return (
    <AppPage title="Edit rules">
      {failed ?
        (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-body-sm text-g-600">We couldn't load this agent. Check your connection and try again.</p>
            <Button
              variant="secondary"
              onClick={() => {
                refreshAgent()
                refreshStocks()
              }}
            >
              Try again
            </Button>
          </div>
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
