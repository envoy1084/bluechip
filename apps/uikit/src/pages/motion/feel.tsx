import { HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { Button } from "@bluechip/ui/components/button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Skeleton } from "@bluechip/ui/components/skeleton"
import { Switch } from "@bluechip/ui/components/switch"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { CopyIcon } from "@bluechip/ui/icons/copy-icon"
import { Icon } from "@bluechip/ui/icons/icon"
import { type Haptic, haptic, HAPTIC_EVENT } from "@bluechip/ui/lib/haptics"
import { MomentScope, useMoment } from "@bluechip/ui/motion/sweep"
import { useEffect, useId, useState } from "react"
import { FEEL } from "./entries.ts"
import { Card } from "./layout.tsx"

const APPROVAL_STEPS = ["Approve", "Approving…", "Approved", "Sending", "Filled"]

export function MorphCard() {
  const [step, setStep] = useState(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (step === 0 || step === APPROVAL_STEPS.length - 1) return
    const timer = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(timer)
  }, [step])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])
  const done = step === APPROVAL_STEPS.length - 1
  return (
    <Card
      entry={FEEL.morph}
      stage={
        <div className="grid justify-items-center gap-4">
          <Button
            size="lg"
            className="min-w-[200px]"
            haptic={done ? "tap" : "success"}
            onClick={() => setStep((s) => (s === 0 ? 1 : done ? 0 : s))}
          >
            <Icon name={done ? "check" : "face-id"} size={18} />
            <TextMorph>{APPROVAL_STEPS[step] ?? ""}</TextMorph>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCopied(true)}>
            <CopyIcon copied={copied} />
            <TextMorph>{copied ? "Copied" : "Copy address"}</TextMorph>
          </Button>
          <span className="text-caption text-g-500">Press either button</span>
        </div>
      }
    />
  )
}

interface DemoHolding {
  readonly id: string
  readonly symbol: string
  readonly name: string
  readonly shares: number
  readonly value: number
  readonly weight: number
  readonly change: number
}

const HOLDINGS: ReadonlyArray<DemoHolding> = [
  { id: "nvda", symbol: "NVDA", name: "Nvidia", shares: 12.4, value: 2249.47, weight: 18.2, change: 1.86 },
  { id: "aapl", symbol: "AAPL", name: "Apple", shares: 8.75, value: 1987.1, weight: 16.1, change: -0.42 }
]
// The shape of a holding before any have loaded: realistic lengths, never shown as text.
const SAMPLE_HOLDINGS: ReadonlyArray<DemoHolding> = [
  { id: "sample-1", symbol: "XXXX", name: "Company", shares: 10.5, value: 2000, weight: 18, change: 1.5 },
  { id: "sample-2", symbol: "XXXX", name: "Company", shares: 10.5, value: 2000, weight: 18, change: 1.5 }
]

export function SkeletonCard() {
  const [holdings, setHoldings] = useState<ReadonlyArray<DemoHolding> | null>(null)
  useEffect(() => {
    if (holdings !== null) return
    const timer = setTimeout(() => setHoldings(HOLDINGS), 1800)
    return () => clearTimeout(timer)
  }, [holdings])
  return (
    <Card
      entry={FEEL.skeleton}
      onReplay={() => setHoldings(null)}
      stage={
        <div className="w-[min(100%-40px,380px)] overflow-hidden rounded-md bg-white shadow-e2">
          <Skeleton data={holdings} sample={SAMPLE_HOLDINGS} label="Loading holdings">
            {(rows: ReadonlyArray<DemoHolding>) =>
              rows.map((row) => (
                <HoldingRow
                  key={row.id}
                  symbol={row.symbol}
                  name={row.name}
                  shares={row.shares}
                  value={row.value}
                  weight={row.weight}
                  cap={30}
                  change={row.change}
                />
              ))}
          </Skeleton>
        </div>
      }
    />
  )
}

