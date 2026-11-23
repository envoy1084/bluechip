import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "../components/alert-dialog.tsx"
import { Button } from "../components/button.tsx"
import { Spinner } from "../components/spinner.tsx"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export interface KillSwitchProps {
  /** Whether every agent is paused right now. */
  readonly paused: boolean
  /** How many agents a pause stops, for the confirmation. */
  readonly agentCount: number
  /** Pauses every agent. Runs after you confirm. */
  readonly onPause: () => void
  /** Asks for Face ID and resumes every agent. Resolve once they're running, reject if Face ID fails. */
  readonly onResume: () => Promise<void>
  readonly className?: string
}

/**
 * One button stops every agent at once. Pausing only takes power away, so it's one confirm. Resuming gives power
 * back, so it asks for Face ID. While paused, a banner stays until you resume.
 */
export function KillSwitch({ paused, agentCount, onPause, onResume, className }: KillSwitchProps) {
  const [resuming, setResuming] = useState(false)
  const [failed, setFailed] = useState(false)

  if (paused) {
    const resume = () => {
      setResuming(true)
      setFailed(false)
      onResume().then(
        () => setResuming(false),
        () => {
          setResuming(false)
          setFailed(true)
        }
      )
    }
    return (
      <output
        data-slot="kill-switch"
        data-state="paused"
        className={cn(
          "flex w-full max-w-[640px] flex-wrap items-center gap-3 rounded-lg bg-[linear-gradient(180deg,#fffbea,var(--color-warn-wash))] py-3 pr-3 pl-3.5 shadow-[inset_0_0_0_1px_var(--color-warn-line),0_3px_8px_-5px_rgba(154,107,0,.14)]",
          className
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(180deg,#f0b400,#c98f00)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
          <Icon name="pause" size={16} />
        </span>
        <div className="grid min-w-0 flex-1 gap-px">
          <b className="text-body-sm font-semibold text-[#4d3500]">All agents are paused</b>
          <span className="text-label text-[#6b4a00]">
            {failed
              ? "Face ID didn't work, so they're still paused. Try again."
              : "None of them can trade. Your stocks and cash stay as they are."}
          </span>
        </div>
        <Button size="sm" aria-busy={resuming || undefined} disabled={resuming} onClick={resume}>
          {resuming ? <Spinner size={14} /> : <Icon name="face-id" size={14} />}
          <TextMorph>{resuming ? "Waiting for Face ID…" : "Resume with Face ID"}</TextMorph>
        </Button>
      </output>
    )
  }

  const plural = agentCount === 1 ? "agent" : "agents"
  return (
    <div
      data-slot="kill-switch"
      data-state="running"
      className={cn(
        "flex w-full max-w-[560px] flex-wrap items-center gap-3.5 rounded-lg bg-white p-5 shadow-e2",
        className
      )}
    >
      <div className="grid min-w-0 flex-1 gap-px">
        <b className="text-[15px] font-semibold">Pause all agents</b>
        <span className="text-label-sm text-g-500">Stops every agent at once. Nothing is sold.</span>
      </div>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>
          <Icon name="pause" size={16} />Pause all
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogIcon name="pause" />
          <AlertDialogHeader>
            <AlertDialogTitle>Pause all {agentCount} {plural}?</AlertDialogTitle>
            <AlertDialogDescription>
              They stop right away, even mid-plan. Nothing is sold. You can resume with Face ID.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" haptic="nudge" onClick={onPause}>
              <Icon name="pause" size={16} />Pause all {plural}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
