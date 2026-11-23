import type { ComponentProps } from "react"
import { Spinner } from "../components/spinner.tsx"
import { TextMorph } from "../components/text-morph.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"

/** Where a trade is after you approve it. */
export type TransactionState = "sending" | "confirming" | "filled" | "failed"

/** The step a failed trade stopped at. */
export type TransactionStep = "sending" | "confirming"

const STEPS = [
  { id: "sending", title: "Sending", text: "Your trade is on its way" },
  { id: "confirming", title: "Confirming", text: "Base is confirming it" },
  { id: "filled", title: "Filled", text: "Done. It's in your portfolio" }
] as const

type StepState = "done" | "now" | "todo" | "fail"

const SPOKEN: Readonly<Record<StepState, string>> = {
  done: "done",
  now: "in progress",
  todo: "not yet",
  fail: "failed"
}

const stepStates = (state: TransactionState, failedAt: TransactionStep): ReadonlyArray<StepState> => {
  const at = state === "failed" ? failedAt : state
  const index = STEPS.findIndex((s) => s.id === at)
  return STEPS.map((_, i) =>
    state === "filled" || i < index ? "done" : i > index ? "todo" : state === "failed" ? "fail" : "now"
  )
}

export interface TransactionStatusProps extends Omit<ComponentProps<"ol">, "children"> {
  readonly state: TransactionState
  /** The step a failed trade stopped at. Defaults to confirming. */
  readonly failedAt?: TransactionStep
  /** Why it failed, and what happened to the money. */
  readonly failureReason?: string
  /** `auto` lays the steps out in a row from 560 px wide, stacked below that. */
  readonly orientation?: "auto" | "vertical"
}

/**
 * Sending → Confirming → Filled, a couple of seconds each on Base. The current step spins and done steps check; a
 * failure names the reason and that the money is safe.
 */
export function TransactionStatus({
  state,
  failedAt = "confirming",
  failureReason = "The price moved more than 1%. Nothing was bought.",
  orientation = "auto",
  className,
  ...props
}: TransactionStatusProps) {
  const states = stepStates(state, failedAt)
  const row = orientation === "auto"
  return (
    <div className={cn("w-full", row && "@container")}>
      <ol
        data-slot="transaction-status"
        data-state={state}
        className={cn("grid w-full max-w-[620px]", row && "@[560px]:grid-cols-3", className)}
        {...props}
      >
        {STEPS.map((step, i) => {
          const s = states[i] ?? "todo"
          const failed = s === "fail"
          return (
            <li
              key={step.id}
              data-state={s}
              aria-current={s === "now" ? "step" : undefined}
              className={cn(
                "relative grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 pb-3.5 last:pb-0",
                // The connector: down to the next step when stacked, across to it in a row.
                "after:absolute after:top-7 after:bottom-0.5 after:left-[11px] after:w-0.5 after:rounded-[1px] after:bg-g-200 last:after:hidden",
                s === "done" && "after:bg-blue",
                row &&
                  "@[560px]:grid-cols-1 @[560px]:gap-1.5 @[560px]:pr-3 @[560px]:pb-0 @[560px]:after:top-[11px] @[560px]:after:right-2 @[560px]:after:bottom-auto @[560px]:after:left-[30px] @[560px]:after:h-0.5 @[560px]:after:w-auto",
                state === "failed" && s === "todo" && "opacity-50"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "relative z-1 grid size-6 place-items-center rounded-full bg-white text-white shadow-[inset_0_0_0_1.5px_var(--color-g-200)]",
                  s === "done" &&
                    "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_2px_4px_-2px_rgba(42,91,255,.28)]",
                  s === "now" &&
                    "text-blue shadow-[inset_0_0_0_1.5px_var(--color-blue),0_0_0_4px_rgba(42,91,255,.1)]",
                  failed &&
                    "bg-[linear-gradient(180deg,#f25e3e,var(--color-loss))] shadow-[0_2px_4px_-2px_rgba(217,58,28,.28)]"
                )}
              >
                {s === "done" && <Icon name="check" size={12} className="animate-pop-in" />}
                {s === "now" && <Spinner size={12} />}
                {failed && <Icon name="close" size={12} />}
              </span>
              <span className="grid gap-px pt-0.5">
                <b
                  className={cn(
                    "text-[13.5px] font-semibold",
                    s === "now" && "text-blue",
                    failed && "text-loss",
                    s === "todo" && "text-g-400"
                  )}
                >
                  <TextMorph>{failed ? "Didn't go through" : step.title}</TextMorph>
                  {!failed && <span className="sr-only">, {SPOKEN[s]}</span>}
                </b>
                <span className="text-caption text-g-500">{failed ? failureReason : step.text}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
