import type { ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface PolicyRowProps {
  readonly title: string
  /** What it lets the agent do now, in one line: "Trade up to $100 at a time, and ask you before anything bigger." */
  readonly summary: ReactNode
  /** Beside the title, such as how it compares with the rules in force ("Tighter"). */
  readonly badge?: ReactNode
  /** What blocks locking it. A row with a problem stays open. */
  readonly problem?: string | undefined
  /** At the row's end, beside the Edit toggle: the switch that adds or removes an optional rule. */
  readonly control?: ReactNode
  /** Off: a rule the agent doesn't carry. It reads muted and doesn't open. */
  readonly off?: boolean
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** The editor, shown once the row is open. */
  readonly children?: ReactNode
  readonly className?: string
}

/**
 * One rule of an agent, folded to a line that says what it does now; Edit opens its editor. A problem opens it and
 * says what to fix, so nothing that blocks locking hides behind a fold. An optional rule carries its switch.
 */
export function PolicyRow(
  { title, summary, badge, problem, control, off = false, open, defaultOpen, onOpenChange, children, className }:
    PolicyRowProps
) {
  const forced = problem !== undefined && !off

  return (
    <Collapsible
      data-slot="policy-row"
      data-off={off || undefined}
      data-problem={forced || undefined}
      {...(off ? { open: false } : forced ? { open: true } : open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
      className={cn("border-b border-g-100 last:border-b-0", className)}
    >
      <div className="flex items-center gap-3 pr-[18px]">
        <CollapsibleTrigger
          disabled={off}
          className="group/row grid min-w-0 flex-1 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 pl-[18px] text-left disabled:cursor-default"
        >
          <span className="grid min-w-0 gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn("text-[14px] font-semibold text-ink", off && "font-medium text-g-700")}>{title}</span>
              {badge}
            </span>
            <span className={cn("text-label text-g-500", forced && "font-medium text-loss")}>
              {forced ? problem : summary}
            </span>
          </span>
          {off || forced ?
            null :
            (
              <span className="inline-flex items-center gap-1 text-label-sm font-medium text-g-500 group-hover/row:text-blue">
                <span className="group-data-panel-open/row:hidden">Edit</span>
                <span className="hidden group-data-panel-open/row:inline">Close</span>
                <Icon
                  name="chevron-down"
                  size={14}
                  className="transition-transform duration-base ease-brand group-data-panel-open/row:rotate-180"
                />
              </span>
            )}
        </CollapsibleTrigger>
        {control}
      </div>
      <CollapsibleContent>
        <div className="grid gap-3 px-[18px] pt-0.5 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export interface PolicyGroupProps {
  readonly title: string
  /** One line under the title. */
  readonly description?: ReactNode
  /** Beside the title, such as a count or a preset picker's state. */
  readonly aside?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/** One decision of the policies form: a titled card of rows. */
export function PolicyGroup({ title, description, aside, children, className }: PolicyGroupProps) {
  return (
    <section
      data-slot="policy-group"
      aria-label={title}
      className={cn("overflow-hidden rounded-lg bg-white shadow-e2", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-g-100 px-[18px] pt-4 pb-3">
        <div className="grid gap-0.5">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
          {description === undefined ? null : <p className="text-label text-g-500">{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}
