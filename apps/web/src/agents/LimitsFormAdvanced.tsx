import { Limits, type PriceProtection, WeeklySlippage } from "@bluechip/domain/agents/Limits"
import type { LimitChange, LimitChanges, LimitProblem } from "@bluechip/domain/agents/Rules"
import { BOUNDS, type Template, TEMPLATES } from "@bluechip/domain/agents/Templates"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Switch } from "@bluechip/ui/components/switch"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { useId } from "react"
import { bpsLabel, LIMIT_LABELS } from "./limitFields.ts"
import { LimitSection, NumberLimit } from "./LimitsFormFields.tsx"

const PRICE_PROTECTION: ReadonlyArray<{ readonly value: PriceProtection; readonly label: string }> = [
  { value: 50, label: "Strict" },
  { value: 100, label: "Standard" },
  { value: 200, label: "Relaxed" }
]

/** One of three settings, said with its percent. */
function Choice<A extends number>(
  { label, help, value, options, change, onChange }: Readonly<{
    label: string
    help: string
    value: A
    options: ReadonlyArray<{ readonly value: A; readonly label: string }>
    change: LimitChange | undefined
    onChange: (value: A) => void
  }>
) {
  return (
    <LimitSection title={label} change={change}>
      <ToggleGroup
        size="sm"
        aria-label={label}
        value={[String(value)]}
        onValueChange={(values) => {
          const picked = options.find((option) => String(option.value) === values[0])
          if (picked !== undefined) onChange(picked.value)
        }}
        className="justify-self-start"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={String(option.value)}>{option.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-label-sm text-g-500">{help}</p>
    </LimitSection>
  )
}

/** How often it trades and the safety settings its trades are checked with, folded away by default. */
export function AdvancedLimits(
  { template, limits, changes, problems, onChange }: Readonly<{
    template: Template
    limits: Limits
    changes: LimitChanges["fields"] | undefined
    problems: ReadonlyArray<LimitProblem>
    onChange: (limits: Limits) => void
  }>
) {
  const id = useId()
  const pausedAllowed = TEMPLATES[template].pausedTradingAllowed
  const problemOf = (field: LimitProblem["field"]) => problems.find((problem) => problem.field === field)?.message
  const set = (patch: Partial<Limits>) => onChange(new Limits({ ...limits, ...patch }))

  return (
    <Collapsible className="border-t border-g-100">
      <CollapsibleTrigger className="group/adv flex w-full cursor-pointer items-center justify-between gap-2 px-[18px] py-3.5 text-left text-[13.5px] font-semibold hover:bg-g-50">
        Advanced
        <Icon
          name="chevron-down"
          size={16}
          className="text-g-500 transition-transform group-data-panel-open/adv:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-g-100">
          <NumberLimit
            label={LIMIT_LABELS.tradesPerDay}
            help="The most trades it sends in a day."
            value={limits.tradesPerDay}
            min={BOUNDS.tradesPerDay.min}
            max={BOUNDS.tradesPerDay.max}
            step={1}
            unit="count"
            change={changes?.tradesPerDay}
            problem={problemOf("tradesPerDay")}
            onChange={(tradesPerDay) => set({ tradesPerDay })}
          />

          <Choice
            label={LIMIT_LABELS.priceProtection}
            help={`Every trade stays within ${bpsLabel(limits.priceProtection)} of Chainlink's price.`}
            value={limits.priceProtection}
            options={PRICE_PROTECTION.map((option) => ({
              ...option,
              label: `${option.label}, ${bpsLabel(option.value)}`
            }))}
            change={changes?.priceProtection}
            onChange={(priceProtection) => set({ priceProtection })}
          />

          <Choice
            label={LIMIT_LABELS.weeklySlippage}
            help={`It never loses more than ${bpsLabel(limits.weeklySlippage)} of your money to prices in a week.`}
            value={limits.weeklySlippage}
            options={WeeklySlippage.literals.map((value) => ({ value, label: bpsLabel(value) }))}
            change={changes?.weeklySlippage}
            onChange={(weeklySlippage) => set({ weeklySlippage })}
          />

          <LimitSection
            title={LIMIT_LABELS.tradeWhilePaused}
            change={changes?.tradeWhilePaused}
            problem={problemOf("tradeWhilePaused")}
          >
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={`${id}-paused`} className="text-label-sm text-g-600">
                {pausedAllowed ?
                  "Trade while prices are paused, within half its fair price check." :
                  "A Rebalancer only trades while prices are live."}
              </label>
              <Switch
                id={`${id}-paused`}
                checked={limits.tradeWhilePaused}
                disabled={!pausedAllowed}
                onCheckedChange={(tradeWhilePaused) => set({ tradeWhilePaused })}
              />
            </div>
          </LimitSection>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
