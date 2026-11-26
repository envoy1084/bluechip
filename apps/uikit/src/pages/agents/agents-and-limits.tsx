import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { AgentCard, AgentRow } from "@bluechip/ui/bluechip/agent-card"
import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { AGENT_STATES, type AgentState, AgentStatus } from "@bluechip/ui/bluechip/agent-status"
import { LimitEditor } from "@bluechip/ui/bluechip/limit-editor"
import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { AGENT_TEMPLATES, type AgentTemplate, TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Button } from "@bluechip/ui/components/button"
import { Slider } from "@bluechip/ui/components/slider"
import { toast } from "@bluechip/ui/components/toast"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { useState } from "react"
import {
  AGENTS,
  EDITOR_START,
  GUARD,
  LAST_ACTION,
  REBALANCER,
  STOP_LOSS_PRESETS,
  WEEKLY,
  WEEKLY_BUYER_PRESETS
} from "./data.ts"
import { Demo, Section, States } from "./layout.tsx"

export function StatusSection() {
  const [state, setState] = useState<AgentState>("active")
  return (
    <Section
      title="Agent status"
      purpose="One word for what an agent is doing. Each state has its own color and icon, so it reads without color too. Select one to read what it means."
    >
      <Demo className="flex-col items-stretch">
        <fieldset aria-label="Agent states" className="flex flex-wrap justify-center gap-2">
          {(Object.keys(AGENT_STATES) as Array<AgentState>).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === state}
              onClick={() => setState(key)}
              className="cursor-pointer rounded-full p-1 transition-[background,box-shadow] duration-fast hover:bg-ink/4 aria-pressed:bg-white aria-pressed:shadow-e2"
            >
              <AgentStatus state={key} />
            </button>
          ))}
        </fieldset>
        <div className="mx-auto flex w-full max-w-[440px] items-center gap-3.5 rounded-lg bg-white p-4 shadow-e2">
          <AgentAvatar
            agentId="picker"
            size="lg"
            status={AGENT_STATES[state].dot}
            removed={state === "removed"}
          />
          <div className="grid gap-0.5">
            <b className="text-body-sm font-semibold">Tech picker</b>
            <span className="text-label text-g-500">{AGENT_STATES[state].description}</span>
          </div>
        </div>
      </Demo>
    </Section>
  )
}

export function AgentCardSection() {
  const [selected, setSelected] = useState(REBALANCER.id)
  const agent = AGENTS.find((candidate) => candidate.id === selected) ?? REBALANCER
  return (
    <Section
      title="Agent card"
      purpose="Compact in lists and the sidebar; full on the agent's page, with its last action and everything it can and can never do. Pick an agent on the left to open its full card."
    >
      <Demo className="grid items-start gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <fieldset aria-label="Your agents" className="grid gap-0.5 rounded-lg bg-white p-1.5 shadow-e2">
          {AGENTS.map((candidate) => (
            <AgentRow
              key={candidate.id}
              agent={candidate}
              selected={candidate.id === selected}
              onClick={() => setSelected(candidate.id)}
            />
          ))}
        </fieldset>
        <AgentCard
          agent={agent}
          lastAction={LAST_ACTION[agent.id] ?? ""}
          onEditLimits={() => toast("Opening the limit editor")}
        />
      </Demo>
    </Section>
  )
}

export function PermissionSection() {
  return (
    <Section
      title="Permission card"
      purpose="The promise, in two columns: everything an agent may do, everything it never can, how much it has used today, and when the Face ID lock runs out."
    >
      <Demo className="justify-center">
        <PermissionCard
          className="max-w-[560px]"
          limits={REBALANCER.limits}
          spentToday={140}
          lockedUntil="21 Feb"
          onEditLimits={() => toast("Opening the limit editor")}
        />
      </Demo>
      <States>
        <Demo label="Compact · buy only" className="items-start">
          <PermissionCard size="compact" limits={WEEKLY.limits} spentToday={50} lockedUntil="1 Mar" />
        </Demo>
        <Demo label="Draft · not locked" className="items-start">
          <PermissionCard size="compact" limits={GUARD.limits} />
        </Demo>
      </States>
    </Section>
  )
}

