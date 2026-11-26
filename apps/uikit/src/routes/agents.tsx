import { Toaster } from "@bluechip/ui/components/toast"
import { createFileRoute } from "@tanstack/react-router"
import {
  AgentCardSection,
  DraftSection,
  LimitEditorSection,
  PermissionSection,
  PresetSection,
  StatusPillSection,
  StatusSection,
  TemplateSection,
  UsageDialSection,
  UsageRingSection,
  UsageSection
} from "../pages/agents/agents-and-limits.tsx"
import {
  ChatDemoSection,
  CitationSection,
  ComposerSection,
  MessageSection,
  ToolCallSection
} from "../pages/agents/chat.tsx"
import { Group } from "../pages/agents/layout.tsx"

export const Route = createFileRoute("/agents")({ component: KitAgents })

function KitAgents() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">Agents & chat</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Agents are teammates with a butterfly and a rulebook: who they are, the limits they can never break, and the
          conversation where you ask for them. Every amount here is an example.
        </p>
      </div>
      <Group n="01" title="Agents & limits">
        <StatusPillSection />
        <StatusSection />
        <AgentCardSection />
        <PermissionSection />
        <UsageSection />
        <UsageRingSection />
        <UsageDialSection />
        <PresetSection />
        <LimitEditorSection />
        <TemplateSection />
        <DraftSection />
      </Group>
      <Group n="02" title="Chat">
        <ChatDemoSection />
        <ComposerSection />
        <MessageSection />
        <ToolCallSection />
        <CitationSection />
      </Group>
      <Toaster />
    </div>
  )
}
