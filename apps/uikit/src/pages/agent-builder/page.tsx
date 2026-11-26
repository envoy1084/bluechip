import { Group } from "../agents/layout.tsx"
import { PolicyRowSection } from "./rules.tsx"
import { FlowStepsSection, ReviewSection, StartSection } from "./steps.tsx"

export function KitAgentBuilder() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">Agent builder</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Making an agent, one decision at a time: a starting point, its rules (folded to what they do, opened to change
          them), then a review and the lock. The screens after the lock are on the End states page.
        </p>
      </div>
      <Group n="01" title="The flow">
        <FlowStepsSection />
        <StartSection />
      </Group>
      <Group n="02" title="Rules">
        <PolicyRowSection />
      </Group>
      <Group n="03" title="Review">
        <ReviewSection />
      </Group>
    </div>
  )
}
