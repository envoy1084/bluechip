import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/**
 * The marker of a step: its number in blue while it can run, a warning in red while something in it can't, or an
 * icon for a part that isn't a step (More settings).
 */
export function StepMarker({ mark, problem }: Readonly<{ mark: number | IconName; problem: boolean }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-base ease-brand",
        problem ?
          "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]" :
          typeof mark === "number" ?
          "bg-blue text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_1px_2px_rgba(20,50,160,.2)]" :
          "bg-g-100 text-g-600 shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]"
      )}
    >
      {problem ? <Icon name="warning" size={15} /> : typeof mark === "number" ? mark : <Icon name={mark} size={15} />}
    </span>
  )
}

/** The thread between two steps, from one marker down to the next, so the steps read as one recipe. */
export function StepThread() {
  return <span aria-hidden className="ml-[33px] block h-3.5 w-0.5 rounded-full bg-blue-100" />
}

/**
 * One step of an automation in the editor: its marker, its name ("When"), the question it answers, and its fields,
 * on one white card. Focusable, so the sentence and the problems can lead to it.
 */
export function EditorSection(
  { id, step, title, question, problem, aside, children }: Readonly<{
    id: string
    step: number
    /** "When", "Only if", "Then". */
    title: string
    /** "What starts it?" */
    question: string
    /** Something in it keeps the automation from running. */
    problem: boolean
    aside?: ReactNode
    children: ReactNode
  }>
) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-label={title}
      className="scroll-mt-[84px] rounded-lg bg-white shadow-e2 outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-blue),0_0_0_5px_rgba(42,91,255,.12)]"
    >
      <header className="flex items-center gap-3 px-[18px] pt-4 pb-3.5">
        <StepMarker mark={step} problem={problem} />
        <div className="grid min-w-0 flex-1">
          <span
            className={cn("text-caption font-semibold tracking-[.06em] uppercase", problem ? "text-loss" : "text-blue")}
          >
            {title}
          </span>
          <h3 className="text-[16px] leading-snug font-semibold tracking-[-0.01em]">{question}</h3>
        </div>
        {aside}
      </header>
      <div className="grid gap-4 px-[18px] pt-1 pb-[18px]">{children}</div>
    </section>
  )
}
