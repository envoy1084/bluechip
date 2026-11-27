import { Icon } from "@bluechip/ui/icons/icon"
import { ButterflyAssemble, type ButterflyAssembleHandle } from "@bluechip/ui/motion/butterfly-assemble"
import { Confetti } from "@bluechip/ui/motion/confetti"
import { DotGrid } from "@bluechip/ui/motion/dot-grid"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Seal, type SealHandle } from "@bluechip/ui/motion/seal"
import { WarpField } from "@bluechip/ui/motion/warp-field"
import { useRef, useState } from "react"
import { AGENTS, PIXEL, type SceneEntry } from "./entries.ts"
import { Card, useSeen } from "./layout.tsx"

export function SceneCard({ entry }: { readonly entry: SceneEntry }) {
  const [run, setRun] = useState(0)
  return (
    <Card
      entry={entry}
      stage={<Halftone key={run} scene={entry.scene} cell={entry.cell} className="absolute inset-0 size-full" />}
      {...(entry.replay ? { onReplay: () => setRun((r) => r + 1) } : {})}
    />
  )
}

export function GridCard() {
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

const WARP_SYMBOLS = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN"]

export function WarpCard() {
  return (
    <Card
      entry={PIXEL.warp}
      stage={
        <>
          <WarpField symbols={WARP_SYMBOLS} />
          <p className="pointer-events-none absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-0.5 text-caption text-g-500 shadow-hair">
            <Icon name="hand" size={14} />Move or press
          </p>
        </>
      }
    />
  )
}

export function SealCard() {
  const seal = useRef<SealHandle>(null)
  return (
    <Card
      entry={PIXEL.seal}
      stage={<Seal ref={seal} className="absolute inset-0 size-full" />}
      onReplay={() => seal.current?.play()}
    />
  )
}

export function AssembleCard() {
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

export function ConfettiCard() {
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
                <span className="tabular-nums">$500.00</span> cash (USDC) is ready to use.
              </p>
            </div>
          </div>
          {(seen || burst > 0) && <Confetti key={burst} y={0.55} />}
        </div>
      }
    />
  )
}
