import type { ReactNode } from "react"

/**
 * The head of a card that is a list (holdings, the stocks, what each stock added): its title (named by `id`, for the
 * card's `aria-labelledby`) and its actions, over a rule. A part of a page whose cards sit under its title uses
 * `SectionHeader`, outside them, instead.
 */
export function ListCardHeader(
  { id, title, actions }: Readonly<{ id: string; title: ReactNode; actions?: ReactNode }>
) {
  return (
    <div className="flex min-h-[50px] flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-2.5">
      <h2 id={id} className="text-body-sm font-semibold tracking-normal">{title}</h2>
      {actions}
    </div>
  )
}
