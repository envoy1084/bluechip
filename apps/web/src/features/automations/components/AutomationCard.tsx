import { type Automation, triggerOf } from "@bluechip/domain/automations/Automation"
import type { Watcher } from "@bluechip/domain/automations/Trigger"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { localTimeZone } from "../../../lib/localTime.ts"
import { runLine, STATUS } from "../model/automationText.ts"
import { StatusPill } from "./StatusPill.tsx"

const WATCHER_ICON: Readonly<Record<Watcher, IconName>> = {
  schedule: "calendar",
  price: "chart-line",
  portfolio: "pie",
  news: "news"
}

/** One automation, for lists: what starts it, its name and state, what it does in a sentence, and when it runs. */
export function AutomationCard(
  { automation, now }: Readonly<{
    automation: Automation
    now: Date
  }>
) {
  const status = STATUS[automation.status]

  return (
    <Link
      to="/automations/$automationId"
      params={{ automationId: automation.id }}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg bg-white p-[18px] shadow-e2 transition-shadow duration-fast ease-brand hover:shadow-e3 focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
    >
      <span className="grid size-[34px] place-items-center rounded-md bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
        <Icon name={WATCHER_ICON[triggerOf(automation.trigger).watcher]} size={18} />
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{automation.name}</b>
          <StatusPill label={status.label} tone={status.tone} />
        </span>
        <span className="text-label text-g-700">{automation.description.sentence}</span>
        <span className="text-label-sm text-g-500">
          {runLine(automation, now, localTimeZone())}
        </span>
      </span>
    </Link>
  )
}
