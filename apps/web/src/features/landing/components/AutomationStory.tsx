import { TRIGGERS } from "@bluechip/domain/automations/Automation"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { useRef } from "react"
import { useInView } from "../hooks/useInView.ts"

const STEPS: ReadonlyArray<{ readonly word: string; readonly icon: IconName; readonly text: string }> = [
  { word: "When", icon: "zap", text: "Nvidia falls 5% from its close" },
  { word: "If", icon: "clock", text: "the market is open" },
  { word: "Then", icon: "plus", text: "buy $100 of Nvidia" }
]

/**
 * An automation read as the sentence it is: when, if, then. Its parts land one after another the first time it is
 * seen, then the run it led to; the triggers it can start from follow, named as the catalog names them.
 */
export function AutomationStory() {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)

  return (
    <div ref={root} className="flex h-full flex-col gap-5 rounded-2xl bg-white p-5 shadow-e3 sm:p-6">
      <div className="grid gap-1">
        <b className="text-title-3 font-semibold">Automations</b>
        <p className="text-body-sm text-g-600">
          A trigger, conditions and an action, for you or one of your agents. A run trades inside the agent's limits,
          asks you first, or just tells you.
        </p>
      </div>

      <ol className="relative grid gap-2.5 before:absolute before:top-5 before:bottom-5 before:left-[21px] before:w-px before:bg-g-200">
        {STEPS.map((step, index) => (
          <li
            key={step.word}
            data-shown={seen || undefined}
            className="relative flex translate-x-2 items-center gap-3 opacity-0 transition-[opacity,translate] duration-[700ms] ease-brand data-shown:translate-x-0 data-shown:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none"
            style={{ transitionDelay: `${200 + index * 380}ms` }}
          >
            <span className="grid size-[42px] shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
              <Icon name={step.icon} size={17} />
            </span>
            <span className="text-body">
              <b className="font-semibold text-blue">{step.word}</b> {step.text}
            </span>
          </li>
        ))}
      </ol>

      <div
        data-shown={seen || undefined}
        className="flex scale-95 items-center gap-2.5 rounded-md bg-gain-wash px-3 py-2.5 opacity-0 shadow-[inset_0_0_0_1px_var(--color-gain-line)] transition-[opacity,scale] delay-[1500ms] duration-slow ease-spring data-shown:scale-100 data-shown:opacity-100 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none"
      >
        <TickerChip symbol="NVDA" size="sm" />
        <span className="text-label font-medium text-gain">It ran, and bought $100.00 of Nvidia</span>
      </div>

      <div className="mt-auto grid gap-2.5 border-t border-g-100 pt-4">
        <span className="text-label-sm font-semibold text-g-500">Starts from</span>
        <ul className="flex flex-wrap gap-1.5">
          {TRIGGERS.map((trigger) => (
            <li
              key={trigger.type}
              className="rounded-full bg-g-50 px-2.5 py-1 text-label-sm text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
            >
              {trigger.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
