import type { Action, AutomationProblem, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import { ACTION_EXAMPLES, TRIGGER_EXAMPLES } from "../../model/automationText.ts"
import { catalogEntry, catalogOf, type DraftFields, freshEntry } from "../../model/drafts.ts"
import { ConditionRows } from "./ConditionRows.tsx"
import type { EditorContext } from "./editorContext.ts"
import { EditorSection } from "./EditorSection.tsx"
import { EntryChoice } from "./EntryChoice.tsx"
import { EntryEditor } from "./EntryEditor.tsx"
import { PartProblem } from "./PartProblem.tsx"
import { SettingsSection } from "./SettingsSection.tsx"

type Part = AutomationProblem["part"]

/** What the picked trigger or action does, over its fields. */
function PickedSummary({ kind, type }: Readonly<{ kind: "trigger" | "action"; type: string }>) {
  return <p className="text-label text-g-500">{catalogEntry(kind, type).summary}</p>
}

/**
 * An automation as three steps read like a recipe: when it starts (a card per trigger), only if what (a row per
 * check), then what it does (a card per action); the rest of its settings folded away. Each pick starts from the
 * catalog's defaults, and what can't run for its agent says why instead.
 */
export function AutomationForm(
  { draft, context, problems, settingsSummary, idOf, onChange }: Readonly<{
    draft: DraftFields
    context: EditorContext
    problems: ReadonlyArray<AutomationProblem>
    /** The settings in words, shown on the folded section. */
    settingsSummary: ReadonlyArray<string>
    /** Where each part is, for the sentence and the problems to lead to. */
    idOf: (part: Part, index: number | null) => string
    onChange: (draft: DraftFields) => void
  }>
) {
  const stock = context.stocks[0]!.symbol
  const problemOf = (part: Part, index: number | null) => (field: string | null) =>
    problems.find((problem) => problem.part === part && problem.index === index && problem.field === field)?.message

  return (
    <div className="grid min-w-0 gap-4">
      <EditorSection id={idOf("trigger", null)} step={1} title="When" question="What starts it?">
        <EntryChoice
          label="Trigger"
          value={draft.trigger.type}
          entries={catalogOf("trigger")}
          examples={TRIGGER_EXAMPLES}
          context={context.check}
          onChange={(type) => onChange({ ...draft, trigger: freshEntry("trigger", type, stock) as Trigger })}
        />
        <div className="grid gap-4 rounded-[12px] p-3.5 surface-well">
          <PickedSummary kind="trigger" type={draft.trigger.type} />
          <PartProblem message={problemOf("trigger", null)(null)} />
          <EntryEditor
            kind="trigger"
            value={draft.trigger}
            context={context}
            problemOf={problemOf("trigger", null)}
            onChange={(trigger) => onChange({ ...draft, trigger: trigger as Trigger })}
          />
        </div>
      </EditorSection>

      <EditorSection
        id={idOf("conditions", null)}
        step={2}
        title="Only if"
        question="Anything that must be true?"
        aside={<span className="text-label-sm text-g-500">Optional</span>}
      >
        <ConditionRows
          conditions={draft.conditions}
          context={context}
          problemOf={(index) => problemOf("conditions", index)}
          idOf={(index) => idOf("conditions", index)}
          onChange={(conditions: ReadonlyArray<Condition>) => onChange({ ...draft, conditions })}
        />
      </EditorSection>

      <EditorSection id={idOf("action", null)} step={3} title="Then" question="What should it do?">
        <EntryChoice
          label="Action"
          value={draft.action.type}
          entries={catalogOf("action")}
          examples={ACTION_EXAMPLES}
          context={context.check}
          onChange={(type) =>
            onChange({ ...draft, action: freshEntry("action", type, stock, context.check) as Action })}
        />
        <div className="grid gap-4 rounded-[12px] p-3.5 surface-well">
          <PickedSummary kind="action" type={draft.action.type} />
          <PartProblem message={problemOf("action", null)(null)} />
          <EntryEditor
            kind="action"
            value={draft.action}
            context={context}
            problemOf={problemOf("action", null)}
            onChange={(action) => onChange({ ...draft, action: action as Action })}
          />
        </div>
      </EditorSection>

      <SettingsSection
        id={idOf("settings", null)}
        draft={draft}
        zone={context.zone}
        summary={settingsSummary}
        problem={problems.find((problem) => problem.part === "settings")?.message}
        onChange={(settings) => onChange({ ...draft, settings })}
      />
    </div>
  )
}
