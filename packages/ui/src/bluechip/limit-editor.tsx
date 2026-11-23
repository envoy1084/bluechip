import { type ComponentProps, type ReactNode, useId, useState } from "react"
import { Button } from "../components/button.tsx"
import { InputGroup, InputGroupInput, InputGroupText } from "../components/input-group.tsx"
import { Slider } from "../components/slider.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import {
  type AgentLimits,
  compareField,
  compareLimits,
  compareStocks,
  LIMIT_FIELDS,
  type LimitChange,
  limitErrors,
  type LimitFieldSpec,
  matchPreset
} from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"
import { findTicker } from "../lib/tickers.ts"
import { PermissionCard } from "./permission-card.tsx"
import { PresetPicker } from "./preset-picker.tsx"
import { TickerToggle } from "./ticker-chip.tsx"

const DEFAULT_STOCKS: ReadonlyArray<string> = ["NVDA", "AAPL", "MSFT", "TSLA", "META", "AMZN"]

const SLIDER_FORMAT: Readonly<Record<LimitFieldSpec["unit"], Intl.NumberFormatOptions>> = {
  dollars: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  percent: { style: "unit", unit: "percent" }
}

export interface LimitEditorProps extends Omit<ComponentProps<"div">, "children" | "defaultValue"> {
  /** The limits in force now. Changes are compared with these: tighter applies at once, looser needs Face ID. */
  readonly locked: AgentLimits
  /** The limits being edited. Leave undefined to let the editor keep its own, starting from `defaultValue`. */
  readonly value?: AgentLimits
  /** Where editing starts. Defaults to `locked`. */
  readonly defaultValue?: AgentLimits
  readonly onValueChange?: (limits: AgentLimits) => void
  /** Stocks the agent may be allowed to trade. */
  readonly stocks?: ReadonlyArray<string>
  /** The day the current Face ID lock runs out: "22 Feb". */
  readonly lockedUntil?: string
  /** Applies tighter limits. No Face ID needed. */
  readonly onApply?: (limits: AgentLimits) => void
  /** Locks looser limits with Face ID. While its promise is pending the button waits. */
  readonly onLock?: (limits: AgentLimits) => void | Promise<void>
}

const CHANGE_MARK: Readonly<Record<Exclude<LimitChange, "same">, { readonly text: string; readonly tone: string }>> = {
  tighter: {
    text: "Tighter · applies now",
    tone: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]"
  },
  looser: {
    text: "Looser · needs Face ID",
    tone: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
  }
}

function ChangeMark({ change }: { readonly change: LimitChange }) {
  if (change === "same") return null
  const mark = CHANGE_MARK[change]
  return (
    <span
      data-slot="limit-change"
      data-change={change}
      className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", mark.tone)}
    >
      {mark.text}
    </span>
  )
}

/**
 * Set what an agent may do and read it back as plain sentences while you drag. Each change is marked: tighter
 * limits apply at once; looser ones need Face ID, because they give the agent more power.
 */
