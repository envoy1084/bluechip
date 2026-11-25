import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { AppPage } from "../../../../../components/layout/AppPage.tsx"

export const NEW_AGENT_STEPS = ["Template", "Rules", "Review", "Face ID", "Done"] as const

export type NewAgentStep = (typeof NEW_AGENT_STEPS)[number]

/** The new agent page at one step: the step's name under the title, then where it is in the five steps. */
export function NewAgentShell(
  { step, wide = false, children }: Readonly<{ step: NewAgentStep; wide?: boolean; children: ReactNode }>
) {
  const at = NEW_AGENT_STEPS.indexOf(step)

  return (
    <AppPage title="New agent" sub={step} width={wide ? "wide" : "default"}>
      <ol className="-mt-1 mb-1 flex flex-wrap items-center gap-1.5" aria-label="New agent progress">
        {NEW_AGENT_STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === at ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-[7px] text-[12.5px] font-semibold whitespace-nowrap text-g-500",
              "[&+&]:before:mr-px [&+&]:before:h-0.5 [&+&]:before:w-4 [&+&]:before:rounded-[1px] [&+&]:before:bg-g-200",
              index === at && "text-ink",
              index !== at && "max-sm:gap-0 max-sm:text-[0px]"
            )}
          >
            <i
              className={cn(
                "grid size-5 place-items-center rounded-full bg-white text-[11px] not-italic shadow-[inset_0_0_0_1.5px_var(--color-g-200)]",
                index === at && "text-blue shadow-[inset_0_0_0_1.5px_var(--color-blue),0_0_0_3px_rgba(42,91,255,.1)]",
                index < at &&
                  "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
              )}
            >
              {index < at ? <Icon name="check" size={11} /> : index + 1}
            </i>
            {label}
          </li>
        ))}
      </ol>
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
