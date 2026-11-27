import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { track } from "../../../lib/analytics.ts"
import { nextStep, type Step } from "../model/gettingStarted.ts"

/** The next step's one button. */
function StepAction({ step }: Readonly<{ step: Step }>) {
  const openCash = useAtomSet(cashDialogAtom)

  switch (step.id) {
    case "cash":
      return (
        <Button
          size="sm"
          onClick={() => {
            track({ _tag: "add_cash_opened", entry: "home" })
            openCash("add")
          }}
        >
          <Icon name="plus" size={14} />Add cash
        </Button>
      )
    case "agent":
      return step.agentId === undefined ?
        (
          <ButtonLink size="sm" render={<Link to="/agents/new" />}>
            <Icon name="plus" size={14} />New agent
          </ButtonLink>
        ) :
        (
          <ButtonLink size="sm" render={<Link to="/agents/$agentId" params={{ agentId: step.agentId }} />}>
            Finish it
          </ButtonLink>
        )
    case "trade":
      return step.agentId === undefined ?
        null :
        (
          <ButtonLink size="sm" render={<Link to="/agents/$agentId" params={{ agentId: step.agentId }} />}>
            Open your agent
          </ButtonLink>
        )
    case "automation":
      return (
        <ButtonLink size="sm" render={<Link to="/automations/new" />}>
          <Icon name="plus" size={14} />New automation
        </ButtonLink>
      )
    case "recovery":
      return <ButtonLink size="sm" render={<Link to="/settings/security" />}>Add a recovery key</ButtonLink>
  }
}

function StepRow({ step, index, next }: Readonly<{ step: Step; index: number; next: boolean }>) {
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-4 py-3",
        next && "bg-g-50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-px grid size-6 place-items-center rounded-full text-label-sm font-semibold tabular-nums",
          step.done ?
            "bg-gain text-white" :
            next ?
            "bg-white text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]" :
            "bg-white text-g-500 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
        )}
      >
        {step.done ? <Icon name="check" size={13} /> : index + 1}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className={cn("text-body-sm font-semibold", step.done ? "text-g-500 line-through decoration-g-300" : "")}>
          {step.title}
          <span className="sr-only">{step.done ? ", done" : next ? ", next" : ""}</span>
        </span>
        {next ? <span className="text-label-sm text-pretty text-g-600">{step.detail}</span> : null}
      </span>
      {next ?
        (
          <span className="col-start-2 justify-self-start">
            <StepAction step={step} />
          </span>
        ) :
        null}
    </li>
  )
}

/**
 * Getting started: five first steps with how many are done, ticked from what you've really done, and the next one
 * with its button. `welcome` greets someone who has nothing yet, with an illustration and the way to ask the assistant.
 */
export function GettingStarted({ steps, welcome }: Readonly<{ steps: ReadonlyArray<Step>; welcome: boolean }>) {
  const next = nextStep(steps)
  const done = steps.filter((step) => step.done).length
  const left = steps.length - done

  return (
    <section
      aria-labelledby="getting-started"
      className="grid overflow-hidden rounded-lg bg-white shadow-e2 motion-safe:animate-slide-up"
    >
      <div
        className={cn(
          "grid items-center gap-x-5 gap-y-3 border-b border-g-100 px-5 py-[18px]",
          welcome ? "sm:grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]"
        )}
      >
        {welcome ?
          <Illustration name="butterfly" variant="halftone" size={128} animate className="max-sm:hidden" /> :
          <Illustration name="seedling" size={40} />}
        <div className="grid gap-2.5">
          <div className="grid gap-1">
            <h2
              id="getting-started"
              className="text-[19px] leading-tight font-semibold tracking-[-0.025em] text-balance"
            >
              {welcome ? "Welcome to bluechip" : left === 1 ? "One step left" : "Getting started"}
            </h2>
            <p className="text-body-sm text-pretty text-g-600">
              {welcome ?
                "Five steps and you're set: cash in, an agent that trades inside limits you lock, and a way back in if you lose this device." :
                `${done} of ${steps.length} done. Each step takes a minute or two.`}
            </p>
          </div>
          <div
            // One segment per step can't be drawn by a native <progress>, so a div carries the role.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="progressbar"
            aria-label="Steps done"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={done}
            aria-valuetext={`${done} of ${steps.length} done`}
            className="flex gap-1"
          >
            {steps.map((step) => (
              <i
                key={step.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-slow ease-brand",
                  step.done ? "bg-gain" : "bg-g-100"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <ol className="grid divide-y divide-g-100">
        {steps.map((step, index) => <StepRow key={step.id} step={step} index={index} next={step === next} />)}
      </ol>

      {welcome ?
        (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-g-100 px-5 py-3 text-label-sm text-g-500">
            <span>Not sure where to start? The assistant can walk you through it.</span>
            <ButtonLink
              variant="ghost"
              size="sm"
              render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
            >
              <Icon name="chat" size={14} />Ask the assistant
            </ButtonLink>
          </div>
        ) :
        null}
    </section>
  )
}
