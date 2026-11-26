import { type AutomationDraft, describeAutomation } from "@bluechip/domain/automations/Automation"
import type { RequestId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { PolicyGroup } from "@bluechip/ui/bluechip/policy-row"
import { Button } from "@bluechip/ui/components/button"
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@bluechip/ui/components/sheet"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useState } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { stocksOf } from "../../model/traders.ts"
import { AutomationEditor } from "../editor/AutomationEditor.tsx"

/** One automation a template comes with, as the new agent's flow holds it: kept or not, changed or as it came. */
export interface TemplateAutomation {
  /** Its request id once saved, so it is saved once. */
  readonly id: RequestId
  readonly draft: AutomationDraft
  readonly kept: boolean
  readonly edited: boolean
}

/**
 * The automations the agent's template comes with, on the review: each in a sentence, kept with its switch, changed
 * in the editor. Nothing is saved here; they start once the agent is live.
 */
export function TemplateAutomations(
  { automations, spec, stocks, nameOf, onChange }: Readonly<{
    automations: ReadonlyArray<TemplateAutomation>
    spec: AgentSpec
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onChange: (automations: ReadonlyArray<TemplateAutomation>) => void
  }>
) {
  const [editing, setEditing] = useState<number | null>(null)
  if (automations.length === 0) return null

  const kept = automations.filter((automation) => automation.kept).length
  const set = (index: number, change: Partial<TemplateAutomation>) =>
    onChange(automations.map((automation, at) => at === index ? { ...automation, ...change } : automation))
  const open = editing === null ? undefined : automations[editing]

  return (
    <PolicyGroup
      title="Automations"
      description="It comes with these. They start once it's live, and you can change them any time."
      aside={<span className="text-label-sm text-g-500">{kept} of {automations.length} kept</span>}
    >
      <ul>
        {automations.map((automation, index) => (
          <li
            key={automation.id}
            className="flex items-center gap-3 border-b border-g-100 px-[18px] py-3.5 last:border-b-0"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={cn("text-[14px] font-semibold text-ink", !automation.kept && "font-medium text-g-500")}>
                {automation.draft.name}
              </span>
              <span className="text-label text-g-500">{describeAutomation(automation.draft, nameOf).sentence}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!automation.kept}
              aria-label={`Change ${automation.draft.name}`}
              onClick={() => setEditing(index)}
            >
              <Icon name="edit" size={14} />Change
            </Button>
            <Switch
              checked={automation.kept}
              aria-label={`Keep ${automation.draft.name}`}
              onCheckedChange={(on) => set(index, { kept: on })}
            />
          </li>
        ))}
      </ul>

      <Sheet open={open !== undefined} onOpenChange={(next) => !next && setEditing(null)}>
        <SheetContent className="w-[min(560px,96vw)]">
          {open === undefined ? null : (
            <>
              <SheetHeader>
                <SheetTitle>Change {open.draft.name}</SheetTitle>
              </SheetHeader>
              <SheetBody className="bg-canvas">
                <AutomationEditor
                  initial={open.draft}
                  context={{ stocks: stocksOf(spec, stocks), nameOf, zone: localTimeZone() }}
                  spec={spec}
                  unsaved={{ spec, nameOf }}
                  whoTrades="This agent, once it's live"
                  saveLabel="Keep these changes"
                  onSave={async (draft) => {
                    set(editing!, { draft, edited: true })
                    setEditing(null)
                  }}
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PolicyGroup>
  )
}
