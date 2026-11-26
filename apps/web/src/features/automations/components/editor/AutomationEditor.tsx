import {
  asksFirst,
  type AutomationDraft,
  type AutomationProblem,
  describeAutomation
} from "@bluechip/domain/automations/Automation"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { type ReactNode, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useAutomationCheck } from "../../hooks/useAutomationCheck.ts"
import { saveProblem } from "../../model/automationText.ts"
import { type DraftFields, suggestedName, toDraft } from "../../model/drafts.ts"
import { changedPhrases, type Phrase, phrasesOf } from "../../model/phrases.ts"
import { AutomationForm } from "./AutomationForm.tsx"
import type { EditorContext } from "./editorContext.ts"
import { EditorSummary } from "./EditorSummary.tsx"
import { type Reading, SaveBar, SaveProblems } from "./SaveBar.tsx"

// The keyboard's platform never changes while the page is open.
const keepsStill = () => () => {}

// How long a phrase an edit changed stays marked in the sentence.
const MARKED_MS = 1600

/**
 * The editor of one automation: its parts (When, Only if, Then, More settings) and, beside them on a page or above
 * them in a sheet, what it will do in a sentence that follows every edit, its name and who trades; then Save, always
 * in reach, with what stops it. Saving goes through `onSave`, which fails with the API's error when bluechip refuses.
 */
export function AutomationEditor(
  { initial, context, spec, whoTrades, unsaved, saveLabel, footer, onSave, compact = false }: Readonly<{
    initial: DraftFields
    context: Omit<EditorContext, "check">
    /** The policies of the agent it trades through; `null` for your own trades. */
    spec: AgentSpec | null
    /** Who trades, in words or as a picker. */
    whoTrades: ReactNode
    /** Read here, not by bluechip: for an agent that isn't saved yet. */
    unsaved?: { readonly spec: AgentSpec; readonly nameOf: (symbol: StockSymbol) => string } | undefined
    saveLabel: string
    /** Beside Save: Cancel. */
    footer?: ReactNode
    onSave: (draft: AutomationDraft) => Promise<unknown>
    /** In a sheet: one column whatever the window's width, Save at the bottom. */
    compact?: boolean
  }>
) {
  const id = useId()
  const [fields, setFields] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const shortcut = useSyncExternalStore(
    keepsStill,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl",
    () => "Ctrl"
  )
  const root = useRef<HTMLDivElement>(null)

  // Read here as you type, so the sentence never waits for bluechip; bluechip's check says what can't run.
  const description = describeAutomation(fields, context.nameOf)
  const draft = useMemo(() => toDraft(fields, description.action), [fields, description.action])
  const { checking, retry } = useAutomationCheck(draft, unsaved)
  const check = checking.status === "checked" ? checking.check : undefined
  const problems = check?.problems ?? []
  const ready = check !== undefined && problems.length === 0 && !saving
  const reading: Reading = checking.status === "checked" ?
    problems.length === 0 ? "ready" : "problems" :
    checking.status

  // The sentence as last shown, so an edit can mark the phrases it changed until they settle.
  const [said, setSaid] = useState(() => ({
    sentence: description.sentence,
    phrases: phrasesOf(description),
    changed: [] as ReadonlyArray<Phrase>
  }))
  if (said.sentence !== description.sentence) {
    const phrases = phrasesOf(description)
    setSaid({ sentence: description.sentence, phrases, changed: changedPhrases(said.phrases, phrases) })
  }

  useEffect(() => {
    if (said.changed.length === 0) return
    const timer = setTimeout(() => setSaid((current) => ({ ...current, changed: [] })), MARKED_MS)
    return () => clearTimeout(timer)
  }, [said.changed])

  const editor: EditorContext = {
    ...context,
    check: { spec: spec === null ? null : complete(spec), trigger: fields.trigger.type, asking: asksFirst(fields) }
  }

  const idOf = (part: AutomationProblem["part"], index: number | null) =>
    part === "conditions" && index !== null ? `${id}-conditions-${index}` : `${id}-${part}`

  const jump = (target: string) => {
    const element = document.getElementById(target)
    if (element === null) return
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })
    element.focus({ preventScroll: true })
  }

  const save = async () => {
    if (!ready) return
    setSaving(true)
    setProblem(null)
    try {
      await onSave(draft)
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setSaving(false)
    }
  }

  // ⌘ or Ctrl with Enter saves from anywhere in the editor; the listener is set again with each render's `save`.
  useEffect(() => {
    const element = root.current
    if (element === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      void save()
    }
    element.addEventListener("keydown", onKeyDown)
    return () => element.removeEventListener("keydown", onKeyDown)
  })

  const nameProblem = problems.find((found) => found.part === "name")?.message

  const summary = (
    <EditorSummary
      phrases={said.phrases}
      changed={said.changed}
      draft={fields}
      nameId={idOf("name", null)}
      namePlaceholder={suggestedName(description.action)}
      nameProblem={nameProblem}
      whoTrades={whoTrades}
      onName={(name) => {
        setFields({ ...fields, name })
        setProblem(null)
      }}
      onJump={(phrase) => jump(idOf(phrase.part, phrase.index))}
    />
  )

  const form = (
    <AutomationForm
      draft={fields}
      context={editor}
      problems={problems}
      settingsSummary={description.settings}
      idOf={idOf}
      onChange={(next) => {
        setFields(next)
        setProblem(null)
      }}
    />
  )

  const saveProblems = (
    <SaveProblems
      reading={reading}
      problems={problems}
      saveProblem={problem}
      onRetry={retry}
      onJump={(found) => jump(idOf(found.part, found.index))}
    />
  )

  const bar = (stacked: boolean, className: string) => (
    <SaveBar
      reading={reading}
      count={problems.length}
      ready={ready}
      saving={saving}
      saveLabel={saveLabel}
      footer={footer}
      shortcut={shortcut}
      stacked={stacked}
      className={className}
      onSave={() => void save()}
    />
  )

  if (compact) {
    return (
      <div ref={root} className="grid gap-4">
        {summary}
        {form}
        {saveProblems}
        {bar(false, "sticky bottom-0 z-[5]")}
      </div>
    )
  }

  // One column up to the large width, Save floating at the bottom; then the form beside a sticky column with the
  // sentence and Save. The column's pieces join the page's grid while it is one column (`contents`).
  return (
    <div ref={root} className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="lg:col-start-1 lg:row-start-1">{form}</div>
      <div className="contents lg:sticky lg:top-[76px] lg:col-start-2 lg:row-start-1 lg:grid lg:min-w-0 lg:gap-3">
        <div className="order-first lg:order-none">{summary}</div>
        <div className="grid gap-3 empty:hidden max-lg:order-last">{saveProblems}</div>
        {bar(true, "z-[5] max-lg:sticky max-lg:bottom-3 max-lg:order-last")}
      </div>
    </div>
  )
}
