import { FlowSteps } from "@bluechip/ui/bluechip/flow-steps"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { AppPage } from "../../../../components/layout/AppPage.tsx"

export const NEW_AGENT_STEPS = ["Start", "Rules", "Review"] as const

export type NewAgentStep = (typeof NEW_AGENT_STEPS)[number]

/**
 * The new agent page: where it is in the three steps, then the step. Locking and its result follow Review without a
 * step of their own (`step` is null): they're the end of it.
 */
export function NewAgentShell(
  { step, wide = false, children }: Readonly<{ step: NewAgentStep | null; wide?: boolean; children: ReactNode }>
) {
  return (
    <AppPage title="New agent" width={wide ? "wide" : "default"}>
      {step === null ?
        null :
        <FlowSteps steps={NEW_AGENT_STEPS} current={NEW_AGENT_STEPS.indexOf(step)} className="-mt-1 max-w-[360px]" />}
      {children}
    </AppPage>
  )
}

/** The way back and the way on, under a step. */
export function StepFoot({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 border-t border-ink/7 pt-4",
        className
      )}
    >
      {children}
    </div>
  )
}
