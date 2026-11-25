import { HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { Button } from "@bluechip/ui/components/button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Skeleton } from "@bluechip/ui/components/skeleton"
import { Switch } from "@bluechip/ui/components/switch"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatPercent } from "@bluechip/ui/lib/format"
import { type Haptic, haptic, HAPTIC_EVENT } from "@bluechip/ui/lib/haptics"
import { ButterflyAssemble, type ButterflyAssembleHandle } from "@bluechip/ui/motion/butterfly-assemble"
import { Confetti } from "@bluechip/ui/motion/confetti"
import { DotGrid } from "@bluechip/ui/motion/dot-grid"
import { Halftone, type HalftoneSceneName } from "@bluechip/ui/motion/halftone"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { Scramble } from "@bluechip/ui/motion/scramble"
import { Seal, type SealHandle } from "@bluechip/ui/motion/seal"
import { MomentScope, useMoment } from "@bluechip/ui/motion/sweep"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react"

export const Route = createFileRoute("/motion")({ component: KitMotion })

interface Entry {
  readonly n: number
  readonly name: string
  readonly used: string
  readonly duration: string
  readonly easing: string
  readonly reduced: string
}

interface SceneEntry extends Entry {
  readonly scene: HalftoneSceneName
  readonly cell: number
  readonly replay?: boolean
}

const SCENES: ReadonlyArray<SceneEntry> = [
  {
    n: 1,
    name: "Rising chip",
    scene: "logo",
    cell: 9,
    used: "Landing hero, home empty state",
    duration: "4.4 s loop, glint every 5.3 s",
    easing: "Sine",
    reduced: "Still chip, tilted, glint resting on the line"
  },
  {
    n: 2,
    name: "Chip spin",
    scene: "coin",
    cell: 8,
    used: "Trade in progress, waiting for a fill",
    duration: "5 s spin, 10.5 s orbit",
    easing: "Linear (constant spin)",
    reduced: "Still chip with three chips frozen on the orbit"
  },
  {
    n: 3,
    name: "Butterflies",
    scene: "butterflies",
    cell: 6,
    used: "Creating an agent, agents empty state",
    duration: "Endless, 3 beats a second",
    easing: "Fast downstroke, slow recovery, glides",
    reduced: "Butterflies at rest, wings open"
  },
  {
    n: 4,
    name: "Market settling",
    scene: "market",
    cell: 8,
    used: "Rebalancing, portfolio loading",
    duration: "6 s per rebalance, 60 ms stagger",
    easing: "Damped spring",
    reduced: "Bars at their settled heights"
  },
  {
    n: 5,
    name: "Garden bloom",
    scene: "garden",
    cell: 7,
    used: "“Limits locked” after Face ID",
    duration: "3.6 s bloom, then a slow sway",
    easing: "Ease out stems, spring petals",
    reduced: "The garden in full bloom",
    replay: true
  },
  {
    n: 6,
    name: "Warp",
    scene: "warp",
    cell: 8,
    used: "Sending a trade or a withdrawal",
    duration: "Endless, surge every 5 s",
    easing: "Perspective (1/z)",
    reduced: "Streaks frozen mid-flight"
  },
  {
    n: 7,
    name: "Clouds",
    scene: "clouds",
    cell: 8,
    used: "Market closed, weekends, holidays",
    duration: "35 – 80 s drift",
    easing: "Linear",
    reduced: "Still sky with the moon"
  },
  {
    n: 11,
    name: "Blocked",
    scene: "blocked",
    cell: 8,
    used: "“Your limit stopped this trade.”",
    duration: "4.4 s: 1.15 s roll, hit, 3 s settle",
    easing: "Ease in, then damped bounce",
    reduced: "The moment of impact, flash on the fence",
    replay: true
  }
]

const PIXEL: Readonly<Record<"grid" | "seal" | "assemble" | "confetti", Entry>> = {
  grid: {
    n: 8,
    name: "Reactive grid",
    used: "Onboarding and page backgrounds",
    duration: "Endless; ripple 1.4 s",
    easing: "Spring (k .08, damping .74)",
    reduced: "A still noise field, no cursor response"
  },
  seal: {
    n: 9,
    name: "Pixel seal",
    used: "Face ID approval sheet",
    duration: "2.2 s: land 1 s, check .4 s, shine",
    easing: "Ease out back, stagger outside in",
    reduced: "The finished seal with its check"
  },
  assemble: {
    n: 10,
    name: "Avatar reveal",
    used: "A new agent's butterfly appears",
    duration: "2.4 s: land 1.1 s, two wing beats",
    easing: "Ease out back, stagger from the body",
    reduced: "The finished butterfly"
  },
  confetti: {
    n: 12,
    name: "Chip confetti",
    used: "First deposit arrived, first trade filled. Once per account.",
    duration: "2.3 s",
    easing: "Drag and gravity",
    reduced: "None. The message carries it."
  }
}

