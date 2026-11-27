import type { Action, AutomationProblem, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import { Icon } from "@bluechip/ui/icons/icon"
import type { ReactNode } from "react"
import { ACTION_EXAMPLES, TRIGGER_EXAMPLES } from "../../model/automationText.ts"
import { catalogEntry, catalogOf, type DraftFields, freshEntry } from "../../model/drafts.ts"
import { ConditionRows } from "./ConditionRows.tsx"
import type { EditorContext } from "./editorContext.ts"
import { EditorSection, StepThread } from "./EditorSection.tsx"
import { EntryChoice } from "./EntryChoice.tsx"
import { EntryEditor } from "./EntryEditor.tsx"
import { PartProblem } from "./PartProblem.tsx"
import { SettingsSection } from "./SettingsSection.tsx"

type Part = AutomationProblem["part"]

/** The picked trigger or action set up under its tiles: what it does, what's wrong with it, then its fields. */
function PickedFields(
  { kind, type, problem, children }: Readonly<{
    kind: "trigger" | "action"
    type: string
    problem: string | undefined
    children: ReactNode
  }>
) {
  const { title, summary } = catalogEntry(kind, type)

  return (
    <div className="-mx-[18px] grid gap-4 border-t border-g-100 px-[18px] pt-4">
      <p className="flex items-start gap-2 text-label text-g-600">
        <Icon name="info" size={15} className="mt-0.5 shrink-0 text-blue" />
        <span>
          <b className="font-semibold text-ink">{title}.</b> {summary}
        </span>
      </p>
      <PartProblem message={problem} />
      {children}
    </div>
  )
}

/**
 * An automation as three steps read like a recipe, threaded from one to the next: when it starts (a tile per
 * trigger), only if what (a row per check), then what it does (a tile per action); the rest of its settings folded
 * away. Each pick starts from the catalog's defaults, and what can't run for its agent says why instead.
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
  const hasProblem = (part: Part) => problems.some((problem) => problem.part === part)

  return (
    <div className="grid min-w-0">
      <EditorSection
        id={idOf("trigger", null)}
        step={1}
        title="When"
        question="What starts it?"
        problem={hasProblem("trigger")}
      >
        <EntryChoice
          label="Trigger"
          value={draft.trigger.type}
          entries={catalogOf("trigger")}
          examples={TRIGGER_EXAMPLES}
          context={context.check}
          onChange={(type) => onChange({ ...draft, trigger: freshEntry("trigger", type, stock) as Trigger })}
        />
        <PickedFields kind="trigger" type={draft.trigger.type} problem={problemOf("trigger", null)(null)}>
          <EntryEditor
            kind="trigger"
            value={draft.trigger}
            context={context}
            problemOf={problemOf("trigger", null)}
            onChange={(trigger) => onChange({ ...draft, trigger: trigger as Trigger })}
          />
        </PickedFields>
      </EditorSection>

      <StepThread />

      <EditorSection
        id={idOf("conditions", null)}
        step={2}
        title="Only if"
        question="Anything that must be true?"
        problem={hasProblem("conditions")}
        aside={<span className="text-label-sm font-medium text-g-500">Optional</span>}
      >
        <ConditionRows
          conditions={draft.conditions}
          context={context}
          problemOf={(index) => problemOf("conditions", index)}
          idOf={(index) => idOf("conditions", index)}
          onChange={(conditions: ReadonlyArray<Condition>) => onChange({ ...draft, conditions })}
        />
      </EditorSection>

      <StepThread />

      <EditorSection
        id={idOf("action", null)}
        step={3}
        title="Then"
        question="What should it do?"
        problem={hasProblem("action")}
      >
        <EntryChoice
          label="Action"
          value={draft.action.type}
          entries={catalogOf("action")}
          examples={ACTION_EXAMPLES}
          context={context.check}
          onChange={(type) =>
            onChange({ ...draft, action: freshEntry("action", type, stock, context.check) as Action })}
        />
        <PickedFields kind="action" type={draft.action.type} problem={problemOf("action", null)(null)}>
          <EntryEditor
            kind="action"
            value={draft.action}
            context={context}
            problemOf={problemOf("action", null)}
            onChange={(action) => onChange({ ...draft, action: action as Action })}
          />
        </PickedFields>
      </EditorSection>

      <StepThread />

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
