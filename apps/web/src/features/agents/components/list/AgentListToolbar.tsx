import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { Icon } from "@bluechip/ui/icons/icon"
import { FilterTabs } from "../../../../components/FilterTabs.tsx"
import { AGENT_FILTERS, AGENT_SORTS, type AgentFilter, type AgentSort } from "../../model/agentList.ts"

/**
 * Which agents to show and in what order: a filter by state with its counts (one that shows none is left out, unless
 * it's the one chosen), a search by name or stock, and the sort.
 */
export function AgentListToolbar(
  { counts, filter, query, sort, onFilter, onQuery, onSort }: Readonly<{
    counts: Readonly<Record<AgentFilter, number>>
    filter: AgentFilter
    query: string
    sort: AgentSort
    onFilter: (filter: AgentFilter) => void
    onQuery: (query: string) => void
    onSort: (sort: AgentSort) => void
  }>
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <FilterTabs
        label="Show"
        value={filter}
        onChange={onFilter}
        options={AGENT_FILTERS.map((option) => ({ ...option, count: counts[option.value] }))}
      />
      <div className="flex min-w-0 flex-[1_1_280px] items-center gap-2 sm:flex-none">
        <InputGroup className="h-[34px] min-w-0 flex-1 bg-white sm:w-[220px]">
          <Icon name="search" size={15} />
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => onQuery(event.currentTarget.value)}
            placeholder="Search by name or stock"
            aria-label="Search agents"
            autoComplete="off"
          />
        </InputGroup>
        <Select
          items={AGENT_SORTS}
          value={sort}
          onValueChange={(value) => value !== null && onSort(value as AgentSort)}
        >
          <SelectTrigger size="sm" aria-label="Sort by" className="w-auto shrink-0 bg-white sm:w-[168px]">
            <span className="flex items-center gap-1.5">
              <Icon name="sort" size={14} className="text-g-500" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {AGENT_SORTS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}
            </SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
