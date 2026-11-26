import { PolicyGroup, PolicyRow } from "@bluechip/ui/bluechip/policy-row"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Input } from "@bluechip/ui/components/input"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { useId, useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"

const LOCK = <Icon name="lock" size={16} label="Every agent has this rule" className="text-g-400" />

/** A field as the kit stands it in for a policy's editor. */
function Field({ label, value, unit }: { readonly label: string; readonly value: string; readonly unit: string }) {
  const id = useId()
  return (
    <div className="grid max-w-[240px] gap-1.5">
      <label htmlFor={id} className="text-[13.5px] font-medium">{label}</label>
      <span className="flex items-center gap-2">
        <Input id={id} defaultValue={value} inputMode="decimal" />
        <span className="text-label text-g-500">{unit}</span>
      </span>
    </div>
  )
}

export function PolicyRowSection() {
  const [cashOn, setCashOn] = useState(true)
  const [stopOn, setStopOn] = useState(false)

  return (
    <Section
      title="Policy rows"
      purpose="Each rule folds to one line that says what it does now; Edit opens its editor. Optional rules switch in place and open as they come on; every agent's own rules carry a lock. A problem keeps a row open."
    >
      <Demo className="justify-center">
        <PolicyGroup
          title="Its limits"
          description="Checked onchain on every trade it makes."
          className="w-full max-w-[600px]"
        >
          <div className="grid gap-2 border-b border-g-100 px-[18px] py-4">
            <span className="text-label font-semibold text-g-800">Start from a preset</span>
            <PresetPicker defaultValue="balanced" />
          </div>
          <PolicyRow
            title="Trade size"
            summary="Trade up to $100 at a time, and ask you before anything bigger."
            control={LOCK}
          >
            <Field label="Ask me above" value="100" unit="a trade" />
          </PolicyRow>
          <PolicyRow
            title="Max in one stock"
            summary="Put at most 30% of your money in one stock."
            badge={
              <span className="rounded-full bg-gain-wash px-2 py-px text-[11.5px] font-semibold text-gain">
                Tighter
              </span>
            }
            control={<Switch aria-label="Max in one stock" defaultChecked />}
            defaultOpen
          >
            <Field label="Max in one stock" value="30" unit="%" />
          </PolicyRow>
          <PolicyRow
            title="Cash reserve"
            off={!cashOn}
            summary={cashOn ? "Keep at least 10% in cash." : "The share of your money it always leaves in cash."}
            control={<Switch aria-label="Cash reserve" checked={cashOn} onCheckedChange={setCashOn} />}
          >
            <Field label="Cash reserve" value="10" unit="%" />
          </PolicyRow>
          <PolicyRow
            title="Stop-loss floor"
            off={!stopOn}
            summary={stopOn
              ? "Sell Apple only at or under $170."
              : "Sells a stock only once it falls to a price you set."}
            control={<Switch aria-label="Stop-loss floor" checked={stopOn} onCheckedChange={setStopOn} />}
          >
            <Field label="Apple floor" value="170" unit="a share" />
          </PolicyRow>
        </PolicyGroup>
      </Demo>
      <States>
        <Demo label="A problem keeps it open">
          <PolicyGroup title="Its limits" className="w-full">
            <PolicyRow
              title="Trade size"
              summary="Trade up to $300 at a time."
              problem="Can't be more than the daily budget ($250)."
              control={LOCK}
            >
              <Field label="Ask me above" value="300" unit="a trade" />
            </PolicyRow>
          </PolicyGroup>
        </Demo>
        <Demo label="Fine-tuning, folded">
          <Collapsible className="w-full overflow-hidden rounded-lg bg-white shadow-e1">
            <CollapsibleTrigger className="group/adv flex w-full cursor-pointer items-center justify-between gap-2 px-[18px] py-3.5 text-left hover:bg-g-50">
              <span className="grid gap-0.5">
                <span className="text-[14px] font-semibold">Fine-tuning</span>
                <span className="text-label text-g-500">
                  Price checks, slippage and trades a day. Most people leave these.
                </span>
              </span>
              <Icon
                name="chevron-down"
                size={16}
                className="text-g-500 transition-transform duration-base ease-brand group-data-panel-open/adv:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-g-100">
                <PolicyRow
                  title="Fair price"
                  summary="Trade on weekends and holidays, with a tighter price limit."
                  control={LOCK}
                >
                  <Field label="Most away from Chainlink" value="1" unit="%" />
                </PolicyRow>
                <PolicyRow title="Trades a day" summary="Trade 12 times a day at most." control={LOCK}>
                  <Field label="Trades a day" value="12" unit="trades" />
                </PolicyRow>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Demo>
      </States>
    </Section>
  )
}
