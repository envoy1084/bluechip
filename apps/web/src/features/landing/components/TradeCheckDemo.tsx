import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { OutcomeMark, type OutcomeTone } from "@bluechip/ui/bluechip/outcome"
import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import type { AgentLimits } from "@bluechip/ui/lib/agent-limits"
import { cn } from "@bluechip/ui/lib/cn"
import { MomentScope, useMoment } from "@bluechip/ui/motion/sweep"
import { useReducedMotion } from "@bluechip/ui/motion/use-reduced-motion"
import { useEffect, useRef, useState } from "react"
import { FilterTabs } from "../../../components/FilterTabs.tsx"
import { useInView } from "../hooks/useInView.ts"

const LIMITS: AgentLimits = {
  stocks: ["NVDA", "AAPL", "TSLA", "MSFT"],
  mode: "buy-and-sell",
  dailySpend: 300,
  maxPerTrade: 100,
  maxInOneStock: 30,
  cashReserve: 10,
  approveAbove: 100
}

type Verdict = "pass" | "ask" | "fail"

type ScenarioId = "sent" | "approve" | "blocked"

interface Scenario {
  readonly id: ScenarioId
  readonly tab: string
  readonly symbol: string
  readonly trade: string
  readonly checks: ReadonlyArray<readonly [string, Verdict]>
  readonly tone: OutcomeTone
  readonly result: string
  readonly detail: string
}

const SCENARIOS: readonly [Scenario, Scenario, Scenario] = [
  {
    id: "sent",
    tab: "Inside its limits",
    symbol: "NVDA",
    trade: "Buy $80 of Nvidia",
    checks: [
      ["Nvidia is one of its stocks", "pass"],
      ["$80 is within its $100 largest trade", "pass"],
      ["Nvidia stays under 30% of your money", "pass"],
      ["It fills within 1% of Chainlink's price", "pass"]
    ],
    tone: "success",
    result: "Sent by the agent",
    detail: "bluechip tried it as the agent first, and Base checked it again on the way in."
  },
  {
    id: "approve",
    tab: "Over its largest trade",
    symbol: "AAPL",
    trade: "Buy $250 of Apple",
    checks: [
      ["Apple is one of its stocks", "pass"],
      ["$250 is over its $100 largest trade", "ask"]
    ],
    tone: "pending",
    result: "Waiting for your Face ID",
    detail: "The agent can't send it. You approve or decline it, and it expires after 6 hours."
  },
  {
    id: "blocked",
    tab: "Against its limits",
    symbol: "TSLA",
    trade: "Buy $90 of Tesla",
    checks: [
      ["Tesla is one of its stocks", "pass"],
      ["$90 is within its $100 largest trade", "pass"],
      ["Tesla would be 34% of your money, over its 30%", "fail"]
    ],
    tone: "failure",
    result: "Blocked, nothing was sent",
    detail: "It costs nothing, and the agent's activity says which limit refused it."
  }
]

const CHECK_MS = 620
const HOLD_MS = 3600

const VERDICT_ICON = { pass: "check", ask: "face-id", fail: "close" } as const

const VERDICT_TILE = {
  pass: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
  ask: "bg-info-wash text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
  fail: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]"
} as const

const lockDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

/**
 * The limits at work: an agent's permission card locks with Face ID as it comes into view, then three of its trades
 * run through the checks one by one (sent, waiting for you, blocked), on a loop while it is on screen. Picking a
 * case stops the loop there. Under reduced motion every check shows its answer at once.
 */
