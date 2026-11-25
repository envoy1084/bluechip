import { cn } from "@bluechip/ui/lib/cn"
import { type ReactNode, useId } from "react"

/* ---------- Page scaffolding (mirrors the brand kit's section layout) ---------- */

export const TICKER_TONE: Readonly<Record<string, string>> = {
  NVDA: "bg-[linear-gradient(180deg,#7ad61a,#66c800)] text-[#0c2a00]",
  AAPL: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white",
  MSFT: "bg-[linear-gradient(180deg,#62a2ff,#3c8aff)] text-[#00163d]",
  TSLA: "bg-[linear-gradient(180deg,#ffbdd9,#fea8cd)] text-[#4a0f2a]",
  GOOGL: "bg-[linear-gradient(180deg,#ffdc5c,#ffd12f)] text-[#3a2c00]",
  AMZN: "bg-[linear-gradient(180deg,#cbb995,#b8a581)] text-[#2a2111]",
  MSTR: "bg-[linear-gradient(180deg,#dcaefe,#cd99fd)] text-[#2c0a4d]",
  SPCX: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white"
}

export function Ticker({ symbol }: { readonly symbol: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] px-1.5 pt-[3px] pb-0.5 font-pixel text-caption-sm font-extrabold tracking-[.05em] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
        TICKER_TONE[symbol] ?? "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white"
      )}
    >
      {symbol}
    </span>
  )
}

export function Group(
  { n, title, children }: { readonly n: string; readonly title: string; readonly children: ReactNode }
) {
  return (
    <div className="pt-10">
      <div className="flex items-baseline gap-3.5 pb-2">
        <span className="text-label font-semibold text-blue">{n}</span>
        <h2 className="text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function Section(
  { title, purpose, base, children }: {
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly children: ReactNode
  }
) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-ink/7 pt-9 pb-10">
      <header className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-4">
        <div>
          <h3 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
        </div>
        <span className="shrink-0 rounded-full bg-g-50 px-[9px] py-[3px] text-[11.5px] font-[550] whitespace-nowrap text-g-500 shadow-[inset_0_0_0_1px_var(--color-g-200)]">
          {base}
        </span>
      </header>
      {children}
    </section>
  )
}

export function Demo(
  { label, className, children }: { readonly label?: string; readonly className?: string; readonly children: ReactNode }
) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-wrap items-center gap-3.5 rounded-lg bg-white p-5 shadow-e1 sm:p-7",
        label && "pt-[42px] sm:pt-12",
        className
      )}
    >
      {label && <span className="absolute top-3.5 left-4 text-[11.5px] font-[550] text-g-500">{label}</span>}
      {children}
    </div>
  )
}

export function States({ items }: { readonly items: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))]">
      {items.map(([label, node]) => (
        <li
          key={label}
          className="grid min-w-0 justify-items-center gap-2 rounded-md bg-g-50 px-2.5 pt-4 pb-2.5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]"
        >
          <div className="grid min-h-10 w-full place-items-center">{node}</div>
          <span className="text-[11.5px] font-[550] text-g-500">{label}</span>
        </li>
      ))}
    </ul>
  )
}

// Static state samples are pictures of a state, so they stay out of the tab order.
export const sample = { tabIndex: -1 } as const
export const hoverRing = "[--field-ring:rgba(10,11,13,.2)]"
export const focusRing = "shadow-[0_0_0_1px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.12)]"
export const focusOutline = "outline-2 outline-offset-2 outline-blue"