const INTERFACE: Readonly<Record<"roll" | "scramble", Entry>> = {
  roll: {
    n: 13,
    name: "Number roll and flash",
    used: "Balances, prices, agent spend counters (NumberFlow)",
    duration: "640 ms roll, 900 ms flash",
    easing: "--ease-brand",
    reduced: "Digits swap instantly; color still shows the direction"
  },
  scramble: {
    n: 14,
    name: "Text scramble",
    used: "Landing headings, empty states. One heading per screen.",
    duration: "800 ms",
    easing: "Linear, left to right",
    reduced: "Text appears at once"
  }
}

const FEEL: Readonly<Record<"morph" | "skeleton" | "haptics" | "moment", Entry>> = {
  morph: {
    n: 15,
    name: "Text morph",
    used: "Labels that change in place: Approve → Filled, Copy → Copied (torph)",
    duration: "320 ms",
    easing: "--ease-brand",
    reduced: "The new label at once"
  },
  skeleton: {
    n: 16,
    name: "Measured skeleton",
    used: "Every loading state: drawn from the real content, so nothing moves when it lands (skullet)",
    duration: "4 s shimmer; reveal in sequence",
    easing: "Cosine sweep",
    reduced: "Still bars, content at once"
  },
  haptics: {
    n: 17,
    name: "Haptics",
    used: "Face ID done, trade filled, limit said no, settings flipped (web-haptics)",
    duration: "15 – 160 ms patterns",
    easing: "—",
    reduced: "Unchanged. Desktop has none; the ring here shows each one"
  },
  moment: {
    n: 18,
    name: "Moment sweep",
    used: "Limits locked, trade filled, cash arrived. Nothing else (glimm)",
    duration: "1.6 s band, gone by mid-card",
    easing: "Smooth, curved band",
    reduced: "No band; the change shows at once. Same without WebGL"
  }
}

const AGENTS = ["Weekly buyer", "Rebalancer", "Stop-loss guard", "Stock picker"]
const LINES = ["Your limit stopped this trade.", "Let your agents trade for you.", "Limits locked with Face ID."]
const STEPS = [1.8, -0.9, 2.6, -1.4, 0.7]
const usd = { style: "currency", currency: "USD" } as const

const REDUCED: ReadonlyArray<readonly [string, string]> = [
  ["Halftone scenes (1–7, 11)", "One composed still frame, chosen per scene. No pointer response."],
  ["Seal, avatar reveal (9, 10)", "The finished picture, drawn at once."],
  ["Reactive grid (8)", "A still noise field. No springs, no ripples."],
  ["Confetti (12)", "Not drawn. The toast or heading says it."],
  ["Number roll, flash (13)", "Digits change in place; the up or down color stays on the text."],
  ["Text scramble (14)", "The text is there from the start."],
  ["Text morph (15)", "The new label replaces the old one at once."],
  ["Measured skeleton (16)", "Bars hold still; content replaces them without a fade."],
  ["Moment sweep (18)", "No band. The change is made at once, as without WebGL."]
]

/** True once the element has scrolled into view. */
function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setSeen(true)
      observer.disconnect()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return seen
}

