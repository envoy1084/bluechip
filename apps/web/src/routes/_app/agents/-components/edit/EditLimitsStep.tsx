import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Limits } from "@bluechip/domain/agents/Limits"
import { compare, validate } from "@bluechip/domain/agents/Rules"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { useState } from "react"
import { lockedUntilLabel } from "../../../../../agents/limits.ts"
import { LimitsForm } from "../../../../../agents/LimitsForm.tsx"
import { LimitsRules } from "../../../../../agents/LimitsRules.tsx"

/** The agent's limits to change, marked against the ones in force, with what the new ones allow beside them. */
export function EditLimitsStep(
  { agent, limits, stocks, nameOf, onChange, onReview }: Readonly<{
    agent: Agent
    limits: Limits
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onChange: (limits: Limits) => void
    onReview: () => void
  }>
) {
  // Undo starts the form again, so the target mix editor (which keeps its own rows) shows the limits in force.
  const [formKey, setFormKey] = useState(0)
  const unchanged = compare(agent.limits, limits).overall === "same"
  const ready = !unchanged && validate(limits, agent.template).length === 0
  const lockedUntil = agent.lockedUntil === null ? undefined : lockedUntilLabel(DateTime.toDateUtc(agent.lockedUntil))

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <LimitsForm
        key={formKey}
        template={agent.template}
        limits={limits}
        onChange={onChange}
        stocks={stocks}
        before={agent.limits}
      />

      <div className="grid min-w-0 gap-2.5 lg:sticky lg:top-[76px]">
        <span className="text-caption font-semibold tracking-[.06em] text-g-500 uppercase">
          {unchanged ? "What it can and can never do" : "What it could do with these limits"}
        </span>
        <LimitsRules
          limits={limits}
          nameOf={nameOf}
          {...(unchanged && lockedUntil !== undefined ? { lockedUntil } : {})}
        />
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
                onChange(agent.limits)
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
