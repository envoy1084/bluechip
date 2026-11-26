import type { ConversationId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@bluechip/ui/components/sidebar"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatRelative } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { conversationsAtom } from "../atoms/assistant.ts"

const PLACEHOLDER_ROWS = [0, 1, 2, 3]

function Threads({ current }: Readonly<{ current: ConversationId | null }>) {
  const conversations = useAtomValue(conversationsAtom)
  const refresh = useAtomRefresh(conversationsAtom)
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())

  if (AsyncResult.isInitial(conversations)) {
    return (
      <div aria-busy className="grid gap-1.5 px-1">
        {PLACEHOLDER_ROWS.map((row) => <SkeletonBlock key={row} className="h-[42px] w-full rounded-sm" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(conversations)) {
    return (
      <div className="grid justify-items-start gap-2 px-2.5 py-2">
        <p className="text-label-sm text-g-600">We couldn't load your chats.</p>
        <Button variant="secondary" size="xs" onClick={refresh}>Try again</Button>
      </div>
    )
  }
  if (conversations.value.items.length === 0) {
    return <p className="px-2.5 py-2 text-label-sm text-g-500">No chats yet. Your first message starts one.</p>
  }

  const agentOf = (conversation: (typeof conversations.value.items)[number]) =>
    conversation.agentId === null || !AsyncResult.isSuccess(agents) ?
      undefined :
      agents.value.find((agent) => agent.id === conversation.agentId)

  return (
    <SidebarMenu>
      {conversations.value.items.map((conversation) => {
        const agent = agentOf(conversation)
        const when = formatRelative(DateTime.toDateUtc(conversation.updatedAt), now, { timeZone: localTimeZone() })
        return (
          <SidebarMenuItem key={conversation.id}>
            <SidebarMenuButton
              isActive={conversation.id === current}
              render={<Link to="/chat/{-$conversationId}" params={{ conversationId: conversation.id }} />}
              className="h-auto items-start py-2"
            >
              {/* `contents` keeps the avatar out of the button's `> span` label styles (flex-1, truncate). */}
              {agent === undefined ?
                <Icon name="chat" className="mt-0.5" /> :
                (
                  <i className="contents">
                    <AgentAvatar agentId={agent.id} size="sm" />
                  </i>
                )}
              <span className="grid gap-px">
                <span className="truncate">{conversation.title ?? "New chat"}</span>
                <span className="truncate text-caption font-normal text-g-500">
                  {agent === undefined ? when : `${agent.name}, ${when}`}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

/**
 * The chat page's own sidebar: New chat, then every conversation, newest first, each with the agent it trades
 * through. It slides away on desktop and becomes a sheet on phones.
 */
export function ThreadsSidebar({ current }: Readonly<{ current: ConversationId | null }>) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas" label="Chats" className="bg-canvas">
      <SidebarHeader className="h-auto px-0.5">
        <ButtonLink
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
          onClick={() => isMobile && setOpenMobile(false)}
        >
          <Icon name="plus" size={14} />New chat
        </ButtonLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <Threads current={current} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