export function LimitEditor({
  locked,
  value,
  defaultValue,
  onValueChange,
  stocks = DEFAULT_STOCKS,
  lockedUntil,
  onApply,
  onLock,
  className,
  ...props
}: LimitEditorProps) {
  const id = useId()
  const [own, setOwn] = useState<AgentLimits>(defaultValue ?? locked)
  const [locking, setLocking] = useState(false)
  const [justLocked, setJustLocked] = useState(false)
  const limits = value ?? own
  const errors = limitErrors(limits)
  const firstError = Object.values(errors)[0]
  const change = compareLimits(locked, limits)

  const update = (next: AgentLimits) => {
    setOwn(next)
    setJustLocked(false)
    onValueChange?.(next)
  }
  const lock = async () => {
    setLocking(true)
    try {
      await onLock?.(limits)
      setJustLocked(true)
    } finally {
      setLocking(false)
    }
  }
  const preset = matchPreset(limits)

  return (
    <div
      data-slot="limit-editor"
      className={cn("grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]", className)}
      {...props}
    >
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        <div className="grid gap-2.5 border-b border-g-100 px-[18px] py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13.5px] font-semibold">Start from</span>
            {preset === undefined && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
                <Icon name="edit" size={12} />Custom limits
              </span>
            )}
          </div>
          <PresetPicker
            compact
            value={preset ?? null}
            onValueChange={(picked) => update({ ...limits, ...picked.limits })}
          />
        </div>
        <div className="grid gap-2.5 border-b border-g-100 px-[18px] py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span id={`${id}-stocks`} className="text-[13.5px] font-semibold">Stocks it can trade</span>
            <ChangeMark change={compareStocks(locked.stocks, limits.stocks)} />
          </div>
          <fieldset aria-labelledby={`${id}-stocks`} className="flex flex-wrap gap-1.5">
            {stocks.map((symbol) => (
              <TickerToggle
                key={symbol}
                symbol={symbol}
                name={findTicker(symbol)?.name ?? symbol}
                pressed={limits.stocks.includes(symbol)}
                onPressedChange={(pressed) =>
                  update({
                    ...limits,
                    stocks: pressed ?
                      stocks.filter((s) => s === symbol || limits.stocks.includes(s)) :
                      limits.stocks.filter((s) => s !== symbol)
                  })}
              />
            ))}
          </fieldset>
          {errors.stocks && <p className="text-label-sm font-medium text-loss">{errors.stocks}</p>}
        </div>
        {LIMIT_FIELDS.map((spec) => (
          <LimitFieldRow
            key={spec.field}
            id={`${id}-${spec.field}`}
            spec={spec}
            value={limits[spec.field]}
            change={compareField(spec, locked[spec.field], limits[spec.field])}
            error={errors[spec.field]}
            onChange={(next) => update({ ...limits, [spec.field]: next })}
          />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fafafb] px-[18px] py-3.5">
          <p
            aria-live="polite"
            className={cn(
              "inline-flex min-h-[38px] items-center gap-1.5 text-label text-g-600 [&_svg]:shrink-0",
              firstError && "text-loss",
              justLocked && change === "same" && "text-gain"
            )}
          >
            {footerMessage({ firstError, change, justLocked, lockedUntil })}
          </p>
          <div className="ml-auto flex gap-2">
            {change !== "same" && (
              <Button variant="ghost" onClick={() => update(locked)} disabled={locking}>Undo</Button>
            )}
            {firstError || change === "looser" ?
              (
                <Button disabled={firstError !== undefined || locking} onClick={lock} aria-busy={locking || undefined}>
                  <Icon name="face-id" size={16} />
                  {locking ? "Waiting for Face ID…" : "Lock with Face ID"}
                </Button>
              ) :
              change === "tighter" && <Button onClick={() => onApply?.(limits)}>Apply now</Button>}
          </div>
        </div>
      </div>
      <div className="grid gap-2.5 lg:sticky lg:top-6">
        <span className="text-caption font-semibold tracking-[.06em] text-g-500 uppercase">
          What you'll see on the agent
        </span>
        <PermissionCard
          size="compact"
          limits={limits}
          spentToday={0}
          {...(change === "same" && lockedUntil !== undefined ? { lockedUntil } : {})}
        />
      </div>
    </div>
  )
}

function footerMessage({ firstError, change, justLocked, lockedUntil }: {
  readonly firstError: string | undefined
  readonly change: LimitChange
  readonly justLocked: boolean
  readonly lockedUntil: string | undefined
}): ReactNode {
  const line = (icon: IconName, text: string) => (
    <>
      <Icon name={icon} size={14} />
      {text}
    </>
  )
  if (firstError) return line("error", firstError)
  if (change === "looser") return line("info", "These limits give the agent more room, so they need Face ID.")
  if (change === "tighter") return line("shield", "Tighter limits apply right away. No Face ID needed.")
  if (justLocked) return line("check-circle", "Locked with Face ID. New limits are live.")
  return line("lock", lockedUntil ? `Locked with Face ID until ${lockedUntil}.` : "Not locked yet.")
}

function LimitFieldRow({ id, spec, value, change, error, onChange }: {
  readonly id: string
  readonly spec: LimitFieldSpec
  readonly value: number
  readonly change: LimitChange
  readonly error: string | undefined
  readonly onChange: (value: number) => void
}) {
  const dollars = spec.unit === "dollars"
  return (
    <div data-slot="limit-field" className="grid gap-1.5 border-b border-g-100 px-[18px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-[13.5px] font-semibold">{spec.label}</label>
          <ChangeMark change={change} />
        </div>
        <InputGroup size="sm" className="w-[92px] shrink-0 font-semibold">
          {dollars && <InputGroupText>$</InputGroupText>}
          <InputGroupInput
            id={id}
            inputMode="numeric"
            autoComplete="off"
            className="text-right tabular-nums"
            value={Number.isNaN(value) ? "" : String(value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-help`}
            onChange={(event) => {
              const digits = event.currentTarget.value.replace(/\D/g, "")
              onChange(digits === "" ? Number.NaN : Number(digits))
            }}
          />
          {!dollars && <InputGroupText>%</InputGroupText>}
        </InputGroup>
      </div>
      <Slider
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={Number.isNaN(value) ? spec.min : Math.min(spec.max, Math.max(spec.min, value))}
        onValueChange={(next) => onChange(typeof next === "number" ? next : next[0] ?? spec.min)}
        thumbLabels={[spec.label]}
        format={SLIDER_FORMAT[spec.unit]}
        showValues={false}
        showScale={false}
      />
      <p id={`${id}-help`} className={cn("text-label-sm text-g-500", error && "font-medium text-loss")}>
        {error ?? (spec.field === "approveAbove" && value === 0 ? "Every trade waits for your OK." : spec.help)}
      </p>
    </div>
  )
}
