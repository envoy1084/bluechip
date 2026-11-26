import { asksFirst, type AutomationDraft, describeAutomation } from "@bluechip/domain/automations/Automation"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Input } from "@bluechip/ui/components/input"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { type ReactNode, useId, useMemo, useState } from "react"
import { useAutomationCheck } from "../../hooks/useAutomationCheck.ts"
import { problemText, saveProblem } from "../../model/automationText.ts"
import { type DraftFields, suggestedName, toDraft } from "../../model/drafts.ts"
import { AutomationForm } from "./AutomationForm.tsx"
import type { EditorContext } from "./editorContext.ts"

const MAX_NAME = 60

/**
 * The editor of one automation: its sections on the left; on the right its name, who trades, what it does in a
 * sentence as bluechip reads it, what stops it from running, and Save. Saving goes through `onSave`, which fails with
 * the API's error when bluechip refuses it.
 */
export function AutomationEditor(
  { initial, context, spec, whoTrades, unsaved, saveLabel, footer, onSave }: Readonly<{
    initial: DraftFields
    context: Omit<EditorContext, "check">
    /** The policies of the agent it trades through; `null` for your own trades. */
    spec: AgentSpec | null
    /** Who trades, in words or as a picker. */
    whoTrades: ReactNode
    /** Read here, not by bluechip: for an agent that isn't saved yet. */
    unsaved?: { readonly spec: AgentSpec; readonly nameOf: (symbol: StockSymbol) => string } | undefined
    saveLabel: string
    /** Under Save: Cancel, Delete. */
    footer?: ReactNode
    onSave: (draft: AutomationDraft) => Promise<unknown>
  }>
) {
  const nameId = useId()
  const [fields, setFields] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const action = describeAutomation(fields, context.nameOf).action
  const draft = useMemo(() => toDraft(fields, action), [fields, action])
  const { checking, retry } = useAutomationCheck(draft, unsaved)
  const check = checking.status === "checked" ? checking.check : undefined
  const problems = check?.problems ?? []
  const ready = check !== undefined && problems.length === 0 && !saving

  const editor: EditorContext = {
    ...context,
    check: { spec: spec === null ? null : complete(spec), trigger: fields.trigger.type, asking: asksFirst(fields) }
  }

  const save = async () => {
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

  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <AutomationForm
        draft={fields}
        context={editor}
        problems={problems}
        settingsSummary={check?.description.settings ?? []}
        onChange={(next) => {
          setFields(next)
          setProblem(null)
        }}
      />

      <div className="grid min-w-0 gap-3 lg:sticky lg:top-[76px]">
        <section aria-label="What it does" className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
          <div className="grid gap-1.5">
            <label htmlFor={nameId} className="text-label-sm font-semibold text-g-500">Name</label>
            <Input
              id={nameId}
              value={fields.name}
              maxLength={MAX_NAME}
              autoComplete="off"
              placeholder={suggestedName(action)}
              onChange={(event) => setFields({ ...fields, name: event.currentTarget.value })}
              className="text-[16px] font-semibold"
            />
          </div>

          <div className="grid gap-1" aria-live="polite">
            <span className="text-label-sm font-semibold text-g-500">It will</span>
            {check === undefined ?
              <SkeletonBlock className="h-5 w-full" /> :
              <p className="text-[15px] leading-snug font-medium text-ink">{check.description.sentence}</p>}
          </div>

          <OrderPreview>
            <OrderPreviewRow label="Trades through">{whoTrades}</OrderPreviewRow>
            {check === undefined || check.description.settings.length === 0 ? null : (
              <OrderPreviewRow label="Settings">
                <span className="text-right">{check.description.settings.join(". ")}.</span>
              </OrderPreviewRow>
            )}
          </OrderPreview>
        </section>

        {checking.status === "failed" && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn't check it just now.{" "}
              <button type="button" className="font-semibold underline" onClick={retry}>Try again</button>
            </AlertDescription>
          </Alert>
        )}
        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>It can't run yet</AlertTitle>
            <AlertDescription>
              <ul className="grid gap-1">
                {problems.map((found) => (
                  <li key={`${found.part}-${found.index}-${found.field}-${found.message}`}>{problemText(found)}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {problem !== null && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}

        <Button size="lg" className="w-full" disabled={!ready} loading={saving} onClick={() => void save()}>
          {saveLabel}
        </Button>
        {footer}
      </div>
    </div>
  )
}
