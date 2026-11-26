import type { AutomationProblem } from "@bluechip/domain/automations/Automation"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Kbd, KbdGroup } from "@bluechip/ui/components/kbd"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { problemText } from "../../model/automationText.ts"

/** Whether bluechip has read the draft yet, and what it found. */
export type Reading = "checking" | "failed" | "ready" | "problems"

/**
 * What stops it from saving, each problem leading to its part; that bluechip couldn't check it, with Try again; or
 * why the last save didn't go.
 */
export function SaveProblems(
  { reading, problems, saveProblem, onRetry, onJump }: Readonly<{
    reading: Reading
    problems: ReadonlyArray<AutomationProblem>
    saveProblem: string | null
    onRetry: () => void
    onJump: (problem: AutomationProblem) => void
  }>
) {
  return (
    <>
      {reading === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>
            We couldn't check it just now.{" "}
            <button type="button" className="cursor-pointer font-semibold underline" onClick={onRetry}>
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>It can't run yet</AlertTitle>
          <AlertDescription>
            <ul className="grid gap-1">
              {problems.map((found) => (
                <li key={`${found.part}-${found.index}-${found.field}-${found.message}`}>
                  <button
                    type="button"
                    className="cursor-pointer text-left underline-offset-2 hover:underline"
                    onClick={() => onJump(found)}
                  >
                    {problemText(found)}
                  </button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {saveProblem !== null && (
        <Alert variant="destructive">
          <AlertDescription>{saveProblem}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

function ReadingLine({ reading, count }: Readonly<{ reading: Reading; count: number }>) {
  switch (reading) {
    case "checking":
      return (
        <>
          <Spinner size={14} />Checking it
        </>
      )
    case "failed":
      return (
        <>
          <Icon name="warning" size={15} className="text-loss" />Not checked
        </>
      )
    case "problems":
      return (
        <>
          <Icon name="error" size={15} className="text-loss" />
          {count === 1 ? "1 thing to fix" : `${count} things to fix`}
        </>
      )
    case "ready":
      return (
        <>
          <Icon name="check-circle" size={15} className="text-gain" />Ready to save
        </>
      )
  }
}

/**
 * Save, always in reach: where the draft stands (checking, ready, or how many things to fix), the screen's own
 * actions (Cancel) and Save, which ⌘ or Ctrl with Enter presses too.
 */
export function SaveBar(
  { reading, count, ready, saving, saveLabel, footer, shortcut, stacked, className, onSave }: Readonly<{
    reading: Reading
    count: number
    ready: boolean
    saving: boolean
    saveLabel: string
    footer?: ReactNode
    /** The key held with Enter to save: "⌘" or "Ctrl". */
    shortcut: string
    /** Save over Cancel, full width, from the large width up: in a page's side column. */
    stacked: boolean
    className?: string
    onSave: () => void
  }>
) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white/95 p-3 shadow-e3 backdrop-blur",
        stacked && "lg:grid lg:p-[18px] lg:shadow-e2",
        className
      )}
    >
      <span
        aria-live="polite"
        className="mr-auto inline-flex items-center gap-1.5 text-label font-medium text-g-600"
      >
        <ReadingLine reading={reading} count={count} />
      </span>
      <div className={cn("flex items-center gap-2", stacked && "lg:grid")}>
        {footer}
        <Button
          size="lg"
          disabled={!ready}
          loading={saving}
          onClick={onSave}
          className={cn(stacked && "lg:order-first")}
        >
          {saveLabel}
          <KbdGroup aria-hidden className="ml-1 hidden sm:inline-flex">
            <Kbd variant="inverse">{shortcut}</Kbd>
            <Kbd variant="inverse">↵</Kbd>
          </KbdGroup>
        </Button>
      </div>
    </div>
  )
}
