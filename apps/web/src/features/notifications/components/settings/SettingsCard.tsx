import type { ReactNode } from "react"

/** A card of the notification settings page: its title and what it is for, then its rows. */
export function SettingsCard(
  { title, description, children, aside }: Readonly<{
    title: string
    description: string
    children: ReactNode
    aside?: ReactNode
  }>
) {
  return (
    <section className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-g-100 pt-[18px] pb-3.5">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="text-[13.5px] text-g-600">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** One row: what it is, and its controls. */
export function SettingsRow(
  { title, description, children }: Readonly<{ title: ReactNode; description: ReactNode; children?: ReactNode }>
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-g-100 py-3.5 last:border-b-0">
      <div className="grid min-w-0 flex-[1_1_240px] gap-0.5">
        <b className="text-sm font-semibold">{title}</b>
        <span className="text-[13px] text-g-500">{description}</span>
      </div>
      {children}
    </div>
  )
}
