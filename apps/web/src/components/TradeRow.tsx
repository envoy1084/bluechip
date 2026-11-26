import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import type { StatusWords } from "../lib/intentStatus.ts"

const TONES = {
  plain: null,
  attention: "bg-[linear-gradient(180deg,#f8f9ff,#f3f5ff)]",
  failed: "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)]"
} as const

/**
 * One trade (or a dollar in or out) in a list, the same on the activity page and an agent's activity: what leads it
 * (a stock's chip), what happened with its status, the time, then the page's own lines under it (who asked, why,
 * what it filled at). A row that opens its details is one button (`onOpen`, given the row to return focus to).
 */
export function TradeRow(
  { lead, title, status, time, tone = "plain", onOpen, children }: Readonly<{
    lead: ReactNode
    title: string
    /** Its pill; `null` where the row says where it stands another way. */
    status: StatusWords | null
    time: { readonly at: Date; readonly text: string }
    tone?: keyof typeof TONES
    onOpen?: (row: HTMLElement) => void
    children?: ReactNode
  }>
) {
  const body = (
    <>
      {lead}
      <span className="grid min-w-0 gap-1.5">
        <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</b>
            {status === null ? null : <StatusPill tone={status.tone}>{status.label}</StatusPill>}
          </span>
          <time dateTime={time.at.toISOString()} className="text-label-sm text-g-500 tabular-nums">{time.text}</time>
        </span>
        {children}
      </span>
    </>
  )
  const layout = "grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3.5 px-5 py-4 text-left"

  return (
    <li className={cn("border-b border-g-100 last:border-b-0", TONES[tone])}>
      {onOpen === undefined ? <div className={layout}>{body}</div> : (
        <button
          type="button"
          onClick={(event) => onOpen(event.currentTarget)}
          className={cn(
            layout,
            "cursor-pointer transition-colors hover:bg-g-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
          )}
        >
          {body}
        </button>
      )}
    </li>
  )
}
