import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Button } from "@bluechip/ui/components/button"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@bluechip/ui/components/sidebar"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useMatchRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { usePauseAll } from "../../../hooks/usePauseAll.ts"
import { agentDot, agentState } from "../model/agentState.ts"

/** The sidebar's "Your agents" group: each agent with its status dot, then "New agent". */
export function SidebarAgents() {
  const agents = useAtomValue(agentsAtom)
  const matchRoute = useMatchRoute()
  const [now] = useState(() => new Date())

  return (
    <SidebarGroup className="mt-4">
      <SidebarGroupLabel>Your agents</SidebarGroupLabel>
      <SidebarMenu>
        {AsyncResult.isSuccess(agents) ?
          agents.value.map((agent) => (
            <SidebarMenuItem key={agent.id}>
              <SidebarMenuButton
                isActive={matchRoute({ to: "/agents/$agentId", params: { agentId: agent.id } }) !== false}
                render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
              >
                {/* `contents` keeps the avatar out of the button's `> span` label styles (flex-1, truncate). */}
                <i className="contents">
                  <AgentAvatar agentId={agent.id} size="sm" status={agentDot(agentState(agent, now))} />
                </i>
                <span>{agent.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )) :
          null}
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={matchRoute({ to: "/agents/new" }) !== false}
            render={<Link to="/agents/new" />}
          >
            <Icon name="plus" />
            <span>New agent</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** The sidebar footer's kill switch: "Pause all agents", or "Resume all" once every one is paused. */
export function SidebarPauseAll() {
  const { shown, allPaused, busy, failed, toggle } = usePauseAll()
  if (!shown) return null

  return (
    <div className="grid gap-1.5 px-1.5 pb-3">
      <Button
        variant={allPaused ? "secondary" : "danger"}
        size="sm"
        className="w-full"
        loading={busy}
        onClick={() => void toggle()}
      >
        <Icon name={allPaused ? "play" : "pause"} size={14} />
        {allPaused ? "Resume all" : "Pause all agents"}
      </Button>
      {failed ?
        <p role="alert" className="text-caption text-loss">We couldn't reach bluechip. Try again.</p> :
        null}
    </div>
  )
}
