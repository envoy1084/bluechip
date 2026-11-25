import type { Agent } from "@bluechip/domain/agents/Agent"
import { Limits } from "@bluechip/domain/agents/Limits"
import { draftLimits, type Template } from "@bluechip/domain/agents/Templates"
import type { RequestId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { uiTemplate } from "../../../agents/limits.ts"
import { evenTargets } from "../../../agents/LimitsFormMix.tsx"
import { removeAgentAtom } from "../../../atoms/agents.ts"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../shell/AppPage.tsx"
import { LimitsStep } from "./-components/new/LimitsStep.tsx"
import { LockStep } from "./-components/new/LockStep.tsx"
import { NewAgentShell } from "./-components/new/NewAgentShell.tsx"
import { ReviewStep } from "./-components/new/ReviewStep.tsx"
import { TemplateStep } from "./-components/new/TemplateStep.tsx"

export const Route = createFileRoute("/_app/agents/new")({ component: NewAgentPage })

const newRequestId = () => crypto.randomUUID() as RequestId

const labelOf = (template: Template) =>
  AGENT_TEMPLATES.find((candidate) => candidate.name === uiTemplate(template))!.label

/** A template's balanced starting limits, keeping the stocks already picked (and an even mix for a Rebalancer). */
const startingLimits = (template: Template, stocks: ReadonlyArray<StockSymbol>): Limits => {
  const limits = draftLimits({ template, preset: "balanced", stocks, targets: [] })
  return limits.mode === "rebalance" ? new Limits({ ...limits, targets: evenTargets(stocks, limits) }) : limits
}

function NewAgentPage() {
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(stocksAtom)
  if (AsyncResult.isSuccess(stocks)) return <NewAgentFlow stocks={stocks.value} />

  return (
    <AppPage title="New agent">
      {AsyncResult.isInitial(stocks) ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-8 w-72" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) :
        (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-body-sm text-g-600">We couldn't load the stocks. Check your connection and try again.</p>
            <Button variant="secondary" onClick={refresh}>Try again</Button>
          </div>
        )}
    </AppPage>
  )
}

/**
 * Template, limits, review, then Face ID: nothing is saved until the review's Face ID, which saves a draft and locks
 * it. Once the lock is sent the page follows it to Base until the agent is live.
 */
function NewAgentFlow({ stocks }: Readonly<{ stocks: ReadonlyArray<Stock> }>) {
  const remove = useAtomSet(removeAgentAtom, { mode: "promise" })
  const [step, setStep] = useState<"template" | "limits" | "review">("template")
  const [template, setTemplate] = useState<Template>("rebalancer")
  const [name, setName] = useState(() => labelOf("rebalancer"))
  const [limits, setLimits] = useState(() => startingLimits("rebalancer", []))
  const [draft, setDraft] = useState<Agent | null>(null)
  const [requestId, setRequestId] = useState(newRequestId)
  const [editProblem, setEditProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<{ readonly agent: Agent; readonly attempt: number } | null>(null)

  const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
  const send = (agent: Agent) => setSent((last) => ({ agent, attempt: (last?.attempt ?? 0) + 1 }))

  if (sent !== null) return <LockStep key={sent.attempt} sent={sent.agent} onSent={send} />

  const pickTemplate = (picked: Template) => {
    if (name.trim() === "" || name === labelOf(template)) setName(labelOf(picked))
    setTemplate(picked)
    setLimits(startingLimits(picked, limits.stocks))
  }

  // A draft saved by a Face ID that didn't finish holds the old limits, so changing them sets it aside first.
  const backToLimits = async () => {
    if (draft !== null) {
      try {
        await remove({ params: { id: draft.id }, payload: { requestId: newRequestId() } })
      } catch {
        setEditProblem("We couldn't set the saved draft aside, so the limits can't change yet. Try again.")
        return
      }
      setDraft(null)
    }
    setEditProblem(null)
    setRequestId(newRequestId())
    setStep("limits")
  }

  if (step === "template") {
    return (
      <NewAgentShell step="Template">
        <TemplateStep template={template} onPick={pickTemplate} onContinue={() => setStep("limits")} />
      </NewAgentShell>
    )
  }

  if (step === "limits") {
    return (
      <NewAgentShell step="Limits" wide>
        <LimitsStep
          template={template}
          name={name}
          limits={limits}
          stocks={stocks}
          nameOf={nameOf}
          onNameChange={setName}
          onLimitsChange={setLimits}
          onBack={() => setStep("template")}
          onReview={() => setStep("review")}
        />
      </NewAgentShell>
    )
  }

  return (
    <NewAgentShell step="Review" wide>
      <ReviewStep
        template={template}
        name={name}
        limits={limits}
        nameOf={nameOf}
        draft={draft}
        requestId={requestId}
        onDraft={setDraft}
        onSent={send}
        onEdit={() => void backToLimits()}
        editProblem={editProblem}
      />
    </NewAgentShell>
  )
}
