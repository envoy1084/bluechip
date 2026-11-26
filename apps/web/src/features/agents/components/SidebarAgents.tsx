import { Button } from "@bluechip/ui/components/button"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@bluechip/ui/components/sidebar"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useMatchRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AgentStateAvatar } from "../../../components/AgentStateAvatar.tsx"
import { usePauseAll } from "../../../hooks/usePauseAll.ts"

/** The sidebar's "Your agents" group: each agent with its status dot, then "New agent". */
export function SidebarAgents() {
  const agents = useAtomValue(agentsAtom)
  const matchRoute = useMatchRoute()

  return (
    <SidebarGroup className="mt-4 transition-[margin] group-data-[collapsible=icon]/sidebar-panel:mt-1">
      <SidebarGroupLabel>Your agents</SidebarGroupLabel>
      <SidebarMenu>
        {AsyncResult.isSuccess(agents) ?
          agents.value.map((agent) => (
            <SidebarMenuItem key={agent.id}>
              <SidebarMenuButton
                isActive={matchRoute({ to: "/agents/$agentId", params: { agentId: agent.id }, fuzzy: true }) !== false}
                tooltip={agent.name}
                render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
                // The avatar is wider than an icon: folded to icons, less padding keeps it centred.
                className="group-data-[collapsible=icon]/sidebar-panel:px-[5px]"
              >
                {/* `contents` keeps the avatar out of the button's `> span` label styles (flex-1, truncate). */}
                <i className="contents">
                  <AgentStateAvatar agent={agent} size="sm" />
                </i>
                <span>{agent.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )) :
          null}
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={matchRoute({ to: "/agents/new" }) !== false}
            tooltip="New agent"
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
  const { state, isMobile } = useSidebar()
  if (!shown) return null

  // Folded to icons, the kill switch stays: as its icon alone, named for screen readers.
  const folded = state === "collapsed" && !isMobile
  const label = allPaused ? "Resume all" : "Pause all agents"
  return (
    <div className="grid gap-1.5 px-1.5 pb-3 group-data-[collapsible=icon]/sidebar-panel:px-0">
      <Button
        variant={allPaused ? "secondary" : "danger"}
        size={folded ? "icon-sm" : "sm"}
        className={folded ? "justify-self-center" : "w-full"}
        loading={busy}
        aria-label={folded ? label : undefined}
        title={folded ? label : undefined}
        onClick={() => void toggle()}
      >
        <Icon name={allPaused ? "play" : "pause"} size={14} />
        {folded ? null : label}
      </Button>
      {failed && !folded ?
        <p role="alert" className="text-caption text-loss">We couldn't reach bluechip. Try again.</p> :
        null}
    </div>
  )
}
