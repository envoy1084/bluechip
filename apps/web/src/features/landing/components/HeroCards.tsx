import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"

/**
 * One card of the hero's composition. It flies out of the vanishing point (`from` is where it starts, toward the
 * centre), then floats, leaning with the pointer by `depth` pixels.
 */
function Floating(
  { from, delay, depth, className, children }: Readonly<{
    from: readonly [number, number]
    delay: number
    depth: number
    className: string
    children: ReactNode
  }>
) {
  return (
    <div
      className={cn(
        "absolute w-[272px] animate-[landing-arrive_1400ms_var(--ease-brand)_both] motion-reduce:animate-none",
        className
      )}
      style={{ "--from-x": `${from[0]}px`, "--from-y": `${from[1]}px`, animationDelay: `${delay}ms` } as CSSProperties}
    >
      <div
        className="transition-transform duration-[1200ms] ease-brand motion-reduce:transition-none"
        style={{ transform: `translate(calc(var(--lean-x, 0) * ${-depth}px), calc(var(--lean-y, 0) * ${-depth}px))` }}
      >
        <div
          className="animate-[landing-float_7s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ animationDelay: `${delay + 1400}ms` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const card = "rounded-xl bg-white/92 p-4 shadow-e4 backdrop-blur-md"

/**
 * Four example moments around the headline, on wide screens only: an agent at work, a trade it made, one waiting
 * for you and one its limits stopped. Decorative, since the sections below say all of it in words.
 */
export function HeroCards() {
  // The spend rolls up once the card has landed.
  const [spent, setSpent] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setSpent(50), 2100)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1360px] xl:block">
      <Floating from={[320, 140]} delay={1500} depth={14} className="top-[19%] left-6">
        <div className={cn(card, "grid gap-3.5")}>
          <div className="flex items-center gap-2.5">
            <AgentAvatar agentId="Weekly buyer" size="lg" status="active" />
            <span className="grid flex-1">
              <b className="text-body-sm font-semibold">Weekly buyer</b>
              <span className="text-caption text-g-500">$50 of Microsoft every Monday</span>
            </span>
            <StatusPill tone="positive" dot="live">Active</StatusPill>
          </div>
          <UsageMeter used={spent} limit={100} />
        </div>
      </Floating>

      <Floating from={[300, -120]} delay={1750} depth={24} className="bottom-[13%] left-[7%]">
        <div className={cn(card, "flex items-center gap-3 py-3")}>
          <TickerChip symbol="MSFT" />
          <span className="grid flex-1">
            <b className="text-body-sm font-semibold">Bought $50.00 of Microsoft</b>
            <span className="text-caption text-g-500">Weekly buyer, at Chainlink's price</span>
          </span>
          <Icon name="check-circle" size={18} className="text-gain" />
        </div>
      </Floating>

      <Floating from={[-320, 160]} delay={1650} depth={18} className="top-[17%] right-6">
        <div className={cn(card, "grid gap-2.5 bg-[linear-gradient(180deg,#fff,#fff8f6)]")}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]">
              <Icon name="stop-sign" size={16} />
            </span>
            <b className="text-body-sm font-semibold text-[#b3300f]">Your limit stopped this trade</b>
          </div>
          <p className="text-label text-g-700">
            Tech picker tried to buy $2,400 of Tesla. That would put 41% of your money in one stock, and your max is
            30%.
          </p>
          <span className="inline-flex items-center gap-1.5 text-caption text-g-500">
            <Icon name="shield" size={13} />Nothing was bought.
          </span>
        </div>
      </Floating>

      <Floating from={[-300, -140]} delay={1900} depth={28} className="right-[6%] bottom-[15%]">
        <div className={cn(card, "grid gap-3 bg-[linear-gradient(180deg,#fff,#f6f8ff)]")}>
          <div className="flex items-center gap-2.5">
            <AgentAvatar agentId="Tech picker" status="waiting" />
            <span className="grid flex-1">
              <b className="text-body-sm font-semibold">Buy $250 of Apple?</b>
              <span className="text-caption text-g-500">Over Tech picker's largest trade</span>
            </span>
          </div>
          <span className="surface-primary inline-flex h-9 items-center justify-center gap-2 rounded-md text-label font-[550]">
            <Icon name="face-id" size={16} />Approve with Face ID
          </span>
        </div>
      </Floating>
    </div>
  )
}
