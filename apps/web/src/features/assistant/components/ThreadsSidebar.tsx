import type { Conversation } from "@bluechip/domain/assistant/Conversation"
import type { ConversationId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
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
import { type RefObject, useRef, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { ConfirmDialog } from "../../../components/ConfirmDialog.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { localTimeZone } from "../../../lib/localTime.ts"
import { assistantReactivityKey, conversationsAtom, deleteConversationAtom } from "../atoms/assistant.ts"

const PLACEHOLDER_ROWS = [0, 1, 2, 3]

const reactivityKeys = [assistantReactivityKey]

/**
 * Asks before deleting a chat, then deletes it; deleting the chat on screen opens a new one. `conversation` stays set
 * while the dialog closes, so its words don't change on the way out.
 */
function DeleteChatDialog(
  { conversation, open, onOpenChange, current, returnFocus }: Readonly<{
    conversation: Conversation | null
    open: boolean
    onOpenChange: (open: boolean) => void
    current: ConversationId | null
    /** The row's More button it was opened from, focused again when you keep the chat. */
    returnFocus: RefObject<HTMLElement | null>
  }>
) {
  const remove = useAtomSet(deleteConversationAtom, { mode: "promise" })
  const navigate = useNavigate()

  const confirm = (id: ConversationId) =>
    remove({ params: { id }, reactivityKeys }).then(
      () => {
        toast.success("Chat deleted")
        if (id === current) void navigate({ to: "/chat/{-$conversationId}", params: { conversationId: undefined } })
      },
      () => toast.error("We couldn't delete that chat", { description: "Check your connection and try again." })
    )

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={returnFocus}
      title="Delete this chat?"
      consequence={`“${
        conversation?.title ?? "New chat"
      }” and its cards go for good. If bluechip is still answering, it stops. What it remembers from the chat stays on the memory page, and any trades stay in your activity.`}
      action={{
        _tag: "danger",
        label: "Delete chat",
        onConfirm: () => {
          if (conversation !== null) void confirm(conversation.id)
        }
      }}
    />
  )
}

function Threads({ current }: Readonly<{ current: ConversationId | null }>) {
  const conversations = useAtomValue(conversationsAtom)
  const refresh = useAtomRefresh(conversationsAtom)
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())
  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const [confirming, setConfirming] = useState(false)
  const moreButtons = useRef(new Map<ConversationId, HTMLElement>())
  const returnFocus = useRef<HTMLElement | null>(null)

  if (AsyncResult.isInitial(conversations)) {
    return (
      <div aria-busy className="grid gap-1.5 px-1">
        {PLACEHOLDER_ROWS.map((row) => <SkeletonBlock key={row} className="h-[42px] w-full rounded-sm" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(conversations)) {
    return <LoadProblem what="your chats" onRetry={refresh} size="sm" />
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
                {
                  /* One slot for the agent's butterfly or the chat icon, so every title starts at the same place; an
                    `i`, not a span, keeps it out of the button's `> span` label styles (flex-1, truncate). */
                }
                <i className="grid h-[26px] w-[26px] shrink-0 place-items-center not-italic">
                  {agent === undefined ?
                    <Icon name="chat" size={18} /> :
                    <AgentAvatar agentId={agent.id} size="sm" />}
                </i>
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
                      ref={(button: HTMLButtonElement | null) => {
                        if (button === null) moreButtons.current.delete(conversation.id)
                        else moreButtons.current.set(conversation.id, button)
                      }}
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
                      returnFocus.current = moreButtons.current.get(conversation.id) ?? null
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
      <DeleteChatDialog
        conversation={deleting}
        open={confirming}
        onOpenChange={setConfirming}
        current={current}
        returnFocus={returnFocus}
      />
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