export function UsageSection() {
  const [spent, setSpent] = useState(140)
  return (
    <Section
      title="Usage meter"
      purpose="How much of today's spending limit an agent has used. It turns amber at 80% and red when it's used up, and always says when it resets."
    >
      <Demo className="justify-center">
        <div className="grid w-full max-w-[420px] gap-5">
          <UsageMeter used={spent} limit={200} />
          <div className="grid gap-1">
            <span className="text-label-sm font-medium text-g-500">Simulate spending</span>
            <Slider
              min={0}
              max={200}
              step={5}
              value={spent}
              onValueChange={(next) => setSpent(typeof next === "number" ? next : next[0] ?? 0)}
              thumbLabels={["Amount spent today"]}
              format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
              showValues={false}
              showScale={false}
            />
          </div>
        </div>
      </Demo>
      <States>
        <Demo label="Normal">
          <UsageMeter used={60} limit={200} />
        </Demo>
        <Demo label="Near the limit">
          <UsageMeter used={170} limit={200} />
        </Demo>
        <Demo label="At the limit">
          <UsageMeter used={200} limit={200} />
        </Demo>
      </States>
    </Section>
  )
}

export function PresetSection() {
  const [picked, setPicked] = useState("Balanced: $250 a day, $100 per trade, 30% max in one stock.")
  return (
    <Section
      title="Preset picker"
      purpose="Three starting points for limits, so nobody faces five sliders first. Arrow keys move between them; picking one fills the limit editor. Given amounts, it shows what a template actually drafts."
    >
      <Demo label="The presets' own amounts" className="flex-col items-stretch">
        <PresetPicker
          defaultValue="balanced"
          onValueChange={(preset) =>
            setPicked(
              `${preset.label}: ${formatDollars(preset.limits.dailySpend)} a day, ${
                formatDollars(preset.limits.maxPerTrade)
              } per trade, ${preset.limits.maxInOneStock}% max in one stock.`
            )}
        />
        <span aria-live="polite" className="text-label text-g-500">{picked}</span>
      </Demo>
      <Demo label="A weekly buyer's, capped at $500 a day" className="flex-col items-stretch">
        <PresetPicker defaultValue="active" amounts={WEEKLY_BUYER_PRESETS} />
      </Demo>
      <Demo label="A stop-loss guard's: it never buys, and has no stock cap" className="flex-col items-stretch">
        <PresetPicker defaultValue="balanced" amounts={STOP_LOSS_PRESETS} />
      </Demo>
    </Section>
  )
}

const faceId = () => new Promise<void>((resolve) => setTimeout(resolve, 1200))

export function LimitEditorSection() {
  const [locked, setLocked] = useState(EDITOR_START)
  const [draft, setDraft] = useState(EDITOR_START)
  return (
    <Section
      title="Limit editor"
      purpose="Set what an agent may do and read it back as plain sentences while you drag. Each change is marked: tighter limits apply at once; looser ones need Face ID, because they give the agent more power."
    >
      <Demo className="items-start">
        <LimitEditor
          locked={locked}
          value={draft}
          onValueChange={setDraft}
          lockedUntil="22 Feb"
          onApply={(limits) => {
            setLocked(limits)
            toast.success("Tighter limits are live")
          }}
          onLock={async (limits) => {
            await faceId()
            setLocked(limits)
            toast.success("Locked with Face ID", { description: "New limits are live until 22 Feb." })
          }}
        />
      </Demo>
    </Section>
  )
}

export function TemplateSection() {
  const [template, setTemplate] = useState<AgentTemplate>(AGENT_TEMPLATES[0]!)
  return (
    <Section
      title="Template picker"
      purpose="The four kinds of agent bluechip makes, each with its picture and the one rule that defines it. Picking one starts the agent draft."
    >
      <Demo className="flex-col items-stretch">
        <TemplatePicker value={template.name} onValueChange={setTemplate} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span aria-live="polite" className="text-label text-g-500">{template.label} selected.</span>
          <Button size="sm" onClick={() => toast(`Drafting a ${template.label}`)}>
            Use template<Icon name="arrow-right" size={14} />
          </Button>
        </div>
      </Demo>
    </Section>
  )
}

export function DraftSection() {
  return (
    <Section
      title="Agent draft card"
      purpose="What chat hands you after “make an agent that…”: the agent, its rules in sentences, then Customize or Lock with Face ID. Every state is on the Chat cards page."
    >
      <Demo className="justify-center">
        <AgentDraftCard
          agentId="rebalancer"
          name="Rebalancer"
          detail="Runs for 90 days once locked. Pause it any time."
          can={[
            "Trade Nvidia, Apple, Microsoft and Tesla, only to move you back to your target mix",
            "Spend up to $250 a day"
          ]}
          never={["Send money out of your account", "Put over 30% of your money in one stock"]}
          state="Not running yet"
          footer={
            <>
              <Button variant="ghost" onClick={() => toast("Opening the new agent flow")}>Customize</Button>
              <Button onClick={() => toast("Face ID")}>Lock with Face ID</Button>
            </>
          }
        />
      </Demo>
    </Section>
  )
}
