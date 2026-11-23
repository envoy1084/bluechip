import { useId } from "react"
import { RadioCard, RadioGroup } from "../components/radio-group.tsx"
import { Illustration, type IllustrationName } from "../illustrations/illustration.tsx"
import { cn } from "../lib/cn.ts"

export type AgentTemplateName = "rebalancer" | "stock-picker" | "weekly-buyer" | "stop-loss-guard"

export interface AgentTemplate {
  readonly name: AgentTemplateName
  readonly label: string
  /** The one-line promise. */
  readonly promise: string
  /** The one rule that defines it. */
  readonly rule: string
  readonly illustration: IllustrationName
}

/** The four kinds of agent bluechip makes. */
export const AGENT_TEMPLATES: ReadonlyArray<AgentTemplate> = [
  {
    name: "rebalancer",
    label: "Rebalancer",
    promise: "Keeps your mix on target. It can only trade to move you back.",
    rule: "Rebalance only",
    illustration: "scales"
  },
  {
    name: "stock-picker",
    label: "Stock picker",
    promise: "Trades the stocks you choose, inside your limits.",
    rule: "Asks before big trades",
    illustration: "certificate"
  },
  {
    name: "weekly-buyer",
    label: "Weekly buyer",
    promise: "Buys a set amount on a schedule, like $50 every Monday.",
    rule: "Buy only",
    illustration: "calendar"
  },
  {
    name: "stop-loss-guard",
    label: "Stop-loss guard",
    promise: "Sells a stock for you if it falls too far.",
    rule: "Sell only",
    illustration: "stop-sign"
  }
]

export interface TemplatePickerProps {
  readonly value?: AgentTemplateName
  readonly defaultValue?: AgentTemplateName
  readonly onValueChange?: (template: AgentTemplate) => void
  readonly className?: string
}

/** The four agent templates as radio cards, each with its picture and defining rule. Arrow keys move and select. */
export function TemplatePicker({ value, defaultValue, onValueChange, className }: TemplatePickerProps) {
  const id = useId()
  return (
    <RadioGroup
      aria-label="Agent templates"
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      onValueChange={(name) => {
        const template = AGENT_TEMPLATES.find((candidate) => candidate.name === name)
        if (template) onValueChange?.(template)
      }}
      className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2", className)}
    >
      {AGENT_TEMPLATES.map((template) => (
        <RadioCard
          key={template.name}
          value={template.name}
          aria-label={template.label}
          aria-describedby={`${id}-${template.name}`}
          data-slot="template-picker-item"
          className="min-w-0 gap-3.5"
        >
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(180deg,#f7f8fa,#eef0f3)] shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] group-data-checked/radio-card:bg-[linear-gradient(180deg,#eef1ff,#e3e8ff)]"
          >
            <Illustration name={template.illustration} size={40} />
          </span>
          <span className="grid min-w-0 flex-1 justify-items-start gap-1">
            <b className="text-body-sm font-semibold">{template.label}</b>
            <span id={`${id}-${template.name}`} className="text-label text-g-500">{template.promise}</span>
            <span className="mt-1 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
              {template.rule}
            </span>
          </span>
        </RadioCard>
      ))}
    </RadioGroup>
  )
}
