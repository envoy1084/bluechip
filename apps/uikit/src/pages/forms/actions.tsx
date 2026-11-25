import { Button } from "@bluechip/ui/components/button"
import { ButtonGroup, ButtonGroupText } from "@bluechip/ui/components/button-group"
import { Toggle } from "@bluechip/ui/components/toggle"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { usd } from "./data.ts"
import { Demo, focusOutline, sample, Section, States } from "./layout.tsx"

/* ---------- Actions ---------- */

export function ButtonGroupSection() {
  const [maxPerTrade, setMaxPerTrade] = useState(250)
  const step = (by: number) => setMaxPerTrade((v) => Math.min(1000, Math.max(25, v + by)))
  return (
    <Section
      title="Button group"
      purpose="Joins related buttons into one control so they read as a set."
      base="ButtonGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <ButtonGroup aria-label="Agent actions" className="rounded-sm">
          <Button variant="secondary" size="sm">
            <Icon name="edit" size={16} />Edit
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="pause" size={16} />Pause
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="share" size={16} />Share
          </Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Deposit">
          <Button>
            <Icon name="plus" size={16} />Deposit cash
          </Button>
          <Button size="icon" aria-label="More ways to add cash">
            <Icon name="chevron-down" size={16} />
          </Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Max per trade">
          <Button variant="secondary" size="icon" aria-label="Lower by $25" onClick={() => step(-25)}>
            <Icon name="minus" size={18} />
          </Button>
          <ButtonGroupText aria-live="polite">{usd.format(maxPerTrade).replace(".00", "")}</ButtonGroupText>
          <Button variant="secondary" size="icon" aria-label="Raise by $25" onClick={() => step(25)}>
            <Icon name="plus" size={18} />
          </Button>
        </ButtonGroup>
        <ButtonGroup orientation="vertical" aria-label="Sort holdings" className="rounded-sm">
          <Button variant="secondary" size="sm">By value</Button>
          <Button variant="secondary" size="sm">By change</Button>
          <Button variant="secondary" size="sm">A to Z</Button>
        </ButtonGroup>
      </Demo>
    </Section>
  )
}

export function ToggleSection() {
  return (
    <Section title="Toggle" purpose="A two-state button for a view preference, like hiding balances." base="Toggle">
      <Demo>
        <Toggle>
          <Icon name="eye-off" size={16} />Hide balances
        </Toggle>
        <Toggle defaultPressed>
          <Icon name="chart-line" size={16} />Show in %
        </Toggle>
        <Toggle variant="outline" aria-label="Star NVDA">
          <Icon name="star" size={16} />
        </Toggle>
        <Toggle variant="outline" size="sm" defaultPressed aria-label="Notifications on">
          <Icon name="bell" size={16} />
        </Toggle>
      </Demo>
      <States
        items={[
          [
            "Off",
            <Toggle key="off" {...sample}>
              <Icon name="eye-off" size={16} />Off
            </Toggle>
          ],
          [
            "On",
            <Toggle key="on" pressed {...sample}>
              <Icon name="eye" size={16} />On
            </Toggle>
          ],
          [
            "Hover",
            <Toggle key="hover" className="bg-g-100 text-ink" {...sample}>
              <Icon name="eye-off" size={16} />Hover
            </Toggle>
          ],
          [
            "Focus",
            <Toggle key="focus" className={focusOutline} {...sample}>
              <Icon name="eye-off" size={16} />Focus
            </Toggle>
          ],
          [
            "Disabled",
            <Toggle key="disabled" disabled>
              <Icon name="eye-off" size={16} />Disabled
            </Toggle>
          ]
        ]}
      />
    </Section>
  )
}

export function ToggleGroupSection() {
  return (
    <Section
      title="Toggle group"
      purpose="Pick one or several options from a short set. Arrow keys move between them."
      base="ToggleGroup"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Time range</span>
          <ToggleGroup aria-label="Time range" size="sm" defaultValue={["1M"]}>
            {["1D", "1W", "1M", "3M", "1Y", "All"].map((range) => (
              <ToggleGroupItem key={range} value={range}>{range}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Weekly buyer runs on</span>
          <ToggleGroup
            aria-label="Days"
            multiple
            variant="outline"
            size="sm"
            defaultValue={["Mon", "Thu"]}
            className="flex-wrap"
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <ToggleGroupItem key={day} value={day}>{day}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid min-w-0 gap-2">
          <span className="text-[13.5px] font-[550]">Disabled</span>
          <ToggleGroup aria-label="Chart type" size="sm" defaultValue={["Area"]} disabled>
            {["Area", "Line", "Bars"].map((kind) => <ToggleGroupItem key={kind} value={kind}>{kind}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </Demo>
    </Section>
  )
}
