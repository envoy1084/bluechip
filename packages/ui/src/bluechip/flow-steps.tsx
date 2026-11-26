import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export interface FlowStepsProps extends Omit<ComponentProps<"ol">, "children"> {
  /** Every step's name, in order: "Start", "Rules", "Review". */
  readonly steps: ReadonlyArray<string>
  /** The index of the step you're on. */
  readonly current: number
}

/**
 * Where you are in a short flow: a thin bar per step, filled up to the current one, and the current step's name.
 * Quieter than numbered circles, so the step itself carries the page.
 */
export function FlowSteps({ steps, current, className, ...props }: FlowStepsProps) {
  return (
    <div data-slot="flow-steps" className={cn("grid gap-2", className)}>
      <p className="text-label-sm font-medium text-g-500" aria-hidden>
        Step {current + 1} of {steps.length}, <span className="text-ink">{steps[current]}</span>
      </p>
      <ol aria-label="Progress" className="grid auto-cols-fr grid-flow-col gap-1.5" {...props}>
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "h-1 rounded-full bg-g-200 transition-colors duration-slow ease-brand",
              index <= current && "bg-blue"
            )}
          >
            <span className="sr-only">
              {step}
              {index < current ? ", done" : index === current ? ", current step" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
