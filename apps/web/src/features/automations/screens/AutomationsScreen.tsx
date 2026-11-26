import { ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { AutomationRows } from "../components/list/AutomationRows.tsx"
import { AutomationsOverview, FilterTabs } from "../components/list/AutomationsOverview.tsx"
import { FilterEmpty, NoAutomations } from "../components/list/ListEmpty.tsx"
import { TraderSelect } from "../components/list/TraderSelect.tsx"
import { useListedAutomations } from "../hooks/useListedAutomations.ts"
import { type Filter, FILTERS_FROM, shows, sortListed, type TraderFilter, tradesThrough } from "../model/standing.ts"
import { specOf, takesAutomations } from "../model/traders.ts"

function NewAutomationButton({ size = "sm" }: Readonly<{ size?: "sm" | "md" }>) {
  return (
    <ButtonLink size={size} render={<Link to="/automations/new" />}>
      <Icon name="plus" size={14} />New automation
    </ButtonLink>
  )
}

/**
 * Every automation you have, your own and your agents': how they stand at a glance, whose to show and in which state,
 * then one list of them (those needing a look first), and the way to a new one.
 */
export function AutomationsScreen() {
  const { listed, refresh } = useListedAutomations("all")
  const [filter, setFilter] = useState<Filter>("all")
  const [trader, setTrader] = useState<TraderFilter>("all")
  const [now] = useState(() => new Date())
  const agents = useAtomValue(agentsAtom)
  const traders = AsyncResult.isSuccess(agents) ? agents.value.filter(takesAutomations) : []

  const body = () => {
    if (AsyncResult.isInitial(listed)) {
      return (
        <div aria-busy className="grid gap-4">
          <SkeletonBlock className="h-[184px] w-full rounded-lg" />
          <SkeletonBlock className="h-[260px] w-full rounded-lg" />
        </div>
      )
    }
    if (!AsyncResult.isSuccess(listed)) {
      return <LoadProblem what="your automations" onRetry={refresh} />
    }

    const rows = listed.value
    if (rows.length === 0) {
      return (
        <NoAutomations
          title="No automations yet"
          start={{ specs: [null, ...traders.map(specOf)] }}
          actions={
            <>
              <NewAutomationButton size="md" />
              <ButtonLink
                variant="secondary"
                render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
              >
                <Icon name="chat" size={16} />Ask the assistant
              </ButtonLink>
            </>
          }
        >
          Trade on a schedule, a price move or the news, always inside your agent's rules or with your Face ID.
        </NoAutomations>
      )
    }

    // A trader whose automations are all gone shows everyone's again.
    const filters = rows.length >= FILTERS_FROM
    const picked = filters && rows.some((row) => tradesThrough(row.automation, trader)) ? trader : "all"
    const filtered = filters ? filter : "all"
    const theirs = rows.filter((row) => tradesThrough(row.automation, picked))
    const shown = sortListed(theirs.filter((row) => shows(row, filtered)))
    return (
      <>
        <AutomationsOverview listed={theirs} now={now} />
        {!filters ? null : (
          <div className="flex flex-wrap items-center gap-2.5">
            <TraderSelect listed={rows} trader={picked} onChange={setTrader} />
            <FilterTabs listed={theirs} filter={filter} onChange={setFilter} />
          </div>
        )}
        {shown.length === 0 && filtered !== "all" ?
          <FilterEmpty filter={filtered} /> :
          <AutomationRows rows={shown} showTrader={picked === "all"} now={now} />}
      </>
    )
  }

  return (
    <AppPage title="Automations" actions={<NewAutomationButton />} width="wide">
      {body()}
    </AppPage>
  )
}
