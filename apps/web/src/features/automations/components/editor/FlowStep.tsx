import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"

/**
 * One step of an automation, read top to bottom like a recipe: its number and icon on a rail joined to the next step,
 * then a card asking the step's question in plain words, with its fields.
 */
export function FlowStep(
  { step, icon, eyebrow, title, hint, aside, last = false, children }: Readonly<{
    step: number
    icon: IconName
    /** "When", "Only if", "Then". */
    eyebrow: string
    /** The question the step answers: "What starts it?" */
    title: string
    hint: string
    aside?: ReactNode
    last?: boolean
    children: ReactNode
  }>
) {
  return (
    <section aria-label={`${eyebrow}: ${title}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3">
      <div className="relative flex justify-center">
        <span className="z-[1] grid size-8 place-items-center rounded-full bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)] ring-4 ring-canvas">
          <Icon name={icon} size={15} />
        </span>
        {last ? null : <i aria-hidden className="absolute top-8 -bottom-1 w-px bg-g-200" />}
      </div>
      <div className={last ? "min-w-0" : "mb-4 min-w-0"}>
        <div className="overflow-hidden rounded-lg bg-white shadow-e2">
          <header className="flex items-start justify-between gap-3 px-[18px] pt-3.5 pb-3">
            <div className="grid gap-0.5">
              <span className="text-caption font-semibold tracking-[.06em] text-blue uppercase">
                Step {step}, {eyebrow}
              </span>
              <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="text-label text-g-500">{hint}</p>
            </div>
            {aside}
          </header>
          {children}
        </div>
      </div>
    </section>
  )
}
