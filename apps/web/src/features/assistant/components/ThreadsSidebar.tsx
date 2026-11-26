import type { Conversation } from "@bluechip/domain/assistant/Conversation"
import type { ConversationId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle
} from "@bluechip/ui/components/alert-dialog"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
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
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatRelative } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { assistantReactivityKey, conversationsAtom, deleteConversationAtom } from "../atoms/assistant.ts"

const PLACEHOLDER_ROWS = [0, 1, 2, 3]

const reactivityKeys = [assistantReactivityKey]

/**
 * Asks before deleting a chat, then deletes it; deleting the chat on screen opens a new one. `conversation` stays set
 * while the dialog closes, so its words don't change on the way out.
 */
function DeleteChatDialog(
  { conversation, open, onOpenChange, current }: Readonly<{
    conversation: Conversation | null
    open: boolean
    onOpenChange: (open: boolean) => void
    current: ConversationId | null
  }>
) {
  const remove = useAtomSet(deleteConversationAtom, { mode: "promise" })
  const navigate = useNavigate()

  const confirm = (id: ConversationId) =>
    remove({ params: { id }, reactivityKeys }).then(
      () => {
        if (id === current) void navigate({ to: "/chat/{-$conversationId}", params: { conversationId: undefined } })
      },
      () => toast.error("We couldn't delete that chat", { description: "Check your connection and try again." })
    )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogIcon name="trash" />
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{conversation?.title ?? "New chat"}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Its messages and cards go for good, and an answer still coming stops. What bluechip remembers from it stays
            on the memory page, and trades it made stay in your activity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (conversation !== null) void confirm(conversation.id)
            }}
          >
            Delete chat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function Threads({ current }: Readonly<{ current: ConversationId | null }>) {
  const conversations = useAtomValue(conversationsAtom)
  const refresh = useAtomRefresh(conversationsAtom)
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())
  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const [confirming, setConfirming] = useState(false)

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
    <>
      <SidebarMenu>
        {conversations.value.items.map((conversation) => {
          const agent = agentOf(conversation)
          const title = conversation.title ?? "New chat"
          const when = formatRelative(DateTime.toDateUtc(conversation.updatedAt), now, { timeZone: localTimeZone() })
          return (
            <SidebarMenuItem key={conversation.id} className="group/thread">
              <SidebarMenuButton
                isActive={conversation.id === current}
                render={<Link to="/chat/{-$conversationId}" params={{ conversationId: conversation.id }} />}
                className="h-auto items-start py-2 pr-10"
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
                  <span className="truncate">{title}</span>
                  <span className="truncate text-caption font-normal text-g-500">
                    {agent === undefined ? when : `${agent.name}, ${when}`}
                  </span>
                </span>
              </SidebarMenuButton>
              {/* Shown on hover or focus where there is a pointer to hover with, always on touch screens. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`More for ${title}`}
                      className="absolute top-1/2 right-1 -translate-y-1/2 text-g-500 opacity-0 group-focus-within/thread:opacity-100 group-hover/thread:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                    />
                  }
                >
                  <Icon name="more" size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleting(conversation)
                      setConfirming(true)
                    }}
                  >
                    <Icon name="trash" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
      <DeleteChatDialog conversation={deleting} open={confirming} onOpenChange={setConfirming} current={current} />
    </>
  )
}

/**
 * The chat page's own sidebar: New chat, then every conversation, newest first, each with the agent it trades
 * through and a menu to delete it. It slides away on desktop and becomes a sheet on phones.
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
