import { configOf } from "@bluechip/domain/policies/Policy"
import { type SavedTemplate, templateInfos } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { RadioCard, RadioGroup } from "@bluechip/ui/components/radio-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useId, useState } from "react"
import { templatesReactivityKey } from "../../../../lib/api/client.ts"
import { deleteTemplateAtom, templatesAtom } from "../../atoms/policies.ts"
import { DIRECTION_LABELS } from "../../model/fieldText.ts"
import { type Origin, originKey, SCRATCH } from "../../model/origin.ts"
import { uiTemplate } from "../../model/templateLabel.ts"
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
        <b className="text-body-sm font-semibold">{title}</b>
        <span id={id} className="text-label text-g-500">{summary}</span>
        <span className="mt-1 rounded-full bg-g-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-g-600">
          {tag}
        </span>
      </span>
    </RadioCard>
  )
}

/** The user's saved templates, after they load; a failed load leaves the built-ins to pick from. */
function SavedCards({ saved }: Readonly<{ saved: ReadonlyArray<SavedTemplate> }>) {
  return saved.map((template) => {
    const direction = configOf(template.spec.policies, trade)?.direction
    return (
      <TemplateCard
        key={template.id}
        value={template.id}
        title={template.name}
        summary="Your saved template: its rules start as you saved them."
        tag={direction === undefined ? "Saved" : DIRECTION_LABELS[direction]}
        illustration="key"
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
          Pick a starting point. You'll choose its rules next, and nothing runs until you lock them with Face ID.
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
            tag={DIRECTION_LABELS[info.direction]}
            illustration={AGENT_TEMPLATES.find((template) => template.name === uiTemplate(info.id))?.illustration ??
              "certificate"}
          />
        ))}
        <SavedCards saved={saved} />
        <TemplateCard
          value={SCRATCH}
          title="Start from scratch"
          summary="Only the rules every agent has, at their standard settings. Add the rest yourself."
          tag="Custom"
          illustration="seedling"
        />
      </RadioGroup>

      {AsyncResult.isInitial(templates) ?
        <SkeletonBlock aria-busy className="h-[86px] w-full rounded-lg sm:w-1/2" /> :
        null}
      {AsyncResult.isFailure(templates) ?
        <p className="text-label-sm text-g-500">We couldn't load your saved templates just now.</p> :
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
