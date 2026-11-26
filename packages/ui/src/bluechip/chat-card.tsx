import { type ComponentProps, createContext, type ReactNode, useContext, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../components/button.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** How a card's state reads: waiting for you, done, left as it was, or something to look at twice. */
export type ChatCardTone = "waiting" | "done" | "quiet" | "warn"

const STATE_TONE: Readonly<Record<ChatCardTone, string>> = {
  waiting: "bg-blue-50 text-blue",
  done: "bg-gain-wash text-gain",
  quiet: "bg-g-100 text-g-600",
  warn: "bg-warn-wash text-warn"
}

export interface ChatCardProps extends Omit<ComponentProps<"section">, "children"> {
  /** What kind of card: "Your trade", "Draft agent", "Memory". Also its accessible name. */
  readonly tag: string
  readonly icon: IconName
  /** Where it stands, as a short pill: "Needs Face ID", "Done". */
  readonly state?: ReactNode
  readonly tone?: ChatCardTone
  readonly children: ReactNode
  /** Its actions, right-aligned under a hairline: the primary one last. */
  readonly footer?: ReactNode
}

// Where a card's header keeps its state: set inside a `ChatCard`, `undefined` outside one.
const StateSlot = createContext<HTMLElement | null | undefined>(undefined)

/**
 * A state that belongs in the card's header, opposite its tag, when its content is drawn inside a `ChatCard` (a live
 * trade that knows its own status); outside a card it stays where it is.
 */
export function ChatCardState({ children }: { readonly children: ReactNode }) {
  const slot = useContext(StateSlot)
  if (slot === undefined) return children
  return slot === null ? null : createPortal(children, slot)
}

/**
 * A card the assistant shows in the conversation: a quiet tag and its state, the one fact that matters, then what you
 * can do about it. Its content can put a live state in the header with `ChatCardState`.
 */
export function ChatCard(
  { tag, icon, state, tone = "waiting", children, footer, className, ...props }: ChatCardProps
) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  return (
    <section
      data-slot="chat-card"
      data-tone={tone}
      aria-label={tag}
      className={cn("w-full max-w-[560px] rounded-lg bg-white shadow-e2", className)}
      {...props}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-label-sm font-semibold text-g-500">
          <Icon name={icon} size={14} />
          <span className="truncate">{tag}</span>
        </span>
        {state === undefined ? null : (
          <span
            data-slot="chat-card-state"
            className={cn(
              "shrink-0 rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap",
              STATE_TONE[tone]
            )}
          >
            {state}
          </span>
        )}
        <span ref={setSlot} data-slot="chat-card-state-slot" className="contents" />
      </header>
      <div className="grid gap-3 px-4 pt-2.5 pb-4">
        <StateSlot value={slot}>{children}</StateSlot>
      </div>
      {footer === undefined ?
        null :
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-g-100 px-4 py-3">{footer}</div>}
    </section>
  )
}

export interface ChatCardHeadlineProps {
  /** Before the title, such as the agent's butterfly. */
  readonly media?: ReactNode
  /** The one fact that matters: "Buy $50.00 of Apple", the agent's name. */
  readonly title: ReactNode
  /** One muted line under it. */
  readonly detail?: ReactNode
  /** Strikes the title through, for a memory that was forgotten. */
  readonly struck?: boolean
}

/** The card's main line, large, with one muted line under it. */
export function ChatCardHeadline({ media, title, detail, struck = false }: ChatCardHeadlineProps) {
  return (
    <div data-slot="chat-card-headline" className="flex items-center gap-3">
      {media}
      <div className="grid min-w-0 gap-0.5">
        <b
          className={cn(
            "text-[16px] leading-snug font-semibold tracking-[-0.012em] text-ink",
            struck && "text-g-500 line-through"
          )}
        >
          {title}
        </b>
        {detail === undefined ? null : <span className="text-label-sm text-g-500">{detail}</span>}
      </div>
    </div>
  )
}

/** What an agent can and can never do, as its policies say it: checks, then crosses. */
export function ChatCardRules(
  { can, never }: { readonly can: ReadonlyArray<string>; readonly never: ReadonlyArray<string> }
) {
  const rules = [
    ...can.map((text) => ({ text, kind: "can" as const })),
    ...never.map((text) => ({ text: `Never ${text.charAt(0).toLowerCase()}${text.slice(1)}`, kind: "never" as const }))
  ]
  if (rules.length === 0) return null

  return (
    <ul data-slot="chat-card-rules" className="grid gap-1 rounded-[12px] px-3 py-2.5 surface-well">
      {rules.map((rule) => (
        <li key={rule.text} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-1.5 text-[13px] text-g-800">
          <Icon
            name={rule.kind === "can" ? "check" : "close"}
            size={13}
            className={cn("mt-[3px]", rule.kind === "can" ? "text-gain" : "text-loss")}
          />
          <span>{rule.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** A short line to look at twice (`warn`), or a quiet reassurance (`muted`): "Nothing happens unless you approve it." */
export function ChatCardNote(
  { icon, tone = "muted", children }: {
    readonly icon: IconName
    readonly tone?: "muted" | "warn"
    readonly children: ReactNode
  }
) {
  return (
    <p
      data-slot="chat-card-note"
      className={cn(
        "flex items-start gap-1.5 text-label-sm",
        tone === "warn" ? "font-[550] text-warn" : "text-g-500"
      )}
    >
      <Icon name={icon} size={14} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Why the card's action didn't go, and what to do: one line, announced. */
export function ChatCardProblem({ children }: { readonly children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <p
      role="alert"
      data-slot="chat-card-problem"
      className="flex items-start gap-1.5 text-label-sm font-medium text-loss"
    >
      <Icon name="error" size={14} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Where a card you confirm stands: waiting for you, applied, or dismissed. */
export type ChatCardStatus = "pending" | "applied" | "dismissed"

export interface ChatCardAnswerProps {
  /** Which answer is on its way, if one is. */
  readonly busy: "confirm" | "dismiss" | null
  readonly confirmLabel: string
  readonly dismissLabel?: string
  readonly onConfirm: () => void
  readonly onDismiss: () => void
}

/** Not now and the card's own action, each showing it's on its way while it is. */
export function ChatCardAnswer(
  { busy, confirmLabel, dismissLabel = "Not now", onConfirm, onDismiss }: ChatCardAnswerProps
) {
  return (
    <>
      <Button variant="ghost" loading={busy === "dismiss"} disabled={busy !== null} onClick={onDismiss}>
        {dismissLabel}
      </Button>
      <Button loading={busy === "confirm"} disabled={busy !== null} onClick={onConfirm}>{confirmLabel}</Button>
    </>
  )
}
