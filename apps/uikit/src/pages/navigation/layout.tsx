import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"

export function Limits({ rows }: { readonly rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className="grid">
      {rows.map(([term, value]) => (
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

export function IconTile({ icon }: { readonly icon: IconName }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-sm bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
      <Icon name={icon} size={18} />
    </span>
  )
}

export function Section(
  { id, title, purpose, base, flush = false, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly flush?: boolean
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
      <div
        className={flush
          ? "overflow-hidden rounded-lg bg-white shadow-e1"
          : "grid gap-6 rounded-lg bg-white p-6 shadow-e1"}
      >
        {children}
      </div>
    </section>
  )
}
