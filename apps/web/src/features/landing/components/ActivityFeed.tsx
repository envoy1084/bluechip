import { ActivityItem, type ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { useReducedMotion } from "@bluechip/ui/motion/use-reduced-motion"
import { useEffect, useRef, useState } from "react"
import { useInView } from "../hooks/useInView.ts"

interface Happening {
  readonly kind: ActivityKind
  readonly agent?: string
  readonly title: string
  readonly detail: string
}

const HAPPENINGS: ReadonlyArray<Happening> = [
  {
    kind: "trade",
    agent: "Weekly buyer",
    title: "Bought $50.00 of Microsoft",
    detail: "Its Monday buy, at Chainlink's price"
  },
  {
    kind: "approval",
    agent: "Tech picker",
    title: "Wants to buy $250 of Apple",
    detail: "Over its largest trade, so it asks you"
  },
  {
    kind: "trade",
    agent: "Rebalancer",
    title: "Sold $73.61 of Nvidia",
    detail: "Back toward your target mix"
  },
  {
    kind: "blocked",
    agent: "Tech picker",
    title: "Your limit stopped a trade",
    detail: "$90 of Tesla would be 34% of your money, over its 30%"
  },
  { kind: "deposit", title: "Cash arrived", detail: "$500.00 in USDC on Base" },
  {
    kind: "trade",
    agent: "Stop-loss guard",
    title: "Sold $420.00 of Tesla",
    detail: "Tesla reached the floor you set"
  }
]

const TIMES = ["Just now", "4 min ago", "26 min ago", "1 hr ago", "3 hr ago"] as const
const EVERY_MS = 2800

/**
 * A feed of what agents do, a new line arriving at the top every few seconds while it is on screen. Under reduced
 * motion it holds still.
 */
export function ActivityFeed() {
  const root = useRef<HTMLDivElement>(null)
  const visible = useInView(root, { once: false, margin: "0px" })
  const reduced = useReducedMotion()
  // How many lines have arrived; the newest five show.
  const [arrived, setArrived] = useState<number>(TIMES.length)

  useEffect(() => {
    if (reduced || !visible) return
    const timer = window.setInterval(() => setArrived((count) => count + 1), EVERY_MS)
    return () => window.clearInterval(timer)
  }, [reduced, visible])

  const lines = TIMES.map((time, index) => {
    const position = arrived - 1 - index
    return { time, position, happening: HAPPENINGS[position % HAPPENINGS.length] ?? HAPPENINGS[0] }
  })

  return (
    <div ref={root} className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-e3">
      <div className="flex items-center justify-between gap-3 border-b border-g-100 px-4 py-3.5">
        <b className="text-body-sm font-semibold">Activity</b>
        <StatusPill tone="positive" dot="live">3 agents trading</StatusPill>
      </div>
      <ul aria-label="Example activity" className="grid">
        {lines.map(({ time, position, happening }, index) => (
          <ActivityItem
            key={position}
            kind={happening?.kind ?? "trade"}
            {...(happening?.agent === undefined ? {} : { agentId: happening.agent })}
            title={happening?.title}
            time={time}
            className={index === 0 && !reduced ? "animate-slide-up" : undefined}
          >
            {happening?.detail}
          </ActivityItem>
        ))}
      </ul>
    </div>
  )
}
