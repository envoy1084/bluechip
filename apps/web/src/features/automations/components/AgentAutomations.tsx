import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { automationsAtom } from "../atoms/automations.ts"
import { takesAutomations } from "../model/traders.ts"
import { AutomationCard } from "./AutomationCard.tsx"

/** The agent's automations on its page, with the way to a new one while it can take them. */
export function AgentAutomations({ agent }: Readonly<{ agent: Agent }>) {
  const automations = useAtomValue(automationsAtom(agent.id))
  const refresh = useAtomRefresh(automationsAtom(agent.id))
  const [now] = useState(() => new Date())
  const open = takesAutomations(agent)

  return (
    <section aria-labelledby={`automations-${agent.id}`} className="grid content-start gap-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 id={`automations-${agent.id}`} className="text-label-sm font-semibold text-g-500">Automations</h3>
        {open ?
          (
            <ButtonLink
              variant="ghost"
              size="xs"
              render={<Link to="/automations/new" search={{ agent: agent.id }} />}
            >
              <Icon name="plus" size={14} />New automation
            </ButtonLink>
          ) :
          null}
      </div>
      {AsyncResult.isInitial(automations) && <SkeletonBlock className="h-[96px] w-full rounded-lg" />}
      {AsyncResult.isFailure(automations) && (
        <div className="grid justify-items-start gap-2 rounded-lg bg-white p-[18px] shadow-e2">
          <p className="text-body-sm text-g-600">We couldn't load its automations. Try again.</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
        </div>
      )}
      {AsyncResult.isSuccess(automations) && automations.value.length === 0 && (
        <IllustratedEmpty
          illustration="bolt"
          title="No automations yet"
          action={open ?
            (
              <ButtonLink render={<Link to="/automations/new" search={{ agent: agent.id }} />}>
                <Icon name="plus" size={16} />New automation
              </ButtonLink>
            ) :
            undefined}
        >
          {open ?
            "Have it trade on a schedule, a price move or the news, always inside its rules." :
            "It can take automations once it runs."}
        </IllustratedEmpty>
      )}
      {AsyncResult.isSuccess(automations) && automations.value.length > 0 && (
        <div className="grid gap-3">
          {automations.value.map((automation) => (
            <AutomationCard key={automation.id} automation={automation} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