function KitMotion() {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-4 py-12 md:px-10">
      <section className="grid gap-8">
        <div className="grid gap-3">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Motion</span>
          <h1 className="text-display-3 font-semibold">Quiet motion, one moment at a time.</h1>
          <p className="max-w-[64ch] text-body-lg text-g-600">
            bluechip moves like printed matter coming alive: line-halftone scenes, pixels that land with weight, numbers
            that roll. Calm by default, so the moments that matter, a limit holding or Face ID approving, are the ones
            you notice.
          </p>
        </div>
        <div className="relative h-[380px] overflow-hidden rounded-2xl bg-white shadow-e2">
          <Halftone scene="logo" cell={10} className="absolute inset-0 size-full" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0)_34%,rgba(255,255,255,0)_66%,#fff_100%)]" />
          <div className="absolute bottom-4 left-4 grid max-w-[300px] gap-1.5 rounded-md bg-white/90 px-3.5 py-3 shadow-e1 backdrop-blur-sm">
            <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">
              Rising chip · line halftone
            </span>
            <p className="text-label-sm text-g-600">
              Every cell is a vertical capsule. Four thicknesses, four inks, drawn from a greyscale scene. Move your
              pointer across it.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Library</span>
          <h2 className="text-title-1 font-semibold">Fourteen animations.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            Halftone scenes for ambient states, pixel moments for events, interface motion for data. Scenes pause when
            they leave the screen and render one still frame under reduced motion.
          </p>
        </div>
        <Group title="Halftone scenes">
          {SCENES.map((entry) => <SceneCard key={entry.n} entry={entry} />)}
        </Group>
        <Group title="Pixel moments">
          <GridCard />
          <SealCard />
          <AssembleCard />
          <ConfettiCard />
        </Group>
        <Group title="Interface motion">
          <RollCard />
          <ScrambleCard />
        </Group>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Feel</span>
          <h2 className="text-title-1 font-semibold">Small things that say it worked.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            Numbers roll, labels morph, loading takes the shape of what's coming, phones tap back, and three moments get
            a sweep. All from maintained libraries, tuned to the brand curves.
          </p>
        </div>
        <Group title="Feedback">
          <MorphCard />
          <SkeletonCard />
          <HapticsCard />
          <MomentCard />
        </Group>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-2">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Reduced motion</span>
          <h2 className="text-title-1 font-semibold">Still, never broken.</h2>
          <p className="max-w-[64ch] text-body text-g-600">
            When someone asks their device for reduced motion, every animation keeps its meaning without the movement.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg bg-white shadow-e2">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-g-50 text-left text-caption font-semibold text-g-500">
                <th className="border-b border-g-100 px-[18px] py-3">Animation</th>
                <th className="border-b border-g-100 px-[18px] py-3">With reduced motion</th>
              </tr>
            </thead>
            <tbody>
              {REDUCED.map(([name, what]) => (
                <tr key={name} className="border-b border-g-100 last:border-0">
                  <td className="px-[18px] py-3 whitespace-nowrap text-ink">{name}</td>
                  <td className="px-[18px] py-3 text-g-600">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-3.5">
      <h3 className="text-body font-semibold text-g-700">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-4">{children}</div>
    </div>
  )
}

function Card(
  { entry, stage, onReplay }: { readonly entry: Entry; readonly stage: ReactNode; readonly onReplay?: () => void }
) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-white shadow-e2">
      <div className="relative grid h-[280px] place-items-center overflow-hidden border-b border-g-100 bg-white">
        {stage}
        {onReplay && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 z-[6]"
            aria-label={`Replay ${entry.name}`}
            onClick={onReplay}
          >
            <Icon name="refresh" size={14} />Replay
          </Button>
        )}
      </div>
      <div className="grid gap-2 px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-caption font-semibold text-blue tabular-nums">{String(entry.n).padStart(2, "0")}</span>
          <h4 className="text-body-lg font-semibold tracking-[-0.02em]">{entry.name}</h4>
        </div>
        <p className="text-body-sm text-g-600">{entry.used}</p>
        <dl className="mt-1.5 grid border-t border-g-100">
          {([["Duration", entry.duration], ["Easing", entry.easing], ["Reduced motion", entry.reduced]] as const).map((
            [term, value]
          ) => (
            <div
              key={term}
              className="grid grid-cols-[116px_1fr] gap-3 border-b border-g-100 py-[7px] text-label last:border-0 last:pb-0"
            >
              <dt className="font-medium text-g-500">{term}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}

function SceneCard({ entry }: { readonly entry: SceneEntry }) {
  const [run, setRun] = useState(0)
  return (
    <Card
      entry={entry}
      stage={<Halftone key={run} scene={entry.scene} cell={entry.cell} className="absolute inset-0 size-full" />}
      {...(entry.replay ? { onReplay: () => setRun((r) => r + 1) } : {})}
    />
  )
}

function GridCard() {
  return (
    <Card
      entry={PIXEL.grid}
      stage={
        <>
          <DotGrid cell={14} gap={4} />
          <p className="pointer-events-none absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-0.5 text-caption text-g-500 shadow-hair">
            <Icon name="hand" size={14} />Move or tap
          </p>
        </>
      }
    />
  )
}

function SealCard() {
  const seal = useRef<SealHandle>(null)
  return (
    <Card
      entry={PIXEL.seal}
      stage={<Seal ref={seal} className="absolute inset-0 size-full" />}
      onReplay={() => seal.current?.play()}
    />
  )
}

function AssembleCard() {
  const fly = useRef<ButterflyAssembleHandle>(null)
  const [agent, setAgent] = useState(AGENTS[0] ?? "")
  return (
    <Card
      entry={PIXEL.assemble}
      onReplay={() => fly.current?.play()}
      stage={
        <>
          <ButterflyAssemble ref={fly} agentId={agent} className="absolute inset-0 size-full" />
          <div className="absolute inset-x-0 bottom-3 z-[2] flex flex-wrap justify-center gap-1.5 px-3">
            {AGENTS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={name === agent}
                onClick={() => setAgent(name)}
                className="cursor-pointer rounded-full bg-g-50 px-2.5 py-1 text-caption font-[550] text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)] transition-colors duration-fast ease-brand hover:bg-g-100 hover:text-ink aria-pressed:bg-white aria-pressed:text-ink aria-pressed:shadow-e1"
              >
                {name}
              </button>
            ))}
          </div>
        </>
      }
    />
  )
}

