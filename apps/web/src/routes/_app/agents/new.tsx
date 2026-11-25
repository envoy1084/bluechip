import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { removeAgentAtom } from "../../../atoms/agents.ts"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../shell/AppPage.tsx"
import { LockStep } from "./-components/new/LockStep.tsx"
import { NewAgentShell } from "./-components/new/NewAgentShell.tsx"
import { type Origin, originLabel, originPresets, originSpec } from "./-components/new/origin.ts"
import { PoliciesStep } from "./-components/new/PoliciesStep.tsx"
import { ReviewStep } from "./-components/new/ReviewStep.tsx"
import { TemplateStep } from "./-components/new/TemplateStep.tsx"

export const Route = createFileRoute("/_app/agents/new")({ component: NewAgentPage })

const newRequestId = () => crypto.randomUUID() as RequestId

const FIRST: Origin = { kind: "builtIn", template: "rebalancer" }

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
 * Template, rules, review, then Face ID: nothing is saved until the review's Face ID, which saves a draft and locks
 * it. Once the lock is sent the page follows it to Base until the agent is live.
 */
function NewAgentFlow({ stocks }: Readonly<{ stocks: ReadonlyArray<Stock> }>) {
  const remove = useAtomSet(removeAgentAtom, { mode: "promise" })
  const [step, setStep] = useState<"template" | "rules" | "review">("template")
  const [origin, setOrigin] = useState<Origin>(FIRST)
  const [name, setName] = useState(() => originLabel(FIRST))
  const [spec, setSpec] = useState(() => originSpec(FIRST, []))
  const [draft, setDraft] = useState<Agent | null>(null)
  const [requestId, setRequestId] = useState(newRequestId)
  const [editProblem, setEditProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<{ readonly agent: Agent; readonly attempt: number } | null>(null)

  const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
  const send = (agent: Agent) => setSent((last) => ({ agent, attempt: (last?.attempt ?? 0) + 1 }))

  if (sent !== null) return <LockStep key={sent.attempt} sent={sent.agent} onSent={send} />

  const pickOrigin = (picked: Origin) => {
    if (name.trim() === "" || name === originLabel(origin)) setName(originLabel(picked))
    setOrigin(picked)
    setSpec(originSpec(picked, configOf(spec.policies, trade)?.stocks ?? []))
  }

  // A draft saved by a Face ID that didn't finish holds the old rules, so changing them sets it aside first.
  const backToRules = async () => {
    if (draft !== null) {
      try {
        await remove({ params: { id: draft.id }, payload: { requestId: newRequestId() } })
      } catch {
        setEditProblem("We couldn't set the saved draft aside, so the rules can't change yet. Try again.")
        return
      }
      setDraft(null)
    }
    setEditProblem(null)
    setRequestId(newRequestId())
    setStep("rules")
  }

  if (step === "template") {
    return (
      <NewAgentShell step="Template">
        <TemplateStep origin={origin} onPick={pickOrigin} onContinue={() => setStep("rules")} />
      </NewAgentShell>
    )
  }

  if (step === "rules") {
    return (
      <NewAgentShell step="Rules" wide>
        <PoliciesStep
          spec={spec}
          template={originPresets(origin)}
          stocks={stocks}
          nameOf={nameOf}
          onChange={setSpec}
          onBack={() => setStep("template")}
          onReview={() => setStep("review")}
        />
      </NewAgentShell>
    )
  }

  return (
    <NewAgentShell step="Review" wide>
      <ReviewStep
        origin={origin}
        spec={spec}
        name={name}
        onNameChange={setName}
        nameOf={nameOf}
        draft={draft}
        requestId={requestId}
        onDraft={setDraft}
        onSent={send}
        onEdit={() => void backToRules()}
        editProblem={editProblem}
      />
    </NewAgentShell>
  )
}
