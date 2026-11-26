import type { Agent } from "@bluechip/domain/agents/Agent"
import { ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { SectionHeader } from "../../../components/layout/SectionHeader.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
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
      return <LoadProblem what="its automations" onRetry={refresh} variant="card" size="sm" />
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
      <SectionHeader
        id={`automations-${agent.id}`}
        level="h3"
        title="Automations"
        description={`What starts ${agent.name} trading on its own, and how each run went.`}
        {...(open ? { actions: newAutomation("xs") } : {})}
      />
      {body()}
    </section>
  )
}
