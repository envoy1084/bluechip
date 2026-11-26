import { Group } from "../agents/layout.tsx"
import {
  AgentControlSection,
  MemorySection,
  NoticeSection,
  ResearchSection,
  SaveTemplateSection,
  ToolRowSection
} from "./confirm.tsx"
import { GlanceSection, PlanSection, ResultSection } from "./results.tsx"
import { AgentTradeSection, DraftAgentSection, PolicyChangeSection, TradeApprovalSection } from "./trades.tsx"

export function KitCards() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">Chat cards</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Every card the assistant shows in a conversation, in each of its states. A quiet tag and its state, the one
          fact that matters, then what you can do. Face ID here is simulated; every name and amount is an example.
        </p>
      </div>
      <Group n="01" title="Money and agents">
        <TradeApprovalSection />
        <AgentTradeSection />
        <DraftAgentSection />
        <PolicyChangeSection />
      </Group>
      <Group n="02" title="Things you confirm">
        <AgentControlSection />
        <SaveTemplateSection />
        <MemorySection />
      </Group>
      <Group n="03" title="Sources and stops">
        <ResearchSection />
        <ToolRowSection />
        <NoticeSection />
      </Group>
      <Group n="04" title="What tools read">
        <ResultSection />
        <PlanSection />
        <GlanceSection />
      </Group>
    </div>
  )
}
