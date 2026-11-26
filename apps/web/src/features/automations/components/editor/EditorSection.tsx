import type { ReactNode } from "react"

/**
 * One part of an automation in the editor: its step number, its name ("When"), the question it answers, and its
 * fields. Focusable, so the sentence and the problems can lead to it.
 */
export function EditorSection(
  { id, step, title, question, aside, children }: Readonly<{
    id: string
    step: number
    /** "When", "Only if", "Then". */
    title: string
    /** "What starts it?" */
    question: string
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
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-g-100 text-[12.5px] font-semibold text-g-700 tabular-nums shadow-[inset_0_0_0_1px_rgba(10,11,13,.06)]"
        >
          {step}
        </span>
        <div className="grid min-w-0 flex-1">
          <span className="text-caption font-semibold tracking-[.06em] text-g-500 uppercase">{title}</span>
          <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em]">{question}</h3>
        </div>
        {aside}
      </header>
      <div className="grid gap-4 border-t border-g-100 px-[18px] pt-4 pb-[18px]">{children}</div>
    </section>
  )
}
