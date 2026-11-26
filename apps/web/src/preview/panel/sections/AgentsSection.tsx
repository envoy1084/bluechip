// The panel's agents section: pick an agent and put it in any state its pages show (usage, a session ending soon,
// journal entries), add one from a template, pause or resume them all, and pick an automation to set its state or
// run it with any outcome.
import type { RunOutcome } from "@bluechip/domain/automations/Run"
import { type Preset, TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import { useState } from "react"
import type { AgentRecord, UsageLimit } from "../../world/agents/AgentRecord.ts"
import { AGENT_STATES, agentStateOf } from "../../world/agents/AgentStates.ts"
import { AUTOMATION_STATES, automationStateOf } from "../../world/agents/automations.ts"
import { TRADE_MOMENTS } from "../../world/agents/journal.ts"
import { RUN_SKIPS, type RunSkip } from "../../world/agents/runs.ts"
import {
  addAgentFromTemplate,
  addAutomationRun,
  addJournalEntry,
  pauseAllAgents,
  resumeAllAgents,
  setAgentEndsIn,
  setAgentStateAction,
  setAgentUsage,
  setAutomationState
} from "../actions/agents.ts"
import { Act, Group, Pick, Row, Segmented, usePreview } from "../controls.tsx"

const LIMITS: ReadonlyArray<{ readonly limit: UsageLimit; readonly label: string }> = [
  { limit: "trade", label: "Daily budget" },
  { limit: "tradesPerDay", label: "Trades today" },
  { limit: "gasBudget", label: "Gas today" },
  { limit: "slippageBudget", label: "Lost to prices this week" }
]

const USAGE = [
  { value: "0", label: "Fresh" },
  { value: "0.5", label: "Half" },
  { value: "0.9", label: "Nearly" },
  { value: "1", label: "Used up" }
] as const

const usageLevel = (share: number): (typeof USAGE)[number]["value"] =>
  share >= 1 ? "1" : share >= 0.8 ? "0.9" : share > 0 ? "0.5" : "0"

const OUTCOMES: ReadonlyArray<{ readonly value: RunOutcome; readonly label: string }> = [
  { value: "proposed", label: "Proposed" },
  { value: "asked", label: "Asked" },
  { value: "notified", label: "Notified" },
  { value: "skipped", label: "Skipped" },
  { value: "failed", label: "Failed" }
]

const PRESETS: ReadonlyArray<{ readonly value: Preset; readonly label: string }> = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "active", label: "Active" }
]

function AgentControls({ record }: Readonly<{ record: AgentRecord }>) {
  const store = usePreview()
  const locked = record.currentSessionId !== null && record.status !== "removed"

  return (
    <>
      <Row label="State">
        <Pick
          label="State"
          value={agentStateOf(record)}
          options={AGENT_STATES}
          onChange={(state) => store.act(setAgentStateAction(record.id, state))}
        />
      </Row>
      {locked ?
        LIMITS.map(({ label, limit }) => (
          <Row key={limit} label={label}>
            <Segmented
              value={usageLevel(record.usage[limit])}
              options={USAGE}
              onChange={(share) => store.act(setAgentUsage(record.id, limit, Number(share)))}
            />
          </Row>
        )) :
        <p className="text-[12px] text-g-500">Usage and the session's end show once it's locked.</p>}
      {locked ?
        (
          <Row label="Session ends">
            <div className="flex flex-wrap gap-2">
              <Act onClick={() => store.act(setAgentEndsIn(record.id, 0.25))}>In 6 hours</Act>
              <Act onClick={() => store.act(setAgentEndsIn(record.id, 3))}>In 3 days</Act>
              <Act onClick={() => store.act(setAgentEndsIn(record.id, 90))}>In 90 days</Act>
            </div>
          </Row>
        ) :
        null}
      <Row label="Add a trade to its journal">
        <div className="flex flex-wrap gap-2">
          {TRADE_MOMENTS.map((moment) => (
            <Act
              key={moment.value}
              onClick={() => store.act(addJournalEntry(record.id, moment.value))}
            >
              {moment.label}
            </Act>
          ))}
        </div>
      </Row>
    </>
  )
}

function NewAgent() {
  const store = usePreview()
  const [template, setTemplate] = useState<TemplateId>("stockPicker")
  const [preset, setPreset] = useState<Preset>("balanced")

  return (
    <Group title="New agent" hint="Locked just now from a template, nothing traded yet.">
      <Pick
        label="Template"
        value={template}
        options={TemplateId.literals.map((id) => ({ value: id, label: TEMPLATES[id].title }))}
        onChange={setTemplate}
      />
      <Segmented value={preset} options={PRESETS} onChange={setPreset} />
      <div>
        <Act onClick={() => store.act(addAgentFromTemplate(template, preset))}>Add agent</Act>
      </div>
    </Group>
  )
}

function Automations() {
  const store = usePreview()
  const { agents, automations } = store.world.agents
  const shown = automations.filter((record) => record.automation.status !== "deleted")
  const [picked, setPicked] = useState<string>("")
  const [outcome, setOutcome] = useState<RunOutcome>("proposed")
  const [skip, setSkip] = useState<RunSkip>("condition")
  const record = shown.find((each) => each.automation.id === picked) ?? shown[0]

  if (record === undefined) {
    return <Group title="Automation" hint="This account has no automations yet.">{null}</Group>
  }

  const agentName = (id: string | null) =>
    id === null ? "you" : agents.find((agent) => agent.id === id)?.name ?? "an agent"
  const id = record.automation.id

  return (
    <Group title="Automation" hint="Its state, and a run just now ending any way.">
      <Pick
        label="Automation"
        value={id}
        options={shown.map(({ automation }) => ({
          value: automation.id,
          label: `${automation.name}, for ${agentName(automation.agentId)}`
        }))}
        onChange={setPicked}
      />
      <Row label="State">
        <Segmented
          value={automationStateOf(record)}
          options={AUTOMATION_STATES}
          onChange={(state) => store.act(setAutomationState(id, state))}
        />
      </Row>
      <Row label="Run it now">
        <Segmented value={outcome} options={OUTCOMES} onChange={setOutcome} />
        {outcome === "skipped"
          ? <Pick label="Why it skipped" value={skip} options={RUN_SKIPS} onChange={setSkip} />
          : null}
        <div>
          <Act onClick={() => store.act(addAutomationRun(id, outcome, outcome === "skipped" ? skip : null))}>Run</Act>
        </div>
      </Row>
    </Group>
  )
}

export function AgentsSection() {
  const store = usePreview()
  const { agents } = store.world.agents
  const [picked, setPicked] = useState<string>("")
  const record = agents.find((agent) => agent.id === picked) ?? agents[0]

  return (
    <>
      <Group
        title="Agent"
        hint={record === undefined ? "This account has no agents yet: add one below." : "What its pages show now."}
      >
        {record === undefined ? null : (
          <>
            <Pick
              label="Agent"
              value={record.id}
              options={agents.map((agent) => ({ value: agent.id, label: agent.name }))}
              onChange={setPicked}
            />
            <AgentControls record={record} />
          </>
        )}
      </Group>
      <NewAgent />
      <Group title="Every agent" hint="As the kill switch does: their locks stay onchain.">
        <div className="flex flex-wrap gap-2">
          <Act onClick={() => store.act(pauseAllAgents())}>Pause all</Act>
          <Act onClick={() => store.act(resumeAllAgents())}>Resume all</Act>
        </div>
      </Group>
      <Automations />
    </>
  )
}
