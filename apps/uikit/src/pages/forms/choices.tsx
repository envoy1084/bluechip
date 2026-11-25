import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@bluechip/ui/components/field"
import { Label } from "@bluechip/ui/components/label"
import {
  RadioCard,
  RadioCardContent,
  RadioCardIcon,
  RadioGroup,
  RadioGroupItem
} from "@bluechip/ui/components/radio-group"
import { Slider } from "@bluechip/ui/components/slider"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId, useState } from "react"
import { PERCENT, TEMPLATES, USD_WHOLE } from "./data.ts"
import { Demo, focusOutline, sample, Section, States, Ticker } from "./layout.tsx"

/* ---------- Choices ---------- */

export const KIDS = [["NVDA", "Nvidia"], ["AAPL", "Apple"], ["TSLA", "Tesla"], ["MSFT", "Microsoft"]] as const

export function CheckboxSection() {
  const [allowed, setAllowed] = useState<ReadonlySet<string>>(new Set(["NVDA", "AAPL"]))
  const all = allowed.size === KIDS.length
  return (
    <Section
      title="Checkbox"
      purpose="Turns an option on or off inside a list. A parent shows a dash when only some are on."
      base="Checkbox"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid min-w-[min(100%,280px)] gap-2.5 rounded-lg bg-g-50 p-4 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]">
          <Label>
            <Checkbox
              checked={all}
              indeterminate={allowed.size > 0 && !all}
              onCheckedChange={(checked) => setAllowed(new Set(checked ? KIDS.map(([t]) => t) : []))}
            />
            Stocks this agent can trade
          </Label>
          <div className="ml-2 grid gap-2.5 border-l border-g-200 pl-7">
            {KIDS.map(([symbol, name]) => (
              <Label key={symbol}>
                <Checkbox
                  checked={allowed.has(symbol)}
                  onCheckedChange={(checked) =>
                    setAllowed((current) => {
                      const next = new Set(current)
                      if (checked) next.add(symbol)
                      else next.delete(symbol)
                      return next
                    })}
                />
                <Ticker symbol={symbol} />
                {name}
              </Label>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <Field orientation="horizontal">
            <Checkbox defaultChecked />
            <FieldContent>
              <FieldLabel>Ask me before trades over $500</FieldLabel>
              <FieldDescription>You'll get a Face ID prompt on your phone.</FieldDescription>
            </FieldContent>
          </Field>
          <Field orientation="horizontal" disabled>
            <Checkbox />
            <FieldLabel>Trade with borrowed money (not available)</FieldLabel>
          </Field>
        </div>
      </Demo>
      <States
        items={[
          ["Unchecked", <Checkbox key="off" aria-label="Unchecked" {...sample} />],
          ["Checked", <Checkbox key="on" aria-label="Checked" checked {...sample} />],
          ["Indeterminate", <Checkbox key="mixed" aria-label="Indeterminate" indeterminate {...sample} />],
          [
            "Hover",
            <Checkbox
              key="hover"
              aria-label="Hover"
              className="shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32),0_1px_2px_rgba(10,11,13,.05)]"
              {...sample}
            />
          ],
          ["Focus", <Checkbox key="focus" aria-label="Focus" checked className={focusOutline} {...sample} />],
          ["Error", <Checkbox key="error" aria-label="Error" aria-invalid {...sample} />],
          ["Disabled", <Checkbox key="disabled" aria-label="Disabled" disabled />],
          ["Disabled on", <Checkbox key="disabled-on" aria-label="Disabled on" disabled checked />]
        ]}
      />
    </Section>
  )
}

export function RadioGroupSection() {
  const askId = useId()
  const templateId = useId()
  const options = [
    ["every", "Every trade", "Approve each one with Face ID."],
    ["over-500", "Trades over $500", "Smaller trades run on their own."],
    ["never", "Never", "The agent runs inside its limits."]
  ] as const
  return (
    <Section
      title="Radio group"
      purpose="Choose exactly one. Arrow keys move and select; radio cards give each choice room to explain itself."
      base="RadioGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid gap-2">
          <span id={askId} className="text-[13.5px] font-[550]">Ask before a trade</span>
          <RadioGroup aria-labelledby={askId} defaultValue="over-500">
            {options.map(([value, label, description]) => (
              <Label key={value} className="items-start">
                <RadioGroupItem value={value} className="mt-px" />
                <span className="grid gap-0.5">
                  {label}
                  <span className="text-label-sm font-normal text-g-500">{description}</span>
                </span>
              </Label>
            ))}
            <Label>
              <RadioGroupItem value="weekends" disabled />
              Only on weekends (soon)
            </Label>
          </RadioGroup>
        </div>
        <div className="grid min-w-0 flex-1 basis-[min(100%,460px)] gap-2">
          <span id={templateId} className="text-[13.5px] font-[550]">Start from a template</span>
          <RadioGroup
            aria-labelledby={templateId}
            defaultValue="rebalancer"
            className="grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5"
          >
            {TEMPLATES.map((template) => (
              <RadioCard key={template.id} value={template.id}>
                <RadioCardIcon>
                  <Icon name={template.icon} size={18} />
                </RadioCardIcon>
                <RadioCardContent>
                  <strong>{template.name}</strong>
                  {template.say}
                </RadioCardContent>
              </RadioCard>
            ))}
          </RadioGroup>
        </div>
      </Demo>
      <States
        items={[
          ["Off", <RadioSample key="off" />],
          ["On", <RadioSample key="on" checked />],
          [
            "Hover",
            <RadioSample
              key="hover"
              className="shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgba(10,11,13,.32)]"
            />
          ],
          ["Focus", <RadioSample key="focus" checked className={focusOutline} />],
          ["Error", <RadioSample key="error" invalid />],
          ["Disabled", <RadioSample key="disabled" disabled />]
        ]}
      />
    </Section>
  )
}

export function RadioSample(
  { checked = false, invalid = false, disabled = false, className }: {
    readonly checked?: boolean
    readonly invalid?: boolean
    readonly disabled?: boolean
    readonly className?: string
  }
) {
  return (
    <RadioGroup aria-label="Sample" value={checked ? "a" : null} disabled={disabled}>
      <RadioGroupItem
        value="a"
        tabIndex={-1}
        {...(invalid ? { "aria-invalid": true } : {})}
        {...(className ? { className } : {})}
      />
    </RadioGroup>
  )
}

export function SwitchSection() {
  const rows = [
    ["Pause all agents", "Nothing trades until you turn this off.", false],
    ["Trade alerts", "A notification after every trade.", true],
    ["Weekly summary email", "Sent Sunday mornings.", true]
  ] as const
  return (
    <Section title="Switch" purpose="Turns a setting on or off right away, with no save button." base="Switch">
      <Demo>
        <div className="grid w-full max-w-[560px] divide-y divide-g-100">
          {rows.map(([label, description, on]) => (
            <SettingRow key={label} label={label} description={description}>
              <Switch defaultChecked={on} />
            </SettingRow>
          ))}
          <SettingRow label="Borrow to trade" description="bluechip never trades with borrowed money." disabled>
            <Switch disabled />
          </SettingRow>
        </div>
      </Demo>
      <States
        items={[
          ["Off", <Switch key="off" aria-label="Off" {...sample} />],
          ["On", <Switch key="on" aria-label="On" checked {...sample} />],
          ["Hover", <Switch key="hover" aria-label="Hover" className="bg-g-300" {...sample} />],
          ["Focus", <Switch key="focus" aria-label="Focus" checked className={focusOutline} {...sample} />],
          ["Small", <Switch key="small" aria-label="Small" size="sm" checked {...sample} />],
          ["Disabled", <Switch key="disabled" aria-label="Disabled" disabled />],
          ["Disabled on", <Switch key="disabled-on" aria-label="Disabled on" disabled checked />]
        ]}
      />
    </Section>
  )
}

export function SettingRow(
  { label, description, disabled = false, children }: {
    readonly label: string
    readonly description: string
    readonly disabled?: boolean
    readonly children: ReactNode
  }
) {
  return (
    <Label className={cn("flex justify-between gap-5 py-3.5", disabled && "cursor-not-allowed text-g-400")}>
      <span className="grid gap-0.5">
        {label}
        <span className="text-label-sm font-normal text-g-500">{description}</span>
      </span>
      {children}
    </Label>
  )
}

export function SliderSection() {
  const [maxPerTrade, setMaxPerTrade] = useState<number | ReadonlyArray<number>>(250)
  const [cash, setCash] = useState<number | ReadonlyArray<number>>([5, 20])
  const range = Array.isArray(cash) ? cash : [cash, cash]
  return (
    <Section
      title="Slider"
      purpose="Sets a number or a range by dragging. Values show above the thumb; arrow keys step."
      base="Slider"
    >
      <Demo>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-6 gap-y-7">
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-[550]">Max per trade</span>
              <output className="text-label font-semibold text-blue tabular-nums">
                ${String(maxPerTrade)} per trade
              </output>
            </div>
            <Slider
              value={maxPerTrade}
              onValueChange={setMaxPerTrade}
              max={1000}
              step={25}
              format={USD_WHOLE}
              thumbLabels={["Max per trade"]}
            />
          </div>
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-[550]">Keep cash between</span>
              <output className="text-label font-semibold text-blue tabular-nums">{range[0]}% – {range[1]}%</output>
            </div>
            <Slider
              value={cash}
              onValueChange={setCash}
              max={50}
              format={PERCENT}
              thumbLabels={["Lowest cash", "Highest cash"]}
            />
          </div>
          <div className="grid gap-[7px]">
            <div className="flex items-center justify-between gap-3 text-g-400">
              <span className="text-[13.5px] font-[550]">Max in one stock (locked)</span>
              <Icon name="lock" size={14} />
            </div>
            <Slider defaultValue={25} step={5} format={PERCENT} thumbLabels={["Max in one stock"]} disabled />
          </div>
        </div>
      </Demo>
    </Section>
  )
}
