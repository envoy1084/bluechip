import { type ReactNode, useEffect, useState } from "react"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { haptic } from "../lib/haptics.ts"
import { Confetti } from "../motion/confetti.tsx"
import { NumberRoll } from "../motion/number-roll.tsx"
import { MomentScope, useMoment } from "../motion/sweep.tsx"
import { shortAddress } from "./address-chip.tsx"
import { OutcomeMark } from "./outcome.tsx"

export interface DepositArrivedCardProps {
  /** How much cash came in. */
  readonly amount: number
  /** Who sent it. */
  readonly from?: string
  /** Under the amount, like a "Show address again" button. */
  readonly footer?: ReactNode
  /** Celebrate with confetti: a first deposit, once per account. */
  readonly celebrate?: boolean
  readonly className?: string
}

/**
 * Cash that just landed, for a screen that watches for it: the check draws itself, a sweep passes over the card, the
 * amount rolls up from zero and phones get a success haptic.
 */
export function DepositArrivedCard({ amount, from, footer, celebrate = false, className }: DepositArrivedCardProps) {
  const { ref: momentRef, play: playMoment } = useMoment()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    // After the first paint, so the amount visibly rolls up from zero.
    const frame = requestAnimationFrame(() => setShown(amount))
    return () => cancelAnimationFrame(frame)
  }, [amount])
  useEffect(() => {
    playMoment()
    haptic("success")
  }, [playMoment])

  return (
    <section
      data-slot="deposit-arrived-card"
      aria-label="Cash arrived"
      className={cn(
        "relative grid w-full justify-items-center gap-1.5 rounded-lg bg-white px-5 pt-[38px] pb-[26px] text-center shadow-[var(--shadow-e2),0_0_0_1px_var(--color-gain-line)]",
        className
      )}
    >
      {celebrate && <Confetti />}
      <OutcomeMark tone="success" size={52} className="mb-2" />
      <span className="text-label text-g-600">Cash arrived</span>
      <NumberRoll
        value={shown}
        format={formatMoney}
        className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em]"
      />
      <output className="block max-w-[38ch] text-body-sm text-g-600">
        USDC on Base{from ? `, from ${shortAddress(from)}` : ""}. It's ready to invest.
      </output>
      {footer}
      <MomentScope ref={momentRef} />
    </section>
  )
}
