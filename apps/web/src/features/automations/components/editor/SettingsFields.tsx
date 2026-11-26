import { triggerOf } from "@bluechip/domain/automations/Automation"
import type { Settings } from "@bluechip/domain/automations/Settings"
import { Input } from "@bluechip/ui/components/input"
import * as DateTime from "effect/DateTime"
import { useId } from "react"
import { ChoiceField } from "../../../../components/fields/ChoiceField.tsx"
import { NumberField } from "../../../../components/fields/NumberField.tsx"
import { ToggleField } from "../../../../components/fields/ToggleField.tsx"
import { COOLDOWNS } from "../../model/automationText.ts"
import type { DraftFields } from "../../model/drafts.ts"
import { TimeField } from "./fields/TimeField.tsx"

const dayOf = (at: DateTime.Utc): string => DateTime.formatIsoDateUtc(at)

/** The last day it may run on, ending at the end of that day in your time. */
function ExpiryField({ value, onChange }: Readonly<{ value: DateTime.Utc; onChange: (at: DateTime.Utc) => void }>) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[13.5px] font-medium text-g-700">Last day</label>
      <Input
        id={id}
        type="date"
        size="sm"
        value={dayOf(value)}
        min={dayOf(DateTime.nowUnsafe())}
        onChange={(event) => {
          const day = event.currentTarget.value
          if (day !== "") onChange(DateTime.makeUnsafe(new Date(`${day}T23:59:00`)))
        }}
        className="w-[160px]"
      />
    </div>
  )
}

/**
 * How often it may run and when it stays quiet: the wait between runs, a most number of runs, a last day, quiet
 * hours in your time, the market's hours, and, for news and judgments, whether it may trade without asking you.
 */
export function SettingsFields(
  { draft, zone, onChange }: Readonly<{
    draft: DraftFields
    zone: string
    onChange: (settings: Settings) => void
  }>
) {
  const { settings } = draft
  const trigger = triggerOf(draft.trigger)
  const set = (changes: Partial<Settings>) => onChange({ ...settings, ...changes })
  const cooldowns = COOLDOWNS.some((option) => option.minutes === settings.cooldownMinutes) ?
    COOLDOWNS :
    [...COOLDOWNS, { minutes: settings.cooldownMinutes, label: `${settings.cooldownMinutes} min` }]
  const trades = draft.action.type !== "notify" && draft.action.type !== "ask"
  const unsure = trigger.asks || draft.conditions.some((condition) => condition.type === "judgment")

  return (
    <div className="grid gap-5">
      <ChoiceField
        label="Wait between runs"
        value={settings.cooldownMinutes}
        options={cooldowns.map((option) => ({ value: option.minutes, label: option.label }))}
        onChange={(minutes) => set({ cooldownMinutes: minutes })}
      />

      <div className="grid gap-3">
        <ToggleField
          label="Stop after a number of runs"
          checked={settings.maxFires !== null}
          onChange={(on) => set({ maxFires: on ? 1 : null })}
        />
        {settings.maxFires === null ? null : (
          <NumberField
            label="Runs"
            unit="count"
            value={settings.maxFires}
            min={1}
            max={50}
            step={1}
            onChange={(count) => set({ maxFires: Math.max(1, Math.round(count)) })}
          />
        )}
      </div>

      <div className="grid gap-3">
        <ToggleField
          label="End on a date"
          checked={settings.expiresAt !== null}
          onChange={(on) => set({ expiresAt: on ? DateTime.add(DateTime.nowUnsafe(), { days: 30 }) : null })}
        />
        {settings.expiresAt === null ?
          null :
          <ExpiryField value={settings.expiresAt} onChange={(at) => set({ expiresAt: at })} />}
      </div>

      <div className="grid gap-3">
        <ToggleField
          label="Quiet hours"
          help="It doesn't run between these times, in your time zone."
          checked={settings.quietHours !== null}
          onChange={(on) => set({ quietHours: on ? { from: "22:00", to: "07:00", timeZone: zone } : null })}
        />
        {settings.quietHours === null ? null : (
          <div className="grid gap-3 sm:grid-cols-2">
            <TimeField
              label="From"
              value={settings.quietHours.from}
              onChange={(from) => set({ quietHours: { ...settings.quietHours!, from } })}
            />
            <TimeField
              label="To"
              value={settings.quietHours.to}
              onChange={(to) => set({ quietHours: { ...settings.quietHours!, to } })}
            />
          </div>
        )}
      </div>

      <ToggleField
        label="Only while the market is open"
        checked={settings.marketHoursOnly ?? trigger.marketHours}
        onChange={(on) => set({ marketHoursOnly: on })}
      />

      {trades && unsure ?
        (
          <ToggleField
            label="Trade without asking me"
            help={settings.actDirectly ?
              "Trades on news go ahead inside the agent's rules." :
              "Each trade on news waits for your Face ID."}
            checked={settings.actDirectly}
            onChange={(on) => set({ actDirectly: on })}
          />
        ) :
        null}
    </div>
  )
}