function ConfettiCard() {
  const stage = useRef<HTMLDivElement>(null)
  const seen = useSeen(stage)
  const [burst, setBurst] = useState(0)
  return (
    <Card
      entry={PIXEL.confetti}
      onReplay={() => setBurst((b) => b + 1)}
      stage={
        <div ref={stage} className="absolute inset-0 grid place-items-center">
          <div className="relative z-[1] mx-5 flex max-w-[320px] items-start gap-3 rounded-lg bg-white px-[18px] py-4 shadow-e2">
            <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]">
              <Icon name="check-circle" size={18} />
            </span>
            <div>
              <strong className="mb-0.5 block text-body-sm font-semibold">Your first deposit arrived</strong>
              <p className="text-label text-g-600">
                <span className="tabular-nums">$500.00</span> cash (USDC) is ready to use. Example
              </p>
            </div>
          </div>
          {(seen || burst > 0) && <Confetti key={burst} y={0.55} />}
        </div>
      }
    />
  )
}

interface Quote {
  readonly value: number
  readonly price: number
  readonly step: number
}

// A gentle example tick: the price and the portfolio move together.
const nextQuote = (q: Quote): Quote => {
  const d = STEPS[q.step % STEPS.length] ?? 0
  return {
    value: Math.round((q.value + d * 14.2) * 100) / 100,
    price: Math.round((q.price + d) * 100) / 100,
    step: q.step + 1
  }
}

function RollCard() {
  const [quote, setQuote] = useState<Quote>({ value: 12480.32, price: 182.4, step: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const seen = useSeen(stage)
  useEffect(() => {
    if (!seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setInterval(() => setQuote(nextQuote), 2600)
    return () => clearInterval(timer)
  }, [seen])
  const change = ((quote.price - 180.17) / 180.17) * 100
  return (
    <Card
      entry={INTERFACE.roll}
      onReplay={() => setQuote(nextQuote)}
      stage={
        <div ref={stage} className="grid justify-items-center gap-2 text-center">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-g-500 uppercase">
            Portfolio value · Example
          </span>
          <NumberRoll
            value={quote.value}
            format={usd}
            className="text-[clamp(34px,5vw,46px)] leading-[1.2] font-semibold tracking-[-0.04em]"
          />
          <div className="inline-flex items-center gap-2.5 rounded-[12px] bg-white py-1.5 pr-2.5 pl-1.5 text-body font-[550] shadow-e1">
            <span className="inline-flex items-center rounded-[7px] bg-[linear-gradient(180deg,#7ad61a,#66c800)] px-[9px] pt-[5px] pb-1 font-pixel text-label font-extrabold tracking-[.05em] text-[#0c2a00]">
              NVDA
            </span>
            <NumberRoll value={quote.price} format={(v) => formatMoney(v)} flash className="px-1" />
            <span className={`text-label tabular-nums ${change >= 0 ? "text-gain" : "text-loss"}`}>
              {formatPercent(change)}
            </span>
          </div>
        </div>
      }
    />
  )
}

function ScrambleCard() {
  const [line, setLine] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const seen = useSeen(stage)
  return (
    <Card
      entry={INTERFACE.scramble}
      onReplay={() => setLine((l) => l + 1)}
      stage={
        <div ref={stage} className="grid justify-items-center gap-3 px-6 text-center">
          <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Signature moment</span>
          <h3 className="flex min-h-[2.3em] items-center text-[clamp(24px,3vw,32px)] leading-[1.15] font-semibold tracking-[-0.035em]">
            {seen ?
              <Scramble key={line} text={LINES[line % LINES.length] ?? ""} /> :
              LINES[0]}
          </h3>
        </div>
      }
    />
  )
}

const APPROVAL_STEPS = ["Approve", "Approving…", "Approved", "Sending", "Filled"]

function MorphCard() {
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
            <Icon name={copied ? "check" : "copy"} size={14} />
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

function SkeletonCard() {
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

function HapticsCard() {
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

function MomentCard() {
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
