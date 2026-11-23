import type { ComponentProps } from "react"
import { Spinner } from "../components/spinner.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

export type ToolCallState = "running" | "done" | "failed"

export interface ToolCallRowProps extends Omit<ComponentProps<"output">, "children"> {
  readonly state: ToolCallState
  /** What bluechip checks, in the tense of the state: "Checking Nvidia's price…", then "Checked Nvidia's price". */
  readonly label: string
  /** The result when done: "$181.42". */
  readonly result?: string
}

const STATE_TEXT: Readonly<Record<ToolCallState, string>> = { running: "Running", done: "Done", failed: "Failed" }

/** A quiet line saying what bluechip checked, so you can see where an answer came from. */
export function ToolCallRow({ state, label, result, className, ...props }: ToolCallRowProps) {
  return (
    <output
      data-slot="tool-call-row"
      data-state={state}
      className={cn(
        "inline-flex max-w-full items-center gap-2 justify-self-start rounded-full bg-g-50 py-1 pr-2.5 pl-[5px] text-label-sm text-g-500 shadow-[inset_0_0_0_1px_var(--color-g-100)]",
        state === "failed" && "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-full",
          state === "done" && "bg-gain text-white",
          state === "failed" && "bg-loss text-white"
        )}
      >
        {state === "running" && <Spinner size={13} className="text-blue" />}
        {state === "done" && <Icon name="check" size={12} strokeWidth={2.2} />}
        {state === "failed" && <Icon name="close" size={12} strokeWidth={2.2} />}
      </span>
      <span className="sr-only">{`${STATE_TEXT[state]}: `}</span>
      <span
        className={cn(
          "truncate",
          state === "running" &&
            "animate-shimmer bg-[linear-gradient(90deg,var(--color-g-500)_0%,var(--color-g-300)_50%,var(--color-g-500)_100%)] bg-size-[200%_100%] bg-clip-text text-transparent motion-reduce:animate-none"
        )}
      >
        {label}
      </span>
      {state === "done" && result && (
        <span className="shrink-0 border-l border-g-200 pl-2 font-semibold text-ink tabular-nums">{result}</span>
      )}
    </output>
  )
}
