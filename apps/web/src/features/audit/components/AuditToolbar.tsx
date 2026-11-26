import type { AuditType } from "@bluechip/domain/audit/Audit"
import type { AgentId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Input } from "@bluechip/ui/components/input"
import { InputGroup, InputGroupButton, InputGroupInput } from "@bluechip/ui/components/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { Icon } from "@bluechip/ui/icons/icon"
import { AUDIT_RANGES, type AuditDays, type AuditRangePreset } from "../model/auditRange.ts"
import { AUDIT_TYPES } from "../model/auditText.ts"

// The value of "everything" in the tabs and the agent menu: Base UI's items need one.
const ALL = "all"

/** The log's filters: the kind of thing in tabs, then a search, the agent and the days. */
export function AuditToolbar(
  { type, onType, agentId, onAgent, agents, range, onRange, custom, onCustom, search, onSearch }: Readonly<{
    type: AuditType | null
    onType: (type: AuditType | null) => void
    agentId: AgentId | null
    onAgent: (agentId: AgentId | null) => void
    agents: ReadonlyArray<{ readonly id: AgentId; readonly name: string }>
    range: AuditRangePreset
    onRange: (range: AuditRangePreset) => void
    custom: AuditDays
    onCustom: (days: AuditDays) => void
    search: string
    onSearch: (search: string) => void
  }>
) {
  const agentItems = [
    { value: ALL, label: "Every agent" },
    ...agents.map((agent) => ({ value: agent.id, label: agent.name }))
  ]

  return (
    <div className="grid gap-3">
      <Tabs
        variant="segmented"
        value={type ?? ALL}
        onValueChange={(value) => onType(value === ALL ? null : value as AuditType)}
      >
        <TabsList
          aria-label="Kind"
          className="[&_[role=tab]]:h-7 [&_[role=tab]]:gap-1.5 [&_[role=tab]]:px-2.5 [&_[role=tab]]:text-label-sm"
        >
          <TabsTab value={ALL}>
            <Icon name="layers" size={14} />
            Everything
          </TabsTab>
          {AUDIT_TYPES.map((option) => (
            <TabsTab key={option.value} value={option.value}>
              <Icon name={option.icon} size={14} />
              {option.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup size="sm" className="min-w-[200px] flex-1 bg-white">
          <Icon name="search" size={16} />
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => onSearch(event.currentTarget.value)}
            placeholder="Search the log"
            aria-label="Search the log"
            autoComplete="off"
          />
          {search === "" ? null : (
            <InputGroupButton aria-label="Clear the search" onClick={() => onSearch("")}>
              <Icon name="close" size={14} />
            </InputGroupButton>
          )}
        </InputGroup>

        <Select
          items={agentItems}
          value={agentId ?? ALL}
          onValueChange={(value) => value !== null && onAgent(value === ALL ? null : value as AgentId)}
        >
          <SelectTrigger size="sm" aria-label="Agent" className="w-[180px] bg-white">
            <Icon name="agent" size={14} className="shrink-0 text-g-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every agent</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <AgentAvatar agentId={agent.id} size="sm" className="size-5 rounded-full [&_canvas]:w-3.5" />
                <span className="truncate">{agent.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={AUDIT_RANGES}
          value={range}
          onValueChange={(value) => value !== null && onRange(value)}
        >
          <SelectTrigger size="sm" aria-label="Days" className="w-[160px] bg-white">
            <Icon name="calendar" size={14} className="shrink-0 text-g-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIT_RANGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {range === "custom" ?
          (
            <div className="flex items-center gap-1.5 text-label-sm text-g-500">
              <label htmlFor="audit-from" className="sr-only">From</label>
              <Input
                id="audit-from"
                type="date"
                size="sm"
                className="w-[140px] bg-white"
                value={custom.from ?? ""}
                max={custom.to ?? undefined}
                onChange={(event) =>
                  onCustom({ ...custom, from: event.target.value === "" ? null : event.target.value })}
              />
              <span aria-hidden>to</span>
              <label htmlFor="audit-to" className="sr-only">To</label>
              <Input
                id="audit-to"
                type="date"
                size="sm"
                className="w-[140px] bg-white"
                value={custom.to ?? ""}
                min={custom.from ?? undefined}
                onChange={(event) => onCustom({ ...custom, to: event.target.value === "" ? null : event.target.value })}
              />
            </div>
          ) :
          null}
      </div>
    </div>
  )
}
