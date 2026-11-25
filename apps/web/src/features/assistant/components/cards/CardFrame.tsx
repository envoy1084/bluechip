import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/** The frame of a card in the conversation: a tag and its state on top, the body, then its actions. */
export function CardFrame(
  { tag, icon, state, children, footer, className }: Readonly<{
    tag: string
    icon: IconName
    /** Where the card stands: "Not running yet", "Waiting for you". */
    state?: ReactNode
    children: ReactNode
    footer?: ReactNode
    className?: string
  }>
) {
  return (
    <section
      aria-label={tag}
      className={cn("w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-e2", className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-g-100 bg-[#fafafb] px-[18px] py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
          <Icon name={icon} size={12} />
          {tag}
        </span>
        {state === undefined ? null : <span className="text-label-sm text-g-500">{state}</span>}
      </div>
      <div className="grid gap-3 px-[18px] py-4">{children}</div>
      {footer === undefined ?
        null :
        (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-g-100 bg-[#fafafb] px-[18px] py-3">
            {footer}
          </div>
        )}
    </section>
  )
}

/** Why an action on a card didn't go. */
export function CardProblem({ message }: Readonly<{ message: string | null }>) {
  if (message === null) return null
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

/** What an agent can and can never do, as the policies say it. */
export function RuleList(
  { can, never }: Readonly<{ can: ReadonlyArray<string>; never: ReadonlyArray<string> }>
) {
  const rules = [
    ...can.map((text) => ({ text, kind: "can" as const })),
    ...never.map((text) => ({ text: `Never: ${text.charAt(0).toLowerCase()}${text.slice(1)}`, kind: "never" as const }))
  ]
  if (rules.length === 0) return null

  return (
    <ul className="grid gap-1">
      {rules.map((rule) => (
        <li
          key={rule.text}
          className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-1.5 text-[13.5px] text-g-800"
        >
          <Icon
            name={rule.kind === "can" ? "check" : "close"}
            size={14}
            className={cn("mt-[3px]", rule.kind === "can" ? "text-gain" : "text-loss")}
          />
          <span>{rule.text}</span>
        </li>
      ))}
    </ul>
  )
}
