import { useState } from "react"
import { Button } from "../components/button.tsx"
import { InputGroup, InputGroupInput, InputGroupText } from "../components/input-group.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select.tsx"
import { Slider } from "../components/slider.tsx"
import { Toggle } from "../components/toggle.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { findTicker, TICKERS } from "../lib/tickers.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { CASH_SYMBOL, TickerChip } from "./ticker-chip.tsx"

/** One stock's target share of your money, in whole percent. A locked target is never changed by balancing. */
export interface AllocationTarget {
  readonly symbol: string
  readonly target: number
  readonly locked?: boolean
}

const sum = (targets: ReadonlyArray<AllocationTarget>) => targets.reduce((total, t) => total + t.target, 0)

/** Cash fills whatever the stocks don't use, so stocks plus cash is always 100. */
export const cashTarget = (targets: ReadonlyArray<AllocationTarget>): number => 100 - sum(targets)

/**
 * Sets one stock's target. Raising it takes from cash first, then from the other unlocked stocks, largest first;
 * lowering it gives the difference to cash. It never goes past what that leaves, so the total stays 100.
 */
export const setAllocationTarget = (
  targets: ReadonlyArray<AllocationTarget>,
  symbol: string,
  value: number
): ReadonlyArray<AllocationTarget> => {
  const row = targets.find((t) => t.symbol === symbol)
  if (!row || row.locked) return targets
  const others = targets.filter((t) => t.symbol !== symbol && !t.locked)
  const max = row.target + cashTarget(targets) + sum(others)
  const next = Math.max(0, Math.min(max, Math.round(value)))
  let toTake = Math.max(0, next - row.target - cashTarget(targets))
  const taken = new Map(others.map((t) => [t.symbol, t.target]))
  while (toTake > 0) {
    const [largest] = [...taken].toSorted((a, b) => b[1] - a[1])
    if (!largest || largest[1] === 0) break
    taken.set(largest[0], largest[1] - 1)
    toTake--
  }
  return targets.map((t) =>
    t.symbol === symbol ? { ...t, target: next } : taken.has(t.symbol) ? { ...t, target: taken.get(t.symbol) ?? 0 } : t
  )
}

/** Splits what's left after locked stocks and the cash reserve evenly across the unlocked stocks. */
export const balanceAllocation = (
  targets: ReadonlyArray<AllocationTarget>,
  reserve: number
): ReadonlyArray<AllocationTarget> => {
  const unlocked = targets.filter((t) => !t.locked)
  if (unlocked.length === 0) return targets
  const share = Math.max(0, 100 - reserve - sum(targets.filter((t) => t.locked)))
  const each = Math.floor(share / unlocked.length)
  return targets.map((t) => (t.locked ? t : { ...t, target: each }))
}

export interface AllocationEditorProps {
  readonly defaultValue: ReadonlyArray<AllocationTarget>
  readonly onValueChange?: (targets: ReadonlyArray<AllocationTarget>) => void
  /** Your max in one stock, in percent. Targets above it are flagged. Defaults to 30. */
  readonly cap?: number
  /** The cash you always keep, in percent. Defaults to 10. */
  readonly reserve?: number
  readonly className?: string
}

const percentText = (value: number) => `${value}%`
const nameOf = (symbol: string) => findTicker(symbol)?.name ?? symbol
const SEGMENT = (index: number) => `var(--color-series-${(index % 8) + 1})`

/**
 * The target mix for a Rebalancer. Cash fills the rest, so targets always add up to 100%. Lock a stock to keep it
 * while others move; Split evenly shares what's left and keeps your cash reserve.
 */
