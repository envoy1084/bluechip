import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Icon } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"
import type { ListedAutomation } from "../../hooks/useListedAutomations.ts"
import type { TraderFilter } from "../../model/standing.ts"

interface Option {
  readonly value: TraderFilter
  readonly label: string
  readonly mark: ReactNode
  readonly count: number
}

const YOU_MARK = (
  <span className="grid size-[26px] place-items-center rounded-sm bg-g-50 text-g-600 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
    <Icon name="face-id" size={15} />
  </span>
)

const ALL_MARK = (
  <span className="grid size-[26px] place-items-center rounded-sm bg-g-50 text-g-600 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
    <Icon name="agents" size={15} />
  </span>
)

/**
 * Whose automations the list shows: all agents', your own (with Face ID), or one agent's, each with its avatar and how
 * many it has. Only those that have an automation are offered.
 */
export function TraderSelect(
  { listed, trader, onChange }: Readonly<{
    listed: ReadonlyArray<ListedAutomation>
    trader: TraderFilter
    onChange: (trader: TraderFilter) => void
  }>
) {
  const agentIds = [...new Set(listed.flatMap((row) => row.automation.agentId ?? []))]
  const own = listed.filter((row) => row.automation.agentId === null).length

  const options: ReadonlyArray<Option> = [
    { value: "all", label: "All agents", mark: ALL_MARK, count: listed.length },
    ...(own === 0 ? [] : [{ value: "you" as const, label: "You", mark: YOU_MARK, count: own }]),
    ...agentIds.map((id): Option => {
      const rows = listed.filter((row) => row.automation.agentId === id)
      const agent = rows[0]?.agent
      return {
        value: id,
        label: agent === null ? "A removed agent" : agent?.name ?? "Agent",
        mark: <AgentAvatar agentId={id} size="sm" removed={agent === null} />,
        count: rows.length
      }
    })
  ]
  const picked = options.find((option) => option.value === trader) ?? options[0]!

  return (
    <Select<TraderFilter> value={picked.value} onValueChange={(value) => value !== null && onChange(value)}>
      <SelectTrigger size="sm" aria-label="Trades through" className="w-auto max-w-[240px] gap-1.5 pl-1">
        <SelectValue>
          {() => (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {picked.mark}
              <span className="truncate">{picked.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.mark}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="text-label-sm text-g-400 tabular-nums">{option.count}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