const HAPTICS: ReadonlyArray<readonly [Haptic, string]> = [
  ["tap", "Tap"],
  ["select", "Select"],
  ["success", "Success"],
  ["nudge", "Nudge"],
  ["error", "Error"]
]

export function HapticsCard() {
  const [pulse, setPulse] = useState<{ readonly kind: Haptic; readonly at: number } | null>(null)
  const [on, setOn] = useState(true)
  const id = useId()
  useEffect(() => {
    const show = (event: Event) => setPulse({ kind: (event as CustomEvent<Haptic>).detail, at: performance.now() })
    window.addEventListener(HAPTIC_EVENT, show)
    return () => window.removeEventListener(HAPTIC_EVENT, show)
  }, [])
  return (
    <Card
      entry={FEEL.haptics}
      stage={
        <div className="grid justify-items-center gap-4 px-5">
          <span className="relative grid size-14 place-items-center rounded-full bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
            {pulse && (
              <i
                key={pulse.at}
                aria-hidden
                className="absolute inset-0 animate-[haptic-pulse_600ms_var(--ease-brand)_forwards] rounded-full shadow-[0_0_0_2px_var(--color-blue)] motion-reduce:hidden"
              />
            )}
            <Icon name="phone" size={22} />
          </span>
          <output className="min-h-5 text-label font-[550] text-g-700">
            <TextMorph>{pulse ? `Played “${pulse.kind}”` : "Nothing played yet"}</TextMorph>
          </output>
          <div className="flex flex-wrap justify-center gap-1.5">
            {HAPTICS.map(([kind, label]) => (
              <Button
                key={kind}
                variant="secondary"
                size="xs"
                onClick={() => haptic(kind)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-label text-g-600">
            <span className="flex items-center gap-2">
              <Switch id={`${id}-switch`} size="sm" checked={on} onCheckedChange={setOn} />
              <label htmlFor={`${id}-switch`}>Switch</label>
            </span>
            <span className="flex items-center gap-2">
              <Checkbox id={`${id}-checkbox`} defaultChecked />
              <label htmlFor={`${id}-checkbox`}>Checkbox</label>
            </span>
          </div>
          <style>{"@keyframes haptic-pulse { from { opacity: 1; scale: 1 } to { opacity: 0; scale: 1.7 } }"}</style>
        </div>
      }
    />
  )
}

const MOMENTS = [
  { title: "Limits locked", text: "Weekly buyer can trade within its new limits.", icon: "lock" },
  { title: "Bought $250.00 of Nvidia", text: "1.371 shares at $182.40. It's in your portfolio.", icon: "check" },
  { title: "Cash arrived", text: "$500.00 USDC on Base. It's ready to invest.", icon: "wallet" }
] as const

export function MomentCard() {
  const { ref: momentRef, play: playMoment } = useMoment()
  const [index, setIndex] = useState(0)
  const shown = MOMENTS[index] ?? MOMENTS[0]
  return (
    <Card
      entry={FEEL.moment}
      stage={
        <div className="grid w-[min(100%-40px,360px)] justify-items-center gap-4">
          <div className="relative grid w-full justify-items-center gap-1.5 rounded-lg bg-white px-5 py-6 text-center shadow-e2">
            <span className="mb-1 grid size-11 place-items-center rounded-[14px] bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]">
              <Icon name={shown.icon} size={20} />
            </span>
            <b className="text-body font-semibold">
              <TextMorph>{shown.title}</TextMorph>
            </b>
            <span className="text-label text-g-600">{shown.text}</span>
            <MomentScope ref={momentRef} />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {MOMENTS.map((m, i) => (
              <Button
                key={m.title}
                variant="secondary"
                size="xs"
                haptic="success"
                onClick={() => playMoment(() => setIndex(i))}
              >
                {["Lock limits", "Fill trade", "Cash in"][i]}
              </Button>
            ))}
          </div>
        </div>
      }
    />
  )
}
