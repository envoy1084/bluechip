import type { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { Button } from "@bluechip/ui/components/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@bluechip/ui/components/sheet"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatRelative } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { conversationsAtom } from "../atoms/assistant.ts"

function ConversationList(
  { current, onPick }: Readonly<{ current: ConversationId | null; onPick: () => void }>
) {
  const conversations = useAtomValue(conversationsAtom)
  const refresh = useAtomRefresh(conversationsAtom)
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())
  const agentName = (id: AgentId | null) =>
    id === null || !AsyncResult.isSuccess(agents) ? undefined : agents.value.find((agent) => agent.id === id)?.name

  if (AsyncResult.isInitial(conversations)) {
    return (
      <div aria-busy className="grid gap-2">
        {[0, 1, 2].map((row) => <SkeletonBlock key={row} className="h-12 w-full rounded-md" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(conversations)) {
    return (
      <div className="grid justify-items-center gap-3 py-8 text-center">
        <p className="text-body-sm text-g-600">We couldn't load your conversations. Try again.</p>
        <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }
  if (conversations.value.items.length === 0) {
    return (
      <p className="py-8 text-center text-body-sm text-g-600">No conversations yet. Ask bluechip anything on Home.</p>
    )
  }

  return (
    <ul className="grid gap-1">
      {conversations.value.items.map((conversation) => {
        const about = agentName(conversation.agentId)
        const when = formatRelative(DateTime.toDateUtc(conversation.updatedAt), now, { timeZone: localTimeZone() })
        return (
          <li key={conversation.id}>
            <Link
              to="/home"
              search={{ conversation: conversation.id }}
              onClick={onPick}
              aria-current={conversation.id === current ? "page" : undefined}
              className={cn(
                "grid gap-0.5 rounded-md px-3 py-2.5 hover:bg-g-50",
                conversation.id === current && "bg-blue-50 hover:bg-blue-50"
              )}
            >
              <span className="truncate text-[14px] font-semibold text-ink">
                {conversation.title ?? "New conversation"}
              </span>
              <span className="text-label-sm text-g-500">{about === undefined ? when : `About ${about}, ${when}`}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Your conversations with the assistant in a sheet: switch to one, or start a new one. */
export function ConversationsButton({ current }: Readonly<{ current: ConversationId | null }>) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Conversations" onClick={() => setOpen(true)}>
        <Icon name="chat" size={16} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>Pick up where you left off, or start again.</SheetDescription>
          </SheetHeader>
          <SheetBody>{open ? <ConversationList current={current} onPick={() => setOpen(false)} /> : null}</SheetBody>
          <SheetFooter>
            <Button nativeButton={false} render={<Link to="/home" search={{}} />} onClick={() => setOpen(false)}>
              <Icon name="plus" size={16} />New conversation
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
