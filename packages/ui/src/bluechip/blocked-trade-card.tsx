import { type ReactNode, useRef, useState } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { AllocationBar } from "./allocation-bar.tsx"

export interface BlockedTradeCardProps {
  readonly agentName: string
  /** When it happened: "2 min ago". */
  readonly time: ReactNode
  /** Shown after the time, like an "Example" flag. */
  readonly meta?: ReactNode
  readonly side: "buy" | "sell"
  readonly stockName: string
  readonly amount: number
  /** The stock's share of your money now, in percent. */
  readonly weight: number
  /** What the trade would have made it. */
  readonly projected: number
  /** Your max in one stock, in percent. */
  readonly cap: number
  /** You kept your limit. The card turns into a quiet confirmation with Undo. */
  readonly onKeep?: () => void
  /** Open the limit editor. */
  readonly onChangeLimit?: () => void
  readonly className?: string
}

/**
 * The moment a limit says no, said plainly: what the agent tried, which limit stopped it, the numbers against your
 * max, and that nothing happened to your money. Keep my limit is the calm default. A red wash, never a modal.
 */
export function BlockedTradeCard({
  agentName,
  time,
  meta,
  side,
  stockName,
  amount,
  weight,
  projected,
  cap,
  onKeep,
  onChangeLimit,
  className
}: BlockedTradeCardProps) {
  const [kept, setKept] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)

  if (kept) {
    return (
      <section
        data-slot="blocked-trade-card"
        data-state="kept"
        aria-label="Limit kept"
        className={cn("flex w-full max-w-[560px] items-center gap-3 rounded-lg bg-white p-5 shadow-e2", className)}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#23a463,var(--color-gain))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_14px_-6px_rgba(15,138,74,.5)]">
          <Icon name="check" />
        </span>
        <div className="grid min-w-0 flex-1 gap-px">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em]">You kept your {cap}% limit</h3>
          <span className="text-label-sm text-g-500">{agentName} will look for a smaller trade that fits.</span>
        </div>
        <Button
          ref={undoRef}
          variant="ghost"
          size="sm"
          onClick={() => {
            setKept(false)
            requestAnimationFrame(() => keepRef.current?.focus())
          }}
        >
          Undo
        </Button>
      </section>
    )
  }

  return (
    <section
      data-slot="blocked-trade-card"
      data-state="blocked"
      aria-label="Your limit stopped a trade"
      className={cn(
        "grid w-full max-w-[560px] gap-3.5 rounded-lg bg-[linear-gradient(180deg,#fff,#fffaf8)] p-5 shadow-[var(--shadow-e3),0_0_0_1px_var(--color-loss-line)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#f25e3e,var(--color-loss))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_14px_-6px_rgba(217,58,28,.6)]">
          <Icon name="stop-sign" />
        </span>
        <div className="grid min-w-0 gap-px">
          <h3 className="text-[17px] font-semibold tracking-[-0.02em]">Your limit stopped a trade</h3>
          <span className="flex flex-wrap items-center gap-1.5 text-label-sm text-g-500">
            {agentName} · {time}
            {meta}
          </span>
        </div>
      </div>
      <p className="text-[14.5px] text-g-700">
        {agentName} tried to {side}{" "}
        <b className="font-semibold text-ink">{formatMoney(amount)} of {stockName}</b>. That would put{" "}
        <b className="font-semibold text-ink">{Math.round(projected)}%</b> of your money in one stock, and your max is
        {" "}
        <b className="font-semibold text-ink">{cap}%</b>.
      </p>
      <div className="grid gap-2 rounded-md bg-white p-3.5 shadow-[0_0_0_1px_var(--color-g-100)]">
        <AllocationBar weight={weight} projected={projected} cap={cap} size="lg" label={stockName} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-[550] text-g-600">
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] bg-blue" />Now {weight}%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-3 w-[3px] rounded-[1px] bg-ink" />Your max {cap}%
          </span>
          <span className="inline-flex items-center gap-1.5 text-loss">
            <i className="size-2.5 rounded-[3px] bg-[repeating-linear-gradient(135deg,rgba(217,58,28,.7)_0_2px,rgba(217,58,28,.2)_2px_4px)]" />
            Would be {Math.round(projected)}%
          </span>
        </div>
      </div>
      <p className="inline-flex items-center gap-1.5 text-label font-[550] text-gain">
        <Icon name="shield" size={14} />
        {side === "buy"
          ? "Nothing was bought. Your cash is where it was."
          : "Nothing was sold. Your stocks are where they were."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          ref={keepRef}
          variant="secondary"
          onClick={() => {
            setKept(true)
            onKeep?.()
            requestAnimationFrame(() => undoRef.current?.focus())
          }}
        >
          Keep my limit
        </Button>
        <Button variant="ghost" onClick={onChangeLimit}>Change limit</Button>
      </div>
    </section>
  )
}
