import type { Automation } from "@bluechip/domain/automations/Automation"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { automationsAtom } from "../atoms/automations.ts"
import { AutomationCard } from "../components/AutomationCard.tsx"

const PLACEHOLDERS = ["a", "b", "c"]

function NewAutomationButton({ size = "sm" }: Readonly<{ size?: "sm" | "md" }>) {
  return (
    <ButtonLink size={size} render={<Link to="/automations/new" />}>
      <Icon name="plus" size={14} />New automation
    </ButtonLink>
  )
}

/** Your automations by who trades: your own first, then each agent's, in the order you made them. */
function Groups({ automations }: Readonly<{ automations: ReadonlyArray<Automation> }>) {
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())
  const nameOf = (id: string) =>
    AsyncResult.isSuccess(agents) ? agents.value.find((agent) => agent.id === id)?.name ?? "A removed agent" : "Agent"

  const own = automations.filter((automation) => automation.agentId === null)
  const agentIds = [...new Set(automations.flatMap((automation) => automation.agentId ?? []))]
  const groups = [
    ...(own.length === 0 ? [] : [{ id: "you", title: "Your own trades", automations: own }]),
    ...agentIds.map((id) => ({
      id,
      title: nameOf(id),
      automations: automations.filter((automation) => automation.agentId === id)
    }))
  ]

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="grid gap-2.5">
          <h2 id={`group-${group.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.automations.map((automation) => (
              <AutomationCard key={automation.id} automation={automation} now={now} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Every automation you have, your own and your agents', with the way to a new one. */
export function AutomationsScreen() {
  const automations = useAtomValue(automationsAtom("all"))
  const refresh = useAtomRefresh(automationsAtom("all"))

  return (
    <AppPage title="Automations" actions={<NewAutomationButton />} width="wide">
      {AsyncResult.isInitial(automations) && (
        <div aria-busy className="grid gap-3 sm:grid-cols-2">
          {PLACEHOLDERS.map((id) => <SkeletonBlock key={id} className="h-[112px] w-full rounded-lg" />)}
        </div>
      )}
      {AsyncResult.isFailure(automations) && (
        <div className="grid justify-items-center gap-3 py-10 text-center">
          <p className="text-body-sm text-g-600">
            We couldn't load your automations. Check your connection and try again.
          </p>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      )}
      {AsyncResult.isSuccess(automations) && automations.value.length === 0 && (
        <Empty>
          <Illustration name="bolt" variant="halftone" size={160} animate className="-my-2" />
          <EmptyTitle>No automations yet</EmptyTitle>
          <EmptyDescription>
            Trade on a schedule, a price move or the news, always inside your agent's rules.
          </EmptyDescription>
          <EmptyContent className="flex flex-wrap justify-center gap-2">
            <NewAutomationButton size="md" />
            <ButtonLink
              variant="secondary"
              render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
            >
              <Icon name="chat" size={16} />Ask the assistant
            </ButtonLink>
          </EmptyContent>
        </Empty>
      )}
      {AsyncResult.isSuccess(automations) && automations.value.length > 0 && <Groups automations={automations.value} />}
    </AppPage>
  )
}
