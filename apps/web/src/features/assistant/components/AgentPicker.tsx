import type { AgentId } from "@bluechip/domain/Ids"
import { AccountAvatar, AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"

// The Select's value for "My account": Base UI's items need a value, and `null` is its "nothing picked".
const ACCOUNT = "account"

/**
 * Who a new conversation's trades go through: one of your agents, or your own account. Picked before the first
 * message; once the conversation starts it stays, shown as its name alone.
 */
export function AgentPicker(
  { agentId, onChange, locked }: Readonly<{
    agentId: AgentId | null
    onChange: (agentId: AgentId | null) => void
    /** The conversation started: it keeps its agent. */
    locked: boolean
  }>
) {
  const agents = useAtomValue(agentsAtom)
  const usable = AsyncResult.isSuccess(agents) ? agents.value.filter((agent) => agent.status !== "removed") : []
  const picked = usable.find((agent) => agent.id === agentId)

  const name = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {picked === undefined ?
        <AccountAvatar size="sm" aria-hidden /> :
        <AgentAvatar agentId={picked.id} size="sm" />}
      <span className="truncate">{picked?.name ?? "My account"}</span>
    </span>
  )

  if (locked || usable.length === 0) {
    return <span className="inline-flex min-w-0 items-center text-label-sm font-medium text-g-600">{name}</span>
  }

  return (
    <Select
      value={picked?.id ?? ACCOUNT}
      onValueChange={(value) => onChange(value === ACCOUNT || value === null ? null : value as AgentId)}
    >
      <SelectTrigger size="sm" aria-label="Trades go through" className="w-auto max-w-[220px] gap-1.5">
        <SelectValue>{() => name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ACCOUNT}>
          <AccountAvatar size="sm" aria-hidden />My account
        </SelectItem>
        {usable.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <AgentAvatar agentId={agent.id} size="sm" />
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
