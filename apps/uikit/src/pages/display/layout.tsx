import { cn } from "@bluechip/ui/lib/cn"
import { formatPercent } from "@bluechip/ui/lib/format"
import { type TickerTone, tickerTone } from "@bluechip/ui/lib/tickers"
import { type ReactNode, useId } from "react"

const LIMITS: ReadonlyArray<readonly [string, ReactNode]> = [
  [
    "Stocks allowed",
    <span key="s" className="inline-flex flex-wrap justify-end gap-1">
      <Ticker symbol="NVDA" />
      <Ticker symbol="AAPL" />
      <Ticker symbol="MSFT" />
    </span>
  ],
  ["Spend per day", "$250"],
  ["Max per trade", "$100"]
]

const TONE: Readonly<Record<TickerTone, string>> = {
  blue: "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white",
  yellow: "bg-[linear-gradient(180deg,#ffdc5c,#ffd12f)] text-[#3a2c00]",
  green: "bg-[linear-gradient(180deg,#7ad61a,#66c800)] text-[#0c2a00]",
  pink: "bg-[linear-gradient(180deg,#ffbdd9,#fea8cd)] text-[#4a0f2a]",
  ink: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white",
  cerulean: "bg-[linear-gradient(180deg,#62a2ff,#3c8aff)] text-[#00163d]",
  lilac: "bg-[linear-gradient(180deg,#dcaefe,#cd99fd)] text-[#2c0a4d]",
  tan: "bg-[linear-gradient(180deg,#cbb995,#b8a581)] text-[#2a2111]"
}

export function Ticker({ symbol, large = false }: { readonly symbol: string; readonly large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-pixel font-extrabold tracking-[.05em] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
        large
          ? "rounded-[7px] px-[9px] pt-[5px] pb-1 text-label"
          : "rounded-[5px] px-1.5 pt-[3px] pb-0.5 text-caption-sm",
        TONE[tickerTone(symbol)]
      )}
    >
      {symbol}
    </span>
  )
}

export const STATUS_TONE = {
  running: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
  waiting: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
  paused: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
  blocked: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
  idle: "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
} as const

export function Status({ tone, children }: { readonly tone: keyof typeof STATUS_TONE; readonly children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-[3px] pr-[9px] pl-[7px] text-label-sm font-[550] whitespace-nowrap",
        STATUS_TONE[tone]
      )}
    >
      <i className="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_18%,transparent)]" />
      {children}
    </span>
  )
}

export function Change({ value }: { readonly value: number }) {
  return <span className={cn("tabular-nums", value >= 0 ? "text-gain" : "text-loss")}>{formatPercent(value)}</span>
}

export function LimitList({ className }: { readonly className?: string }) {
  return (
    <dl className={cn("grid", className)}>
      {LIMITS.map(([term, value]) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 border-b border-g-100 py-[7px] text-label last:border-b-0"
        >
          <dt className="text-g-500">{term}</dt>
          <dd className="font-[550] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
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
    <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-ink/7 pt-9 pb-10">
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

export const Caption = ({ children }: { readonly children: ReactNode }) => (
  <span className="text-[13.5px] font-[550]">{children}</span>
)
