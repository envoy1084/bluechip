import { triggerOf } from "@bluechip/domain/automations/Automation"
import type { Settings } from "@bluechip/domain/automations/Settings"
import { DatePicker } from "@bluechip/ui/components/date-picker"
import * as DateTime from "effect/DateTime"
import { type ReactNode, useId } from "react"
import { ChoiceField } from "../../../../components/fields/ChoiceField.tsx"
import { NumberField } from "../../../../components/fields/NumberField.tsx"
import { ToggleField } from "../../../../components/fields/ToggleField.tsx"
import { COOLDOWNS } from "../../model/automationText.ts"
import type { DraftFields } from "../../model/drafts.ts"
import { TimeField } from "./fields/TimeField.tsx"

// The day in your time zone, as the last day is kept: its end in your time.
const dayOf = (at: DateTime.Utc): string => new Date(DateTime.toEpochMillis(at)).toLocaleDateString("en-CA")

/** The last day it may run on, ending at the end of that day in your time. */
function ExpiryField({ value, onChange }: Readonly<{ value: DateTime.Utc; onChange: (at: DateTime.Utc) => void }>) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <span id={id} className="text-[13.5px] font-medium text-g-700">Last day</span>
      <DatePicker
        size="sm"
        aria-labelledby={id}
        value={dayOf(value)}
        min={dayOf(DateTime.nowUnsafe())}
        onValueChange={(day) => onChange(DateTime.makeUnsafe(new Date(`${day}T23:59:00`)))}
        className="w-[190px]"
      />
    </div>
  )
}

/** A few settings under a small heading, apart from the next group. */
function SettingsGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="border-t border-g-100 pt-4 first:border-t-0 first:pt-0">
      <fieldset className="min-w-0">
        <legend className="mb-3 text-caption font-semibold tracking-[.06em] text-g-500 uppercase">{title}</legend>
        <div className="grid gap-3.5">{children}</div>
      </fieldset>
    </div>
  )
}

/**
 * How often it may run and when it stays quiet: the wait between runs, a most number of runs, a last day, quiet
 * hours in your time, the market's hours, and, for news and judgments, whether it may trade without asking you.
 */
export function SettingsFields(
  { draft, zone, quietProblem, onChange }: Readonly<{
    draft: DraftFields
    zone: string
    quietProblem: string | undefined
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
      <SettingsGroup title="How often">
        <ChoiceField
          label="Wait between runs"
          value={settings.cooldownMinutes}
          options={cooldowns.map((option) => ({ value: option.minutes, label: option.label }))}
          onChange={(minutes) => set({ cooldownMinutes: minutes })}
        />

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

        <ToggleField
          label="End on a date"
          checked={settings.expiresAt !== null}
          onChange={(on) => set({ expiresAt: on ? DateTime.add(DateTime.nowUnsafe(), { days: 30 }) : null })}
        />
        {settings.expiresAt === null ?
          null :
          <ExpiryField value={settings.expiresAt} onChange={(at) => set({ expiresAt: at })} />}
      </SettingsGroup>

      <SettingsGroup title="When it stays quiet">
        <ToggleField
          label="Only while the market is open"
          help="It waits for regular trading hours to run."
          checked={settings.marketHoursOnly ?? trigger.marketHours}
          onChange={(on) => set({ marketHoursOnly: on })}
        />

        <ToggleField
          label="Quiet hours"
          help="It doesn't run between these times, in your time zone."
          checked={settings.quietHours !== null}
          problem={quietProblem}
          onChange={(on) => set({ quietHours: on ? { from: "22:00", to: "07:00", timeZone: zone } : null })}
        />
        {settings.quietHours === null ? null : (
          <div className="grid grid-cols-2 gap-3">
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
      </SettingsGroup>

      {trades && unsure ?
        (
          <SettingsGroup title="Asking you">
            <ToggleField
              label="Trade without asking me"
              help={settings.actDirectly ?
                "Trades on news go ahead inside the agent's rules." :
                "Each trade on news waits for your Face ID."}
              checked={settings.actDirectly}
              onChange={(on) => set({ actDirectly: on })}
            />
          </SettingsGroup>
        ) :
        null}
    </div>
  )
}
