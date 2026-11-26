import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec } from "@bluechip/domain/policies/Catalog"
import type { TemplateId } from "@bluechip/domain/policies/Templates"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { AgentAtAGlance } from "../spec/AgentAtAGlance.tsx"
import { SpecForm } from "../spec/SpecForm.tsx"
import { StepFoot } from "./NewAgentShell.tsx"

/** Step two: its rules, picked and set, with what they allow read back beside them as you go. */
export function PoliciesStep(
  { spec, template, stocks, nameOf, onChange, onBack, onReview }: Readonly<{
    spec: AgentSpec
    template: TemplateId | null
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onChange: (spec: AgentSpec) => void
    onBack: () => void
    onReview: () => void
  }>
) {
  // What's missing is said once you try to go on, not while you're still choosing.
  const [tried, setTried] = useState(false)
  const ready = checkSpec(spec).length === 0
  const review = () => {
    setTried(true)
    if (ready) onReview()
  }

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SpecForm
        spec={spec}
        onChange={onChange}
        stocks={stocks}
        nameOf={nameOf}
        template={template}
        showProblems={tried}
      />

      <div className="min-w-0 lg:sticky lg:top-[76px]">
        <AgentAtAGlance spec={spec} nameOf={nameOf} />
      </div>

      <StepFoot className="lg:col-span-2">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="arrow-left" size={16} />Back
        </Button>
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          {tried && !ready ?
            <span role="alert" className="text-label-sm font-medium text-loss">Fix what's marked to review it.</span> :
            null}
          <Button onClick={review}>
            Review<Icon name="arrow-right" size={16} />
          </Button>
        </span>
      </StepFoot>
    </div>
  )
}
