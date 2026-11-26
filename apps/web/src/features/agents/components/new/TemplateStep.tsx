import { formatDollars, listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { type SavedTemplate, templateInfos } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { RadioCard, RadioGroup } from "@bluechip/ui/components/radio-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useId, useState } from "react"
import { LoadProblem } from "../../../../components/LoadProblem.tsx"
import { templatesReactivityKey } from "../../../../lib/api/client.ts"
import { deleteTemplateAtom, templatesAtom } from "../../atoms/policies.ts"
import { DIRECTION_WORDS } from "../../model/fieldText.ts"
import { type Origin, originKey, SCRATCH } from "../../model/origin.ts"
import { isTemplateId, uiTemplate } from "../../model/templateLabel.ts"
import { StepFoot } from "./NewAgentShell.tsx"

const BUILT_IN = templateInfos()

function TemplateCard(
  { value, title, summary, tag, illustration }: Readonly<{
    value: string
    title: string
    summary: string
    tag: string
    illustration: IllustrationName
  }>
) {
  const id = useId()

  return (
    <RadioCard value={value} aria-label={title} aria-describedby={id} className="min-w-0 gap-3.5">
      <span
        aria-hidden
        className="grid size-14 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(180deg,#f7f8fa,#eef0f3)] shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] group-data-checked/radio-card:bg-[linear-gradient(180deg,#eef1ff,#e3e8ff)]"
      >
        <Illustration name={illustration} size={40} />
      </span>
      <span className="grid min-w-0 flex-1 justify-items-start gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-body-sm font-semibold">{title}</b>
          <span className="text-caption font-medium text-g-500">{tag}</span>
        </span>
        <span id={id} className="text-label text-g-500">{summary}</span>
      </span>
    </RadioCard>
  )
}

const illustrationOf = (template: string | null): IllustrationName =>
  (template !== null && isTemplateId(template) ?
    AGENT_TEMPLATES.find((each) => each.name === uiTemplate(template))?.illustration :
    undefined) ?? "certificate"

/**
 * The user's saved templates, after they load, each told apart by what it holds: its stocks and daily budget ("NVDA
 * and AAPL, $250 a day"), with the picture of the template it came from. A failed load leaves the built-ins.
 */
function SavedCards({ saved }: Readonly<{ saved: ReadonlyArray<SavedTemplate> }>) {
  return saved.map((template) => {
    const config = configOf(template.spec.policies, trade)
    const stocks = config === undefined || config.stocks.length === 0 ? "No stocks yet" : listNames(config.stocks)
    const budget = config === undefined || config.dailyBudget === BigInt(0) ?
      "no buys" :
      `${formatDollars(config.dailyBudget)} a day`
    return (
      <TemplateCard
        key={template.id}
        value={template.id}
        title={template.name}
        summary={`${stocks}, ${budget}.`}
        tag={config === undefined ? "Saved" : `Saved, ${DIRECTION_WORDS[config.direction].toLowerCase()}`}
        illustration={illustrationOf(template.basedOn)}
      />
    )
  })
}

/** Step one: start from a built-in template, one you saved, or from scratch. */
export function TemplateStep(
  { origin, onPick, onContinue }: Readonly<{
    origin: Origin
    onPick: (origin: Origin) => void
    onContinue: () => void
  }>
) {
  const templates = useAtomValue(templatesAtom)
  const refreshTemplates = useAtomRefresh(templatesAtom)
  const remove = useAtomSet(deleteTemplateAtom, { mode: "promise" })
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const saved = AsyncResult.isSuccess(templates) ? templates.value.saved : []

  const pick = (value: string) => {
    setDeleteFailed(false)
    if (value === SCRATCH) return onPick({ kind: "scratch" })
    const builtIn = BUILT_IN.find((info) => info.id === value)
    if (builtIn !== undefined) return onPick({ kind: "builtIn", template: builtIn.id })
    const template = saved.find((candidate) => candidate.id === value)
    if (template !== undefined) onPick({ kind: "saved", template })
  }

  const deleteSaved = async (template: SavedTemplate) => {
    setDeleting(true)
    setDeleteFailed(false)
    try {
      await remove({ params: { id: template.id }, reactivityKeys: [templatesReactivityKey] })
      onPick({ kind: "builtIn", template: BUILT_IN[0]!.id })
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="grid gap-[18px]">
      <div className="grid gap-1.5">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">What should your agent do?</h2>
        <p className="max-w-[60ch] text-[15px] text-g-600">
          Pick a starting point. You set its rules next, and it does nothing until you lock them.
        </p>
      </div>

      <RadioGroup
        aria-label="Agent templates"
        value={originKey(origin)}
        onValueChange={(value) => pick(String(value))}
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {BUILT_IN.map((info) => (
          <TemplateCard
            key={info.id}
            value={info.id}
            title={info.title}
            summary={info.summary}
            tag={DIRECTION_WORDS[info.direction]}
            illustration={illustrationOf(info.id)}
          />
        ))}
        <SavedCards saved={saved} />
        <TemplateCard
          value={SCRATCH}
          title="Start from scratch"
          summary="Only the rules every agent has. Add the rest yourself."
          tag="Custom"
          illustration="seedling"
        />
      </RadioGroup>

      {AsyncResult.isInitial(templates) ?
        <SkeletonBlock aria-busy className="h-[86px] w-full rounded-lg sm:w-1/2" /> :
        null}
      {AsyncResult.isFailure(templates) ?
        <LoadProblem what="your saved templates" onRetry={refreshTemplates} size="sm" /> :
        null}
      {deleteFailed ?
        <p role="alert" className="text-label-sm text-loss">We couldn't delete that template. Try again.</p> :
        null}

      <StepFoot>
        <ButtonLink variant="ghost" render={<Link to="/agents" />}>Cancel</ButtonLink>
        <div className="flex flex-wrap items-center gap-2">
          {origin.kind === "saved" ?
            (
              <Button
                variant="ghost"
                className="text-loss hover:bg-loss-wash hover:text-loss"
                loading={deleting}
                onClick={() => void deleteSaved(origin.template)}
              >
                <Icon name="trash" size={16} />Delete template
              </Button>
            ) :
            null}
          <Button onClick={onContinue}>
            Continue<Icon name="arrow-right" size={16} />
          </Button>
        </div>
      </StepFoot>
    </div>
  )
}
