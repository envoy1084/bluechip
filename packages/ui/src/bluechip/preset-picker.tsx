import { RadioCard, RadioGroup } from "../components/radio-group.tsx"
import { formatDollars, LIMIT_PRESETS, type LimitPreset, type LimitPresetName } from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"

/** The amounts a preset's card shows. Without `maxInOneStock` (an agent with no stock cap) that line is left out. */
export interface PresetAmounts {
  readonly dailySpend: number
  readonly maxPerTrade: number
  readonly maxInOneStock?: number | undefined
}

export interface PresetPickerProps {
  /** The selected preset; `null` when the limits are custom. Leave undefined to let the picker keep its own. */
  readonly value?: LimitPresetName | null
  readonly defaultValue?: LimitPresetName
  /** Called with the picked preset and its values. */
  readonly onValueChange?: (preset: LimitPreset) => void
  /**
   * The amounts each preset sets where they differ from the presets' own, such as a template that caps the daily
   * spend lower. `onValueChange` still reports the preset.
   */
  readonly amounts?: Readonly<Record<LimitPresetName, PresetAmounts>>
  /** Shows only the daily spend, for tight spaces like the limit editor. */
  readonly compact?: boolean
  readonly className?: string
}

/** Three starting points for limits: Conservative, Balanced and Active, each with its values. Arrow keys move. */
export function PresetPicker(
  { value, defaultValue, onValueChange, amounts, compact = false, className }: PresetPickerProps
) {
  return (
    <RadioGroup
      aria-label="Limit presets"
      {...(value === undefined ? {} : { value })}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      onValueChange={(name) => {
        const preset = LIMIT_PRESETS.find((candidate) => candidate.name === name)
        if (preset) onValueChange?.(preset)
      }}
      className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-3", compact && "gap-2", className)}
    >
      {LIMIT_PRESETS.map((preset) => {
        const shown: PresetAmounts = amounts?.[preset.name] ?? preset.limits
        return (
          <RadioCard
            key={preset.name}
            value={preset.name}
            data-slot="preset-picker-item"
            // The radio dot sits in the title row, so the values below can use the full width.
            className={cn(
              "relative min-w-0 *:aria-hidden:absolute *:aria-hidden:top-3.5 *:aria-hidden:right-3.5",
              compact && "px-3 py-2.5 *:aria-hidden:top-2.5 *:aria-hidden:right-3"
            )}
          >
            <span className="grid min-w-0 flex-1 gap-1.5">
              <b className="pr-6 text-body-sm font-semibold">{preset.label}</b>
              {!compact && <span className="text-label-sm text-g-500">{preset.blurb}</span>}
              <span
                className={cn(
                  "grid gap-[3px] border-t border-dashed border-g-200 text-label font-semibold tabular-nums",
                  compact ? "mt-0.5 pt-1.5" : "mt-1.5 pt-2.5"
                )}
              >
                {/* An agent that only sells spends nothing: it reads as what it is, not as "$0 a day". */}
                {shown.dailySpend === 0 ?
                  <PresetValue value="No buys" unit="" /> :
                  <PresetValue value={formatDollars(shown.dailySpend)} unit="a day" />}
                {!compact && (
                  <>
                    <PresetValue value={formatDollars(shown.maxPerTrade)} unit="per trade" />
                    {shown.maxInOneStock === undefined ?
                      null :
                      <PresetValue value={`${shown.maxInOneStock}%`} unit="max in one" />}
                  </>
                )}
              </span>
            </span>
          </RadioCard>
        )
      })}
    </RadioGroup>
  )
}

function PresetValue({ value, unit }: { readonly value: string; readonly unit: string }) {
  return (
    <span className="flex justify-between gap-2">
      {value}
      <em className="text-caption font-medium text-g-500 not-italic">{unit}</em>
    </span>
  )
}