export function AllocationEditor(
  { defaultValue, onValueChange, cap = 30, reserve = 10, className }: AllocationEditorProps
) {
  const [targets, setTargets] = useState(defaultValue)
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const cash = cashTarget(targets)
  const addable = TICKERS.filter((t) => !targets.some((row) => row.symbol === t.symbol))

  const update = (next: ReadonlyArray<AllocationTarget>) => {
    setTargets(next)
    onValueChange?.(next)
  }

  return (
    <div
      data-slot="allocation-editor"
      className={cn("grid w-full max-w-[640px] gap-2.5 rounded-lg bg-white px-[18px] py-4 shadow-e2", className)}
    >
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-g-100">
        {targets.map((t, i) => (
          <i
            key={t.symbol}
            className="block min-w-0 shadow-[inset_0_1px_0_rgba(255,255,255,.3)] transition-[flex-grow] duration-slow ease-brand"
            style={{ flexGrow: t.target, background: SEGMENT(i) }}
          />
        ))}
        <i
          className="block min-w-0 transition-[flex-grow] duration-slow ease-brand"
          style={{ flexGrow: cash, background: "var(--color-series-cash)" }}
        />
      </div>

      <ul className="grid">
        {targets.map((t) => {
          const name = nameOf(t.symbol)
          const over = t.target > cap
          return (
            <li
              key={t.symbol}
              data-symbol={t.symbol}
              className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-1 border-b border-g-100 py-2 sm:grid-cols-[60px_92px_minmax(0,1fr)_auto_auto_auto]"
            >
              <TickerChip symbol={t.symbol} />
              <span className="text-[13.5px] font-[550]">{name}</span>
              <Slider
                value={t.target}
                onValueChange={(value) => update(setAllocationTarget(targets, t.symbol, Number(value)))}
                thumbLabels={[`${name} target`]}
                format={{ style: "unit", unit: "percent" }}
                showValues={false}
                showScale={false}
                disabled={t.locked === true}
                className="col-span-full row-start-2 sm:col-span-1 sm:row-start-auto"
              />
              <InputGroup size="sm" className="w-[68px]">
                <InputGroupInput
                  inputMode="numeric"
                  aria-label={`${name} target, percent`}
                  aria-invalid={over}
                  disabled={t.locked === true}
                  value={drafts[t.symbol] ?? String(t.target)}
                  onChange={(event) => {
                    const text = event.currentTarget.value.replace(/\D/g, "")
                    setDrafts({ ...drafts, [t.symbol]: text })
                    if (text !== "") update(setAllocationTarget(targets, t.symbol, Number(text)))
                  }}
                  onBlur={() => setDrafts(({ [t.symbol]: _, ...rest }) => rest)}
                  className="text-right font-semibold tabular-nums"
                />
                <InputGroupText>%</InputGroupText>
              </InputGroup>
              <Toggle
                size="sm"
                aria-label={`Lock ${name}`}
                pressed={t.locked === true}
                onPressedChange={(locked) =>
                  update(targets.map((row) => (row.symbol === t.symbol ? { ...row, locked } : row)))}
              >
                <Icon name={t.locked ? "lock" : "unlock"} size={16} />
              </Toggle>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${name}`}
                onClick={() => update(targets.filter((row) => row.symbol !== t.symbol))}
              >
                <Icon name="close" size={14} />
              </Button>
              {over && (
                <span className="col-span-full text-caption text-loss sm:col-start-2">
                  Over your {cap}% max in one stock. Agents won't buy past {cap}%.
                </span>
              )}
            </li>
          )
        })}
        <li className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[60px_92px_minmax(0,1fr)_auto]">
          <TickerChip symbol={CASH_SYMBOL} />
          <span className="text-[13.5px] font-[550]">Cash</span>
          <span className="hidden text-label-sm text-g-500 sm:block">Fills the rest</span>
          <span data-slot="allocation-editor-cash" className="pr-2 text-right text-body-sm font-semibold tabular-nums">
            <NumberRoll value={cash} format={percentText} />
          </span>
          {cash < reserve && (
            <span className="col-span-full text-caption text-warn sm:col-start-2">
              Below your {reserve}% cash reserve. Agents keep {reserve}% anyway.
            </span>
          )}
        </li>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Select<string>
            value={null}
            onValueChange={(symbol) => {
              if (symbol) update([...targets, { symbol, target: Math.min(10, cash) }])
            }}
            disabled={addable.length === 0}
          >
            <SelectTrigger size="sm" aria-label="Add a stock" className="w-[160px]">
              <Icon name="plus" size={14} />
              <SelectValue placeholder="Add a stock" />
            </SelectTrigger>
            <SelectContent>
              {addable.map((t) => <SelectItem key={t.symbol} value={t.symbol}>{t.name} ({t.symbol})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            disabled={!targets.some((t) => !t.locked)}
            onClick={() => update(balanceAllocation(targets, reserve))}
          >
            <Icon name="scales" size={14} />Split evenly
          </Button>
        </div>
        <span aria-live="polite" className="inline-flex items-center gap-1.5 text-label-sm font-semibold text-gain">
          <Icon name="check-circle" size={14} />Adds up to 100%<span className="sr-only">, {cash}% cash</span>
        </span>
      </div>
    </div>
  )
}
