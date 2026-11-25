import { MAX_NAME_LENGTH } from "@bluechip/domain/agents/Agent"
import type { Limits } from "@bluechip/domain/agents/Limits"
import { validate } from "@bluechip/domain/agents/Rules"
import type { Template } from "@bluechip/domain/agents/Templates"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { Icon } from "@bluechip/ui/icons/icon"
import { useId } from "react"
import { LimitsForm } from "../../../../../agents/LimitsForm.tsx"
import { LimitsRules } from "../../../../../agents/LimitsRules.tsx"
import { StepFoot } from "./NewAgentShell.tsx"

/** Whether `name` can be an agent's name: something to call it, short enough for a card. */
export const nameProblem = (name: string): string | undefined => {
  const trimmed = name.trim()
  if (trimmed.length === 0) return "Give it a name."
  return trimmed.length > MAX_NAME_LENGTH ? `Keep it to ${MAX_NAME_LENGTH} characters.` : undefined
}

/** Step two: its name and limits, with what they allow read back beside them as you go. */
export function LimitsStep(
  { template, name, limits, stocks, nameOf, onNameChange, onLimitsChange, onBack, onReview }: Readonly<{
    template: Template
    name: string
    limits: Limits
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onNameChange: (name: string) => void
    onLimitsChange: (limits: Limits) => void
    onBack: () => void
    onReview: () => void
  }>
) {
  const id = useId()
  const problem = nameProblem(name)
  const ready = problem === undefined && validate(limits, template).length === 0

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <LimitsForm
        template={template}
        limits={limits}
        onChange={onLimitsChange}
        stocks={stocks}
        header={
          <div className="grid gap-2 border-b border-g-100 px-[18px] py-4">
            <label htmlFor={id} className="text-[13.5px] font-semibold">Name</label>
            <Input
              id={id}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              aria-invalid={problem === undefined ? undefined : true}
              aria-describedby={problem === undefined ? undefined : `${id}-problem`}
              onChange={(event) => onNameChange(event.currentTarget.value)}
              className="max-w-[320px]"
            />
            {problem === undefined ?
              null :
              <p id={`${id}-problem`} className="text-label-sm font-medium text-loss">{problem}</p>}
          </div>
        }
      />

      <div className="grid min-w-0 gap-2.5 lg:sticky lg:top-[76px]">
        <span className="text-caption font-semibold tracking-[.06em] text-g-500 uppercase">
          What it can and can never do
        </span>
        <LimitsRules limits={limits} nameOf={nameOf} />
      </div>

      <StepFoot className="lg:col-span-2">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="arrow-left" size={16} />Back
        </Button>
        <Button disabled={!ready} onClick={onReview}>
          Review<Icon name="arrow-right" size={16} />
        </Button>
      </StepFoot>
    </div>
  )
}
