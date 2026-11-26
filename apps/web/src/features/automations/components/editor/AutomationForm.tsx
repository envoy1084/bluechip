import type { Action, AutomationProblem, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import { PolicyGroup } from "@bluechip/ui/bluechip/policy-row"
import { Button } from "@bluechip/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Icon } from "@bluechip/ui/icons/icon"
import { useState } from "react"
import { asOneLine } from "../../model/automationText.ts"
import { type DraftFields, freshEntry, offered } from "../../model/drafts.ts"
import type { EditorContext } from "./editorContext.ts"
import { EntryEditor, EntryTypeSelect } from "./EntryEditor.tsx"
import { SettingsFields } from "./SettingsFields.tsx"

type Part = AutomationProblem["part"]

function PartProblem({ message }: Readonly<{ message: string | undefined }>) {
  return message === undefined ? null : <p className="text-label-sm font-medium text-loss">{message}</p>
}

/**
 * An automation, one decision per section: when it runs, only if what, then what it does; the rest of its settings
 * folded away. Each section starts from the catalog's defaults and offers only what can run for its agent.
 */
export function AutomationForm(
  { draft, context, problems, settingsSummary, onChange }: Readonly<{
    draft: DraftFields
    context: EditorContext
    problems: ReadonlyArray<AutomationProblem>
    /** The settings in words, shown on the folded section. */
    settingsSummary: ReadonlyArray<string>
    onChange: (draft: DraftFields) => void
  }>
) {
  const stock = context.stocks[0]!.symbol
  // Conditions have no ids of their own; these keep each one's fields in place as others come and go.
  const [keys, setKeys] = useState(() => draft.conditions.map(() => crypto.randomUUID()))
  const problemOf = (part: Part, index: number | null) => (field: string | null) =>
    problems.find((problem) => problem.part === part && problem.index === index && problem.field === field)?.message
  const conditionsOffered = offered("condition", context.check)

  const setCondition = (index: number, condition: Condition) =>
    onChange({ ...draft, conditions: draft.conditions.map((each, at) => at === index ? condition : each) })
  const addCondition = () => {
    const unused = conditionsOffered.find((entry) => !draft.conditions.some((each) => each.type === entry.type))
    const type = unused?.type ?? "holdingAtLeast"
    setKeys([...keys, crypto.randomUUID()])
    onChange({ ...draft, conditions: [...draft.conditions, freshEntry("condition", type, stock) as Condition] })
  }
  const removeCondition = (index: number) => {
    setKeys(keys.filter((_, at) => at !== index))
    onChange({ ...draft, conditions: draft.conditions.filter((_, at) => at !== index) })
  }

  return (
    <div className="grid gap-4">
      <PolicyGroup title="When" description="What starts it.">
        <div className="grid gap-4 px-[18px] py-4">
          <EntryTypeSelect
            label="Trigger"
            value={draft.trigger.type}
            entries={offered("trigger", context.check)}
            onChange={(type) => onChange({ ...draft, trigger: freshEntry("trigger", type, stock) as Trigger })}
          />
          <PartProblem message={problemOf("trigger", null)(null)} />
          <EntryEditor
            kind="trigger"
            value={draft.trigger}
            context={context}
            problemOf={problemOf("trigger", null)}
            onChange={(trigger) => onChange({ ...draft, trigger: trigger as Trigger })}
          />
        </div>
      </PolicyGroup>

      <PolicyGroup
        title="Only if"
        description="Optional. Each has to hold, in order, or that run is skipped."
        aside={
          <Button variant="secondary" size="sm" onClick={addCondition}>
            <Icon name="plus" size={14} />Add a condition
          </Button>
        }
      >
        {draft.conditions.length === 0 ?
          <p className="px-[18px] py-4 text-label text-g-500">No conditions: it acts every time it starts.</p> :
          draft.conditions.map((condition, index) => (
            <section
              key={`${keys[index]}-${condition.type}`}
              aria-label={`Condition ${index + 1}`}
              className="grid gap-4 border-b border-g-100 px-[18px] py-4 last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <EntryTypeSelect
                    label={`Condition ${index + 1}`}
                    value={condition.type}
                    entries={conditionsOffered}
                    onChange={(type) => setCondition(index, freshEntry("condition", type, stock) as Condition)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove condition ${index + 1}`}
                  onClick={() => removeCondition(index)}
                >
                  <Icon name="trash" size={14} />
                </Button>
              </div>
              <PartProblem message={problemOf("conditions", index)(null)} />
              <EntryEditor
                kind="condition"
                value={condition}
                context={context}
                problemOf={problemOf("conditions", index)}
                onChange={(next) => setCondition(index, next as Condition)}
              />
            </section>
          ))}
      </PolicyGroup>

      <PolicyGroup title="Then" description="What it does.">
        <div className="grid gap-4 px-[18px] py-4">
          <EntryTypeSelect
            label="Action"
            value={draft.action.type}
            entries={offered("action", context.check)}
            onChange={(type) =>
              onChange({ ...draft, action: freshEntry("action", type, stock, context.check) as Action })}
          />
          <PartProblem message={problemOf("action", null)(null)} />
          <EntryEditor
            kind="action"
            value={draft.action}
            context={context}
            problemOf={problemOf("action", null)}
            onChange={(action) => onChange({ ...draft, action: action as Action })}
          />
        </div>
      </PolicyGroup>

      <Collapsible className="overflow-hidden rounded-lg bg-white shadow-e2">
        <CollapsibleTrigger className="group/settings flex w-full cursor-pointer items-center justify-between gap-3 px-[18px] py-4 text-left">
          <span className="grid gap-0.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">More settings</span>
            <span className="text-label text-g-500">
              {settingsSummary.length === 0 ? "Runs every time, with no wait." : asOneLine(settingsSummary)}
            </span>
          </span>
          <Icon
            name="chevron-down"
            size={16}
            className="shrink-0 text-g-500 transition-transform duration-base ease-brand group-data-panel-open/settings:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 border-t border-g-100 px-[18px] py-4">
            <PartProblem message={problemOf("settings", null)("quietHours")} />
            <SettingsFields
              draft={draft}
              zone={context.zone}
              onChange={(settings) => onChange({ ...draft, settings })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
