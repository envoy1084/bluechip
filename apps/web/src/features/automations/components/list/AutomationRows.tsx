import type { ListedAutomation } from "../../hooks/useListedAutomations.ts"
import { AutomationRow } from "./AutomationRow.tsx"

/** Automations as rows in one card, in the order given; `showTrader` says who trades on each. */
export function AutomationRows(
  { rows, showTrader, now }: Readonly<{ rows: ReadonlyArray<ListedAutomation>; showTrader: boolean; now: Date }>
) {
  return (
    <ul aria-label="Automations" className="overflow-hidden rounded-lg bg-white shadow-e2">
      {rows.map((row, index) => (
        <AutomationRow key={row.automation.id} row={row} showTrader={showTrader} now={now} index={index} />
      ))}
    </ul>
  )
}
