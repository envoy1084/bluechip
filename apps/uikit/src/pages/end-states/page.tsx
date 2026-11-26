import { Group } from "../agents/layout.tsx"
import { BeforeYouSignSection, SendingSection } from "./before.tsx"
import { AgentOutcomesSection, CashOutcomesSection, MarkSection, TradeOutcomesSection } from "./outcomes.tsx"

export function KitEndStates() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">End states</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          What you see before you sign and after. Base takes about two seconds, so there's no step tracker: the button
          waits, then one place says what happened and what to do next. Face ID here is simulated.
        </p>
      </div>
      <Group n="01" title="Before and during">
        <BeforeYouSignSection />
        <SendingSection />
      </Group>
      <Group n="02" title="After">
        <MarkSection />
        <TradeOutcomesSection />
        <CashOutcomesSection />
        <AgentOutcomesSection />
      </Group>
    </div>
  )
}
