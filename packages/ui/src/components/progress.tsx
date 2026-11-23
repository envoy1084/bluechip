import { Progress as BaseProgress } from "@base-ui/react/progress"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"

export const progressVariants = cva("", {
  variants: {
    variant: {
      default: "[--progress-fill:linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))]",
      warning: "[--progress-fill:linear-gradient(180deg,#ffd85a,#f5b400)]",
      success: "[--progress-fill:linear-gradient(180deg,#14a457,var(--color-gain))]"
    }
  },
  defaultVariants: { variant: "default" }
})

export interface ProgressProps
  extends ComponentProps<typeof BaseProgress.Root>, VariantProps<typeof progressVariants>
{}

/**
 * How far along something is. Pass `value={null}` when we can't know: the bar sweeps instead. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export function Progress({ variant, className, ...props }: ProgressProps) {
  return (
    <BaseProgress.Root data-slot="progress" className={cn(progressVariants({ variant }), className)} {...props}>
      <BaseProgress.Track className="relative h-2 overflow-hidden rounded-sm bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.06)]">
        <BaseProgress.Indicator
          className={cn(
            "h-full rounded-[inherit] bg-(image:--progress-fill) transition-[width] duration-slow ease-brand",
            // Indeterminate: a short segment sweeps across, using the shimmer keyframes on a no-repeat background.
            "data-indeterminate:w-full data-indeterminate:animate-shimmer data-indeterminate:bg-size-[50%_100%] data-indeterminate:bg-no-repeat"
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}

export interface ProgressRingProps extends ComponentProps<typeof BaseProgress.Root> {
  readonly variant?: "default" | "warning" | "success"
}

const ringStroke = { default: "stroke-blue", warning: "stroke-[#f5b400]", success: "stroke-gain" } as const

/** A compact circular progress with the percentage inside. `value={null}` spins. */
export function ProgressRing({ variant = "default", value, className, ...props }: ProgressRingProps) {
  const indeterminate = value === null || value === undefined
  return (
    <BaseProgress.Root
      data-slot="progress-ring"
      value={value ?? null}
      className={cn("relative inline-grid size-[52px] place-items-center", className)}
      {...props}
    >
      <svg
        viewBox="0 0 36 36"
        aria-hidden
        className={cn("absolute inset-0 -rotate-90 fill-none stroke-[3.5]", indeterminate && "animate-spin")}
      >
        <circle cx="18" cy="18" r="15.5" className="stroke-g-100" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          pathLength={100}
          strokeLinecap="round"
          strokeDasharray={`${indeterminate ? 25 : value} 100`}
          className={cn(ringStroke[variant], "transition-[stroke-dasharray] duration-slow ease-brand")}
        />
      </svg>
      {!indeterminate && <BaseProgress.Value className="text-[11.5px] font-semibold tabular-nums" />}
    </BaseProgress.Root>
  )
}
