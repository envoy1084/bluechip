import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"

/**
 * A card of settings, named by its title: its illustration, title and what it is for, with `action` beside them (a
 * status, a button), then its rows; or, without rows, a card that leads to a page of its own through `action`.
 */
export function SettingsSection(
  { title, description, illustration, action, children }: Readonly<{
    title?: string
    description?: string
    illustration?: IllustrationName
    action?: ReactNode
    children?: ReactNode
  }>
) {
  return (
    <section aria-label={title} className="rounded-lg bg-white px-[22px] pt-0.5 pb-1 shadow-e2">
      {title === undefined ?
        null :
        (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pt-[18px] pb-3.5",
              children !== undefined && "border-b border-g-100"
            )}
          >
            <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
              {illustration === undefined ? null : <Illustration name={illustration} size={48} className="shrink-0" />}
              <div className="grid gap-1">
                <h3 className="text-base font-semibold tracking-[-0.02em]">{title}</h3>
                {description === undefined ? null : <p className="text-[13.5px] text-g-600">{description}</p>}
              </div>
            </div>
            {action}
          </div>
        )}
      {children}
    </section>
  )
}

/** One setting: its icon, title and description (when its card hasn't said it already), and what it offers on the right. */
export function SettingsRow(
  { title, description, icon, children }: Readonly<
    { title: ReactNode; description?: ReactNode; icon?: IconName; children?: ReactNode }
  >
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-g-100 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
        {icon === undefined ?
          null :
          (
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(180deg,#fff,#f1f3f6)] text-g-600 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
              <Icon name={icon} size={18} />
            </span>
          )}
        <div className="grid min-w-0 gap-0.5">
          <b className="inline-flex items-center gap-2 text-sm font-semibold">{title}</b>
          {description === undefined ? null : <span className="text-[13px] text-g-500">{description}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}
