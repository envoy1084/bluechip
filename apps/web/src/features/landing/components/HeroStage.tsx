import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"

/** A card over the warp: it flies in from the warp's centre (`from`), then floats. */
function Floating(
  { from, delay, className, children }: Readonly<{
    from: readonly [number, number]
    delay: number
    className: string
    children: ReactNode
  }>
) {
  return (
    <div
      className={cn(
        "absolute z-10 animate-[landing-arrive_1300ms_var(--ease-brand)_both] motion-reduce:animate-none",
        className
      )}
      style={{ "--from-x": `${from[0]}px`, "--from-y": `${from[1]}px`, animationDelay: `${delay}ms` } as CSSProperties}
    >
      <div
        className="animate-[landing-float_7s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ animationDelay: `${delay + 1300}ms` }}
      >
        {children}
      </div>
    </div>
  )
}

const card = "rounded-xl bg-white/95 shadow-e4 backdrop-blur-md"

/**
 * The warp, the halftone scene bluechip plays when a trade or a withdrawal leaves, framed like a plate with crop
 * marks, the pointer steering its centre. Over it, on wider screens, an agent at work and a trade its limits stopped.
 * Decorative: the headline beside it says the same.
 */
export function HeroStage() {
  // The spend rolls up once its card has landed.
  const [spent, setSpent] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setSpent(50), 1900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[600px] lg:mr-0">
      <div className="relative aspect-square animate-[landing-rise_1200ms_var(--ease-brand)_both] overflow-hidden rounded-[28px] bg-white shadow-e3 [animation-delay:200ms] motion-reduce:animate-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(42,91,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(42,91,255,.05)_1px,transparent_1px)] [background-size:32px_32px]" />
        <Halftone scene="warp" cell={8} className="absolute inset-0 size-full" />
        {([
          "top-4 left-4 border-t border-l",
          "top-4 right-4 border-t border-r",
          "bottom-4 left-4 border-b border-l",
          "right-4 bottom-4 border-r border-b"
        ] as const).map((corner) => <i key={corner} className={cn("absolute size-4 border-g-300", corner)} />)}
      </div>

      <Floating from={[180, 120]} delay={1100} className="top-[9%] -left-3 hidden w-[272px] sm:block lg:-left-14">
        <div className={cn(card, "grid gap-3.5 p-4")}>
          <div className="flex items-center gap-2.5">
            <AgentAvatar agentId="Weekly buyer" size="lg" status="active" />
            <span className="grid flex-1">
              <b className="text-body-sm font-semibold">Weekly buyer</b>
              <span className="text-caption text-g-500">Microsoft, every Monday</span>
            </span>
            <StatusPill tone="positive" dot="live">Active</StatusPill>
          </div>
          <UsageMeter used={spent} limit={100} />
        </div>
      </Floating>

      <Floating from={[-180, -140]} delay={1350} className="-right-3 bottom-[8%] hidden w-[284px] sm:block lg:-right-6">
        <div className={cn(card, "grid gap-2 bg-[linear-gradient(180deg,#fff,#fff8f6)] p-4")}>
          <div className="flex items-center gap-2.5">
            <Illustration name="stop-sign" size={28} aria-hidden />
            <b className="text-body-sm font-semibold text-[#b3300f]">Your limit stopped this trade</b>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-label text-g-700">
            <TickerChip symbol="TSLA" size="sm" />$2,400 would be 41% of your money. Your max is 30%.
          </p>
        </div>
      </Floating>
    </div>
  )
}
