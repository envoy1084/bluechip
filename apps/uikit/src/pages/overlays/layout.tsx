import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"
import { LIMITS } from "./data.ts"

export function Limits({ count = LIMITS.length }: { readonly count?: number }) {
  return (
    <dl className="grid">
      {LIMITS.slice(0, count).map(([term, value]) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 border-b border-g-100 py-[9px] text-[13.5px] last:border-b-0"
        >
          <dt className="text-g-500">{term}</dt>
          <dd className="font-[550] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AgentTile({ icon, size = "md" }: { readonly icon: IconName; readonly size?: "md" | "lg" }) {
  return (
    <span
      className={size === "lg" ?
        "grid size-12 place-items-center rounded-[14px] bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]" :
        "grid size-10 place-items-center rounded-[12px] bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"}
    >
      <Icon name={icon} size={size === "lg" ? 24 : 20} />
    </span>
  )
}

export function Ticker({ symbol }: { readonly symbol: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[5px] bg-ink px-1.5 text-caption-sm font-bold tracking-wide text-white">
      {symbol}
    </span>
  )
}

export function Section(
  { id, title, purpose, base, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly children: ReactNode
  }
) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid gap-4 border-t border-g-100 pt-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="text-title-2 font-semibold">{title}</h2>
          <p className="max-w-[56ch] text-body-sm text-g-600">{purpose}</p>
        </div>
        <span className="rounded-full bg-g-100 px-2.5 py-0.5 text-caption font-medium text-g-600">{base}</span>
      </header>
      <div className="flex min-h-40 flex-wrap items-center justify-center gap-3 rounded-lg bg-white p-6 shadow-e1">
        {children}
      </div>
    </section>
  )
}
