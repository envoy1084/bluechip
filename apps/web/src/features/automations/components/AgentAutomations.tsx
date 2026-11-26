import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { useListedAutomations } from "../hooks/useListedAutomations.ts"
import { type Filter, shows, sortListed } from "../model/standing.ts"
import { takesAutomations } from "../model/traders.ts"
import { AutomationRows } from "./list/AutomationRows.tsx"
import { AutomationsOverview, FilterTabs } from "./list/AutomationsOverview.tsx"
import { FilterEmpty, NoAutomations } from "./list/ListEmpty.tsx"

/**
 * The agent's automations on its page: how they stand, a filter, and each as a row, with the way to a new one while
 * it can take them.
 */
export function AgentAutomations({ agent }: Readonly<{ agent: Agent }>) {
  const { listed, refresh } = useListedAutomations(agent.id)
  const [filter, setFilter] = useState<Filter>("all")
  const [now] = useState(() => new Date())
  const open = takesAutomations(agent)

  const newAutomation = (size: "xs" | "md") => (
    <ButtonLink
      size={size}
      {...(size === "xs" ? { variant: "secondary" as const } : {})}
      render={<Link to="/automations/new" search={{ agent: agent.id }} />}
    >
      <Icon name="plus" size={size === "xs" ? 13 : 16} />New automation
    </ButtonLink>
  )

  const body = () => {
    if (AsyncResult.isInitial(listed)) {
      return (
        <div aria-busy className="grid gap-3">
          <SkeletonBlock className="h-[150px] w-full rounded-lg" />
          <SkeletonBlock className="h-[120px] w-full rounded-lg" />
        </div>
      )
    }
    if (!AsyncResult.isSuccess(listed)) {
      return (
        <div className="grid justify-items-start gap-2 rounded-lg bg-white p-[18px] shadow-e2">
          <p className="text-body-sm text-g-600">We couldn't load its automations. Try again.</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
        </div>
      )
    }

    const rows = listed.value
    if (rows.length === 0) {
      return (
        <NoAutomations title="No automations yet" {...(open ? { actions: newAutomation("md") } : {})}>
          {open ?
            `Have ${agent.name} trade on a schedule, a price move or the news, always inside its rules.` :
            `${agent.name} can take automations once it runs.`}
        </NoAutomations>
      )
    }

    const shown = sortListed(rows.filter((row) => shows(row, filter)))
    return (
      <>
        <AutomationsOverview listed={rows} now={now} compact />
        <FilterTabs listed={rows} filter={filter} onChange={setFilter} />
        {shown.length === 0 && filter !== "all"
          ? <FilterEmpty filter={filter} />
          : <AutomationRows rows={shown} showTrader={false} now={now} />}
      </>
    )
  }

  return (
    <section aria-labelledby={`automations-${agent.id}`} className="grid content-start gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5 px-0.5">
        <div className="grid gap-0.5">
          <h3 id={`automations-${agent.id}`} className="text-[16px] font-semibold tracking-[-0.015em]">Automations</h3>
          <p className="text-label-sm text-g-500">
            What starts {agent.name} trading on its own, and how each run went.
          </p>
        </div>
        {open ? newAutomation("xs") : null}
      </div>
      {body()}
    </section>
  )
}
