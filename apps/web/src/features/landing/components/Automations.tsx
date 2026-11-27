import { TRIGGERS } from "@bluechip/domain/automations/Automation"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { StatusPill, type StatusTone } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { useReducedMotion } from "@bluechip/ui/motion/use-reduced-motion"
import { Fragment, useEffect, useRef, useState } from "react"
import { useInView } from "../hooks/useInView.ts"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

type TriggerType = (typeof TRIGGERS)[number]["type"]

type Part = "trigger" | "condition" | "action"

/** A phrase of the sentence: its words, led by the chip of the stock it starts with (if any). */
interface Phrase {
  readonly text: string
  readonly symbol?: StockSymbol
}

interface Example {
  readonly type: TriggerType
  readonly art: IllustrationName
  readonly trigger: Phrase
  readonly condition: Phrase
  readonly action: Phrase
  readonly outcome: readonly [StatusTone, string]
}

const EXAMPLES: readonly [Example, ...ReadonlyArray<Example>] = [
  {
    type: "priceMove",
    art: "price-move",
    trigger: { text: "Nvidia falls 5% from its close", symbol: "NVDA" },
    condition: { text: "the market is open" },
    action: { text: "buy $100 of Nvidia" },
    outcome: ["positive", "Bought $100.00 of Nvidia"]
  },
  {
    type: "schedule",
    art: "calendar",
    trigger: { text: "it's Monday at 9:30" },
    condition: { text: "prices are fresh" },
    action: { text: "buy $50 of Microsoft" },
    outcome: ["positive", "Bought $50.00 of Microsoft"]
  },
  {
    type: "news",
    art: "newspaper",
    trigger: { text: "Tesla is in the news", symbol: "TSLA" },
    condition: { text: "a model judges it materially negative" },
    action: { text: "ask me before selling Tesla" },
    outcome: ["pending", "Waiting for your Face ID"]
  },
  {
    type: "priceCross",
    art: "price-level",
    trigger: { text: "Apple goes above $250", symbol: "AAPL" },
    condition: { text: "I still hold Apple" },
    action: { text: "sell a quarter of my Apple" },
    outcome: ["positive", "Sold a quarter of your Apple"]
  },
  {
    type: "drift",
    art: "scales",
    trigger: { text: "my mix drifts 5% from its target" },
    condition: { text: "the market is open" },
    action: { text: "rebalance back to it" },
    outcome: ["positive", "Rebalanced in one transaction"]
  },
  {
    type: "portfolio",
    art: "pie",
    trigger: { text: "cash falls under 10% of my money" },
    condition: { text: "it's a weekday" },
    action: { text: "tell me" },
    outcome: ["info", "Sent you a message"]
  }
]

const PARTS: ReadonlyArray<readonly [Part, string]> = [["trigger", "When"], ["condition", "if"], ["action", "then"]]

// Each part keeps its color everywhere: the word, its mark and its label.
// The mark is a gradient image, so it can sweep in by its size and wrap with the words across lines.
const TONE: Readonly<Record<Part, { readonly word: string; readonly mark: string }>> = {
  trigger: { word: "text-blue", mark: "bg-[linear-gradient(var(--color-blue-100),var(--color-blue-100))]" },
  condition: {
    word: "text-[#9a6a00]",
    mark: "bg-[linear-gradient(var(--color-yellow-soft),var(--color-yellow-soft))]"
  },
  action: { word: "text-gain", mark: "bg-[linear-gradient(var(--color-gain-line),var(--color-gain-line))]" }
}

const STEP_MS = 520
const HOLD_MS = 5200

const titleOf = (type: TriggerType) => TRIGGERS.find((trigger) => trigger.type === type)?.title ?? type

/**
 * Automations as the sentence the editor writes: When, if, then, each in its own color, marked one after another as
 * if written now. It moves through one example per trigger while on screen; picking a trigger holds it there. Under
 * reduced motion the sentence is simply there.
 */
export function Automations() {
  const root = useRef<HTMLDivElement>(null)
  const visible = useInView(root, { once: false, margin: "0px" })
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const example = EXAMPLES[index] ?? EXAMPLES[0]

  useEffect(() => {
    if (reduced || held || !visible) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % EXAMPLES.length), HOLD_MS)
    return () => window.clearInterval(timer)
  }, [reduced, held, visible])

  return (
    <section
      id="automations"
      aria-labelledby="landing-automations"
      className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Automations" title={<span id="landing-automations">Say when. It does the rest.</span>} />

        <Reveal>
          <div
            ref={root}
            className="grid overflow-hidden rounded-[28px] bg-white shadow-e3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
          >
            <div className="relative grid min-h-[240px] place-items-center bg-[radial-gradient(circle_at_50%_50%,var(--color-blue-50),var(--color-g-50)_75%)] lg:min-h-[420px]">
              <Illustration
                key={example.art}
                name={example.art}
                variant="halftone"
                size={240}
                animate
                aria-hidden
                className="animate-fade-in motion-reduce:animate-none"
              />
            </div>

            <div className="grid content-between gap-8 p-6 sm:p-10">
              <p
                key={index}
                aria-live="polite"
                className="text-[clamp(26px,3.6vw,44px)] leading-[1.28] font-semibold tracking-[-0.035em] text-pretty"
              >
                {PARTS.map(([part, word], order) => {
                  const phrase = example[part]
                  const delay = order * STEP_MS
                  return (
                    <Fragment key={part}>
                      <span
                        className={cn(
                          TONE[part].word,
                          "animate-[landing-word_500ms_var(--ease-brand)_both] motion-reduce:animate-none"
                        )}
                        style={{ animationDelay: `${delay}ms` }}
                      >
                        {word}
                      </span>{" "}
                      <span
                        className={cn(
                          "rounded-[.18em] bg-no-repeat px-[.08em] text-ink [background-size:100%_100%] [box-decoration-break:clone]",
                          "animate-[landing-mark_800ms_var(--ease-brand)_both,landing-word_400ms_ease-out_both] motion-reduce:animate-none",
                          TONE[part].mark
                        )}
                        style={{ animationDelay: `${delay + 120}ms` }}
                      >
                        {phrase.symbol === undefined ?
                          null :
                          <TickerChip symbol={phrase.symbol} size="lg" className="mr-[.25em] align-[.16em]" />}
                        {phrase.text}
                      </span>
                      {part === "action" ? "." : ", "}
                    </Fragment>
                  )
                })}
              </p>

              <div className="grid gap-5">
                <span
                  key={`outcome-${index}`}
                  className="animate-[landing-word_500ms_var(--ease-brand)_both] [animation-delay:1500ms] motion-reduce:animate-none"
                >
                  <StatusPill tone={example.outcome[0]} dot={example.outcome[0] === "pending" ? "live" : true}>
                    {example.outcome[1]}
                  </StatusPill>
                </span>
                <fieldset className="flex flex-wrap gap-1.5">
                  <legend className="sr-only">Triggers</legend>
                  {EXAMPLES.map((candidate, at) => (
                    <button
                      key={candidate.type}
                      type="button"
                      aria-pressed={at === index}
                      onClick={() => {
                        setHeld(true)
                        setIndex(at)
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-g-50 py-1 pr-3 pl-1.5 text-label-sm font-medium text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)] transition-colors duration-base hover:bg-white aria-pressed:bg-blue-50 aria-pressed:text-blue aria-pressed:shadow-[inset_0_0_0_1px_var(--color-info-line)]"
                    >
                      <Illustration name={candidate.art} size={20} aria-hidden />
                      {titleOf(candidate.type)}
                    </button>
                  ))}
                </fieldset>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
