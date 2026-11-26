import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentId, RequestId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { agentAtom, removeAgentAtom } from "../atoms/agents.ts"
import { templatesAtom } from "../atoms/policies.ts"
import { LockStep } from "../components/new/LockStep.tsx"
import { NewAgentShell } from "../components/new/NewAgentShell.tsx"
import { PoliciesStep } from "../components/new/PoliciesStep.tsx"
import { ReviewStep } from "../components/new/ReviewStep.tsx"
import { TemplateStep } from "../components/new/TemplateStep.tsx"
import { type Origin, originLabel, originOf, originPresets, originSpec } from "../model/origin.ts"
import { type AutomationSlots, type TemplateAutomation, templateAutomations } from "../model/templateAutomations.ts"

const newRequestId = () => crypto.randomUUID() as RequestId

const FIRST: Origin = { kind: "builtIn", template: "stockPicker" }

function Loading() {
  return (
    <AppPage title="New agent">
      <div aria-busy className="grid gap-4">
        <SkeletonBlock className="h-8 w-72" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    </AppPage>
  )
}

/**
 * A new agent: loads the stocks its rules pick from, then the flow. With `draftId` (a draft the assistant made), the
 * flow starts at its rules, prefilled.
 */
export function NewAgentScreen(
  { draftId, automations }: Readonly<{ draftId?: AgentId | undefined; automations: AutomationSlots }>
) {
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(stocksAtom)
  if (AsyncResult.isSuccess(stocks)) {
    return draftId === undefined ?
      <NewAgentFlow stocks={stocks.value} start={null} slots={automations} /> :
      <FromDraft id={draftId} stocks={stocks.value} slots={automations} />
  }
  if (AsyncResult.isInitial(stocks)) return <Loading />

  return (
    <AppPage title="New agent">
      <LoadProblem what="the stocks" onRetry={refresh} />
    </AppPage>
  )
}

/**
 * The flow over a draft, once it and the saved templates load (a draft from a saved template starts from it); a
 * draft that's gone or already locked starts the flow afresh.
 */
function FromDraft(
  { id, stocks, slots }: Readonly<{ id: AgentId; stocks: ReadonlyArray<Stock>; slots: AutomationSlots }>
) {
  const agent = useAtomValue(agentAtom(id))
  const templates = useAtomValue(templatesAtom)
  if (AsyncResult.isInitial(agent) || AsyncResult.isInitial(templates)) return <Loading />

  const draft = AsyncResult.isSuccess(agent) && agent.value.status === "draft" ? agent.value : null
  const saved = AsyncResult.isSuccess(templates) ? templates.value.saved : []
  return (
    <NewAgentFlow
      stocks={stocks}
      start={draft === null ? null : { draft, origin: originOf(draft, saved) }}
      slots={slots}
    />
  )
}

/**
 * Template, rules, review, then Face ID: nothing is saved until the review's Face ID, which saves a draft and locks
 * it. Once the lock is sent the page follows it to Base until the agent is live.
 */
function NewAgentFlow(
  { stocks, start, slots }: Readonly<{
    stocks: ReadonlyArray<Stock>
    start: { readonly draft: Agent; readonly origin: Origin } | null
    slots: AutomationSlots
  }>
) {
  const remove = useAtomSet(removeAgentAtom, { mode: "promise" })
  const [step, setStep] = useState<"template" | "rules" | "review">(start === null ? "template" : "rules")
  const [origin, setOrigin] = useState<Origin>(() => start === null ? FIRST : start.origin)
  const [name, setName] = useState(() => start === null ? originLabel(FIRST) : start.draft.name)
  const [spec, setSpec] = useState(() => start === null ? originSpec(FIRST, []) : start.draft.spec)
  const [draft, setDraft] = useState<Agent | null>(start === null ? null : start.draft)
  const [requestId, setRequestId] = useState(newRequestId)
  const [editProblem, setEditProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<{ readonly agent: Agent; readonly attempt: number } | null>(null)
  // The template's automations, drawn again whenever the rules they were drawn from change.
  const [automations, setAutomations] = useState<
    { readonly spec: AgentSpec; readonly list: ReadonlyArray<TemplateAutomation> } | null
  >(null)

  const nameOf = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
  const send = (agent: Agent) => setSent((last) => ({ agent, attempt: (last?.attempt ?? 0) + 1 }))

  const kept = automations?.list ?? []
  const { Defaults, Saved } = slots
  if (sent !== null) {
    return (
      <LockStep
        key={sent.attempt}
        sent={sent.agent}
        onSent={send}
        Saved={Saved}
        automations={kept}
      />
    )
  }

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

  // A draft from the assistant keeps its rules until they change; then it's set aside and the review saves a new one.
  const toReview = async () => {
    if (draft !== null && spec !== draft.spec) {
      try {
        await remove({ params: { id: draft.id }, payload: { requestId: newRequestId() } })
        setDraft(null)
        setRequestId(newRequestId())
      } catch {
        setSpec(draft.spec)
        setEditProblem("We couldn't set the drafted agent aside, so its rules can't change yet. Try again.")
      }
    }
    if (automations?.spec !== spec) setAutomations({ spec, list: templateAutomations(origin, spec) })
    setStep("review")
  }

  if (step === "template") {
    return (
      <NewAgentShell step="Start">
        <TemplateStep origin={origin} onPick={pickOrigin} onContinue={() => setStep("rules")} />
      </NewAgentShell>
    )
  }

  if (step === "rules") {
    return (
      <NewAgentShell step="Rules">
        <PoliciesStep
          spec={spec}
          template={originPresets(origin)}
          stocks={stocks}
          nameOf={nameOf}
          onChange={setSpec}
          onBack={() => setStep("template")}
          onReview={() => void toReview()}
        />
      </NewAgentShell>
    )
  }

  return (
    <NewAgentShell step="Review">
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
        automations={
          <Defaults
            automations={kept}
            spec={spec}
            stocks={stocks}
            nameOf={nameOf}
            onChange={(list) => setAutomations({ spec, list })}
          />
        }
      />
    </NewAgentShell>
  )
}