export function TradeCheckDemo() {
  const root = useRef<HTMLDivElement>(null)
  const visible = useInView(root, { once: false, margin: "0px" })
  const reduced = useReducedMotion()
  const { ref: momentRef, play: playMoment } = useMoment()

  const [lockedUntil, setLockedUntil] = useState<string | undefined>(undefined)
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [resolved, setResolved] = useState(0)
  const [picked, setPicked] = useState(false)

  const scenario = SCENARIOS[scenarioIndex] ?? SCENARIOS[0]
  const done = reduced || resolved > scenario.checks.length
  // The $80 Nvidia buy counts toward today's spend once it is sent, until the loop comes round to it again.
  const spent = scenario.id === "sent" && !done ? 120 : 200

  // Locked the first time it is seen: the sweep passes and the card turns from a draft into locked limits.
  useEffect(() => {
    if (!visible || lockedUntil !== undefined) return
    const timer = window.setTimeout(() => {
      playMoment(() => setLockedUntil(lockDay.format(Date.now() + 90 * 86_400_000)))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [visible, lockedUntil, playMoment])

  // One check at a time, then the outcome, then (unless someone picked a case) the next case.
  useEffect(() => {
    if (reduced || !visible || lockedUntil === undefined) return
    if (resolved <= scenario.checks.length) {
      const timer = window.setTimeout(() => setResolved((count) => count + 1), CHECK_MS)
      return () => window.clearTimeout(timer)
    }
    if (picked) return
    const timer = window.setTimeout(() => {
      setScenarioIndex((index) => (index + 1) % SCENARIOS.length)
      setResolved(0)
    }, HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [reduced, visible, lockedUntil, resolved, scenario, picked])

  const pick = (id: ScenarioId) => {
    setPicked(true)
    setScenarioIndex(SCENARIOS.findIndex((candidate) => candidate.id === id))
    setResolved(0)
  }

  return (
    <div ref={root} className="grid gap-4">
      <div className="relative">
        <div className="flex items-center gap-3 rounded-t-lg bg-white px-[18px] pt-4 pb-1">
          <AgentAvatar agentId="Tech picker" size="lg" status="active" />
          <span className="grid">
            <b className="text-body font-semibold">Tech picker</b>
            <span className="text-label-sm text-g-500">An agent with its limits locked onchain</span>
          </span>
        </div>
        <PermissionCard
          limits={LIMITS}
          spentToday={spent}
          {...(lockedUntil === undefined ? {} : { lockedUntil })}
          className="rounded-t-none shadow-e3"
        />
        <MomentScope ref={momentRef} />
      </div>

      <div className="grid gap-3.5 rounded-lg bg-white p-[18px] shadow-e3">
        <FilterTabs
          label="Example trades"
          value={scenario.id}
          options={SCENARIOS.map((candidate) => ({ value: candidate.id, label: candidate.tab }))}
          onChange={pick}
        />

        <div className="flex items-center gap-2.5">
          <TickerChip symbol={scenario.symbol} />
          <b className="text-body font-semibold">{scenario.trade}</b>
          <span className="ml-auto text-caption text-g-500">Tech picker asks</span>
        </div>

        <ol className="grid gap-2" aria-label="What bluechip and Base check">
          {scenario.checks.map(([text, verdict], index) => {
            const shown = done || index < resolved
            const checking = !done && index === resolved
            return (
              <li
                key={`${scenario.id}-${text}`}
                data-shown={shown || checking || undefined}
                className="flex translate-y-1 items-center gap-2.5 text-body-sm opacity-0 transition-[opacity,translate] duration-slow ease-brand data-shown:translate-y-0 data-shown:opacity-100 motion-reduce:transition-none"
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-base",
                    shown ? VERDICT_TILE[verdict] : "bg-g-50 text-g-400 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
                  )}
                >
                  {shown ?
                    (
                      <Icon
                        name={VERDICT_ICON[verdict]}
                        size={13}
                        className="animate-pop-in motion-reduce:animate-none"
                      />
                    ) :
                    <Spinner size={12} />}
                </span>
                <span className={cn(shown ? "text-g-800" : "text-g-500")}>{text}</span>
              </li>
            )
          })}
        </ol>

        <div
          data-shown={done || undefined}
          aria-live="polite"
          className="flex items-center gap-3 rounded-md bg-g-50 p-3 opacity-0 transition-opacity duration-slow ease-brand data-shown:opacity-100 motion-reduce:transition-none"
        >
          {done ? <OutcomeMark key={scenario.id} tone={scenario.tone} size={36} /> : <span className="size-9" />}
          <span className="grid">
            <b className="text-body-sm font-semibold">{done ? scenario.result : "Checking"}</b>
            <span className="text-label-sm text-g-600">{done ? scenario.detail : ""}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
