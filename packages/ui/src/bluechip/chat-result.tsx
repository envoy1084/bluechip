import type { ComponentProps, ReactNode } from "react"
import { SkeletonBlock } from "../components/skeleton.tsx"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** Where a result stands: still being read, read, read with nothing in it, or not read at all. */
export type ChatResultState = "ready" | "loading" | "empty" | "error"

export interface ChatResultProps extends Omit<ComponentProps<"section">, "children" | "title"> {
  /** What was read: "Your portfolio", "Prices". Also its accessible name. */
  readonly title: string
  readonly icon: IconName
  readonly state?: ChatResultState
  /** The way to the full page, top right: an "Open" link. */
  readonly action?: ReactNode
  /** What an empty or failed result says instead of its body. */
  readonly message?: ReactNode
  readonly children?: ReactNode
  /** Under a hairline, such as "See all". */
  readonly footer?: ReactNode
}

/**
 * What a tool read, shown compact in the conversation: a quiet title with the way to its page, then the few numbers or
 * rows that matter. Lighter than a card you act on; while it's read it shimmers, and empty or failed it says so in a
 * line.
 */
export function ChatResult(
  { title, icon, state = "ready", action, message, children, footer, className, ...props }: ChatResultProps
) {
  return (
    <section
      data-slot="chat-result"
      data-state={state}
      aria-label={title}
      aria-busy={state === "loading" || undefined}
      className={cn("w-full max-w-[560px] rounded-lg bg-white shadow-e1", className)}
      {...props}
    >
      <header className="flex min-h-9 items-center justify-between gap-2 pt-1.5 pr-1.5 pl-3.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-label-sm font-semibold text-g-500">
          <Icon name={icon} size={14} />
          <span className="truncate">{title}</span>
        </span>
        {state === "ready" || state === "empty" ? action : null}
      </header>
      <div className="grid gap-2.5 px-3.5 pt-1 pb-3">
        {state === "loading" ?
          (
            <div className="grid gap-2 py-1">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="w-full" />
              <SkeletonBlock className="w-2/3" />
            </div>
          ) :
          state === "ready" ?
          children :
          (
            <p
              className={cn(
                "flex items-start gap-1.5 text-label",
                state === "error" ? "text-loss" : "text-g-500"
              )}
            >
              <Icon name={state === "error" ? "error" : "info"} size={14} className="mt-[3px] shrink-0" />
              <span>{message}</span>
            </p>
          )}
      </div>
      {footer === undefined || state !== "ready" ?
        null :
        <div className="flex items-center justify-end gap-2 border-t border-g-100 py-1 pr-1.5 pl-3.5">{footer}</div>}
    </section>
  )
}

export interface ChatResultHeadlineProps {
  /** The number that matters, large: "$4,212.40". */
  readonly value: ReactNode
  /** Beside it: today's change, a price move. */
  readonly change?: ReactNode
  /** One muted line under it. */
  readonly detail?: ReactNode
  /** At the far right, such as a sparkline. */
  readonly aside?: ReactNode
}

/** A result's main number, its change beside it, and one muted line. */
export function ChatResultHeadline({ value, change, detail, aside }: ChatResultHeadlineProps) {
  return (
    <div data-slot="chat-result-headline" className="flex items-end justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <b className="text-[20px] leading-tight font-semibold tracking-[-0.025em] tabular-nums">{value}</b>
          {change}
        </span>
        {detail === undefined ? null : <span className="text-label-sm text-g-500">{detail}</span>}
      </div>
      {aside}
    </div>
  )
}

/** A result's rows, divided by hairlines. */
export function ChatResultRows({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="chat-result-rows" className={cn("grid divide-y divide-g-100", className)} {...props} />
}

export interface ChatResultRowProps extends Omit<ComponentProps<"li">, "children" | "title" | "value"> {
  /** Before the title: a ticker chip, an agent's butterfly. */
  readonly media?: ReactNode
  readonly title: ReactNode
  readonly detail?: ReactNode
  /** At the right: an amount, a price. */
  readonly value?: ReactNode
  /** Under the value: its change, a share. */
  readonly valueDetail?: ReactNode
}

/** One compact row: what it is with a muted line, and its number at the right. */
export function ChatResultRow({ media, title, detail, value, valueDetail, className, ...props }: ChatResultRowProps) {
  return (
    <li
      data-slot="chat-result-row"
      className={cn("flex items-center gap-2.5 py-2 first:pt-1 last:pb-0.5", className)}
      {...props}
    >
      {media}
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="truncate text-[13.5px] font-[550] text-ink">{title}</span>
        {detail === undefined ? null : <span className="text-caption text-g-500">{detail}</span>}
      </span>
      {value === undefined && valueDetail === undefined ?
        null :
        (
          <span className="grid shrink-0 justify-items-end gap-px">
            {value === undefined ?
              null :
              <span className="text-[13.5px] font-semibold text-ink tabular-nums">{value}</span>}
            {valueDetail === undefined ? null : <span className="text-caption text-g-500">{valueDetail}</span>}
          </span>
        )}
    </li>
  )
}

/** A few labelled numbers side by side, on a recessed panel. */
export function ChatResultStats({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      data-slot="chat-result-stats"
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-3 gap-y-2 rounded-[10px] px-3 py-2.5 surface-well",
        className
      )}
      {...props}
    />
  )
}

export interface ChatResultStatProps {
  readonly label: ReactNode
  readonly value: ReactNode
  /** Tints the value: a gain, a loss, or plain. */
  readonly tone?: "gain" | "loss" | "plain"
}

export function ChatResultStat({ label, value, tone = "plain" }: ChatResultStatProps) {
  return (
    <div data-slot="chat-result-stat" className="grid min-w-0 gap-0.5">
      <dt className="truncate text-caption text-g-500">{label}</dt>
      <dd
        className={cn(
          "text-[13.5px] font-semibold tabular-nums",
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
