import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec, compareSpecs, describeSpec } from "@bluechip/domain/policies/Catalog"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { useState } from "react"
import { dayLabel } from "../../../../../agents/spec/fieldText.ts"
import { PolicyRules } from "../../../../../agents/spec/PolicyRules.tsx"
import { SpecForm } from "../../../../../agents/spec/SpecForm.tsx"
import { isTemplateId } from "../../../../../agents/templateLabel.ts"

/** The agent's rules to change, marked against the ones in force, with what the new ones allow beside them. */
export function EditRulesStep(
  { agent, spec, stocks, nameOf, onChange, onReview }: Readonly<{
    agent: Agent
    spec: AgentSpec
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onChange: (spec: AgentSpec) => void
    onReview: () => void
  }>
) {
  // Undo starts the form again, so the target mix editor (which keeps its own rows) shows the rules in force.
  const [formKey, setFormKey] = useState(0)
  const unchanged = compareSpecs(agent.spec, spec).policies.length === 0
  const ready = !unchanged && checkSpec(spec).length === 0
  const lockedUntil = agent.lockedUntil === null ? undefined : dayLabel(DateTime.toDateUtc(agent.lockedUntil))
  const template = agent.template !== null && isTemplateId(agent.template) ? agent.template : null

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SpecForm
        key={formKey}
        spec={spec}
        onChange={onChange}
        stocks={stocks}
        nameOf={nameOf}
        template={template}
        before={agent.spec}
      />

      <div className="grid min-w-0 gap-2.5 lg:sticky lg:top-[76px]">
        <span className="text-caption font-semibold tracking-[.06em] text-g-500 uppercase">
          {unchanged ? "What it can and can never do" : "What it could do with these rules"}
        </span>
        <PolicyRules description={describeSpec(spec, nameOf)} lockedUntil={unchanged ? lockedUntil : undefined} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-ink/7 pt-4 lg:col-span-2">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
        >
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {!unchanged && (
            <Button
              variant="ghost"
              onClick={() => {
                onChange(agent.spec)
                setFormKey((key) => key + 1)
              }}
            >
              Undo changes
            </Button>
          )}
          <Button disabled={!ready} onClick={onReview}>
            Review changes<Icon name="arrow-right" size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
